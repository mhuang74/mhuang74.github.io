---
title: "The analysis pipeline: beats, keys, and stems on a GPU budget"
author: Michael Huang
pubDatetime: 2026-10-25T00:00:00Z
slug: sow-analysis-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - audio
description: "How audio becomes tempo, key, beats, sections, and stems — and why the heavy models live outside the web request path."
---

The most expensive thing in Stream of Worship is asking a song how fast it is.

Before a song can be sequenced against another one, the system has to know something true about it. How fast it is. What key. Where its sections start. Where the vocal ends. A worship leader knows all of that by ear. My software needs it as numbers, attached to a specific recording, recomputable, and cached.

Getting those numbers is the most expensive operation in the project. One full analysis loads an ensemble of music-structure models, separates four stems, runs chroma-based key detection, and writes a JSON manifest — minutes of GPU time per song. There are roughly 444 recordings in the catalog. Multiply it out and the first design constraint falls out on its own: analysis cannot happen inside a web request, and it cannot happen on a box that is also serving traffic.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [Building the catalog](/posts/sow-catalog). Next: [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline).

<!-- more -->

## The problem

My first version of this pipeline ran Whisper inside the same container as everything else. It reached a peak resident set of 12.4 GiB on a queued job, the kernel's OOM-killer logic intervened, and the container died with everything else in it — including the queue state for unrelated jobs.

That accident defined the architecture. The shipped container is CPU-only (`python:3.11-slim`), carries librosa for cheap spectral work, and exists to _orchestrate_. Every model that needs a GPU or more than a gigabyte of weights runs somewhere else. There is no in-container fallback, on purpose: if the remote inference layer is unreachable, the job fails and retries. A silent degradation path that quietly loads a 12 GiB model into the orchestrator is how you get an outage instead of an error.

The second constraint is heterogeneity. Different outputs need different models with wildly different resource profiles. All-in-One wants a GPU and produces six things at once. Key detection is cheap enough to run on the CPU. Downbeat detection needs madmom's BLSTM ensemble and no GPU at all. Stem separation is a third-party API call with its own failure modes. Treat them as one monolithic "analyze" step and you pay the most expensive model's cold start for every output.

## Breaking it down

- **Tiering.** Two tiers with different costs and different guarantees. Done when the fast tier can never corrupt a full analysis, and the full tier is the only one producing the features transitions depend on.
- **One remote call per recording.** Done when a full analysis pays one model load, not six.
- **Cache correctness.** Done when changing the key algorithm or the tempo model invalidates the cache automatically, and a crash mid-write never leaves a truncated cache file.
- **Isolating the expensive outlier.** Done when downbeat detection does not require loading the multi-gigabyte analyzer.
- **A queue that survives a restart.** Done when a job stuck in `PROCESSING` at the moment the process died is not stuck forever.
- **Concurrency limits that respect the provider.** Done when the service never opens more remote containers than the budget allows, and never retries on both sides of the boundary.

## What I built

### Two tiers

The **full tier** is one remote call. All-in-One 1.1.0 with the `harmonix-all` ensemble returns tempo, beats, downbeats, functional sections, and embeddings, and internally shells out to Demucs (`htdemucs`) for four stems. The service then runs librosa locally for key detection and RMS loudness — cheap work on an already-decoded file — merges everything into one manifest, and uploads it. The admin CLI writes `analysis_status='completed'` and a `recordings` row when the manifest lands.

The **fast tier** is librosa only: duration, tempo, a fixed-window key vote, and loudness. It writes `partial` status, uploads nothing, and — this is the invariant that matters — never writes into the full tier's cache namespace. Its whole job is making the catalog browseable (tempo and key in a list view) without burning GPU minutes on songs nobody has picked yet. Upgrading to full analysis is an explicit operator decision, and the two caches stay disjoint so a fast result can never be mistaken for a full one.

### Key detection, and why it votes

Key detection gets its own section because it is the feature the transition engine leans on hardest, and because a simple implementation gets it wrong in a specific, predictable way.

The detector uses Krumhansl-Schmuckler profiles against chroma computed from the harmonic component only — `librosa.effects.hpss` splits harmonic from percussive first, because drum transients smear the chroma and pull the estimate toward whatever the kick is doing.

Then it votes. The track is cut into 20-second windows stepping 10 seconds, with a minimum window of 8 seconds. Each window produces a key estimate. Windows are discarded when their RMS falls below the 10th percentile of the track's RMS (a quiet intro or a near-silent breakdown has no reliable pitch content) and capped above the 90th percentile. A window's vote is rejected outright when the margin between the top two profile correlations is below 0.03, so when the estimate is too close to call, it doesn't vote at all. The first and last windows are half-weighted when they are shorter than 20 seconds, because intros and outros are unrepresentative. If no window survives, the detector falls back to a whole-track estimate.

Confidence, margin, and window agreement all get stored next to the key. That matters downstream: the constructor refuses to transpose on a key with confidence below 0.6, so a key without a confidence number isn't usable metadata.

The algorithm is versioned — `ks_segment_vote_v1` — and that version string appears in both the cache filename and the database row. Change the voting logic and every cached analysis is invalidated by construction, and old rows stay explicable: I can tell which algorithm produced a value that now looks wrong.

### Isolating downbeats

Downbeats are the smallest possible model deployment, and splitting them out was the single best structural decision in the service.

madmom's downbeat detector is an ensemble of 8 BLSTMs running at 100 fps with a beats-per-bar prior of [3, 4]. It is accurate and it needs several gigabytes of weights. Bundled into the analyzer, every component analysis would pay an 8-network cold start just to answer "where does the bar start." It's its own deployment now — its own container, its own L4, `cpu=4.0`, 8 GiB, a 600-second timeout, `max_containers=2` — invoked only when a component actually needs bar boundaries.

The analyzer's remote contract is deliberately narrow, and its resource envelope is explicit:

```python file="ops/analysis-service/modal_apps/analyzer_app.py:150-162"
@app.cls(
    image=image,
    gpu="L4",
    cpu=4.0,
    memory=16384,  # MiB; allin1 ensemble + demucs peaks well below 16 GiB
    timeout=1800,  # per-input kill switch -> FunctionTimeoutError (retryable client-side)
    startup_timeout=1800,  # first cold start downloads harmonix-all + htdemucs weights into the volume
    max_containers=2,
    scaledown_window=300,
    volumes={MODEL_MOUNT: model_volume},
    # NOTE: deliberately NO retries= — retries are owned by the client
    # (services/modal_analyzer_client.py) so the layers cannot multiply into N x M GPU runs.
)
```

That last comment is the whole design. **Retries belong to exactly one layer.** If the remote side retried too, a client retry of 2 would multiply into 4 GPU runs, and under a timeout storm that's how a slow job turns into a bill. The client retries twice with a 5-second delay and owns the decision entirely.

Inputs are capped before they leave the orchestrator: 150 MB for the analyzer and downbeat apps, 100 MB for stem separation. A cap that fails fast beats a remote worker decoding a malformed file for five minutes.

### Stems are a different pipeline

The four stems All-in-One produces internally are for its own analysis. The _deliverable_ stems — clean vocals and instrumental for lyric videos and transitions — come from a two-stage separation run through a hosted separation service:

- **Stage 1**, separation type 48 (MelBand Roformer): vocals versus instrumental.
- **Stage 2**, separation type 22 (UVR-De-Echo): de-echoes the vocal.

Outputs are `vocals_dry.flac`, `vocals.flac`, and `instrumental.flac`. Each stage has its own failover path to a remote equivalent, including a stage-2-only fallback, because stage 1 succeeding and stage 2 failing is a common and recoverable state.

The interaction with the queue is the subtle part. Stem separation is triggered by LRC jobs, and those jobs would otherwise hold a concurrency slot while waiting minutes for a third-party render. So the LRC job releases its slot while the child runs and re-acquires it when the child completes. The queue records that as two explicit steps instead of leaving it implicit in an `await`.

### The queue, and what happens when it dies

An in-memory queue backed by a SQLite job store, with a 7-day purge on startup. Analysis concurrency is 2, LRC concurrency is 2, and the fast tier sizes itself to `min(4, max(1, cores // 2))`, because it is librosa on the local CPU and there's no reason to leave cores idle.

The recovery rule is one line of intent: any job found in `PROCESSING` at boot gets reset to `QUEUED`, because a job that was processing when the process exited is by definition not processing now. Combined with client-side idempotency, that makes a hard kill survivable.

Cache writes are atomic — a named temporary file plus `os.replace` — so a kill mid-write leaves the previous cache entry intact instead of a truncated JSON that fails to parse on the next read.

## What broke

**The NATTEN/torch ABI.** All-in-One depends on NATTEN, which is compiled against a specific torch build. A torch upgrade in the image produced an import-time failure that looked like a missing symbol in an unrelated package. The resolution was pinning both, plus a source patch to All-in-One's `dinat.py` that the pinned combination required. Model stacks like this don't have a stable dependency graph. They have a working combination that has to be captured.

**Torch 2.6's weights-only loading.** Torch changed the default `torch.load` behaviour and loading these checkpoints started failing on the unpickling guard. The interim fix is an environment flag that restores the old behaviour. Acceptable, and a reminder that a model checkpoint is executable content.

**A NaN from silence.** Demucs produced NaN separations on the warm-up pass, and the warm-up audio was all zeros. A model given digital silence can produce a degenerate normalisation. The fix was a two-frequency warm-up clip instead of a silent one — a two-line change that hid for a while because the resulting NaN stems were plausible-looking files.

**The firewall on the Docker bridge.** The container couldn't reach the remote inference layer at all, and the failure showed up as a timeout rather than a connection refusal. UFW was dropping traffic on the bridge interface. Worth writing down, because "the models are down" and "the host firewall is eating packets" have identical symptoms from inside the application.

**Clearing a cache wiped fast results too.** The clear operation was namespace-wide, so flushing full-tier entries also deleted fast-tier entries for the same recording. Recoverable, expensive in wall time, and it made the two tiers less independent than the design claimed.

## Evidence

| Tier      | Models                                                                                              | Outputs                                                                          | Status             | Cost                                              |
| --------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------- |
| Full      | All-in-One 1.1.0 (`harmonix-all`) + internal Demucs `htdemucs`; librosa key + loudness in-container | BPM, beats, downbeats, sections, 4 stems, embeddings, key + confidence, loudness | `completed`        | 1 GPU call, ≤1800 s, ≤150 MB input                |
| Fast      | librosa only                                                                                        | Duration, tempo, key + confidence, loudness                                      | `partial`          | CPU seconds, `min(4, max(1, cores/2))` concurrent |
| Downbeats | madmom 8-network BLSTM, 100 fps, beats-per-bar [3, 4]                                               | Bar boundaries                                                                   | Separate app       | Own L4, 8 GiB, 600 s                              |
| Stems     | Stage 1 sep 48 (MelBand Roformer) → Stage 2 sep 22 (UVR-De-Echo)                                    | `vocals_dry.flac`, `vocals.flac`, `instrumental.flac`                            | Per-stage failover | ≤100 MB input; LRC job yields its slot            |

Concurrency and limits: analyzer 2 concurrent client slots, LRC 2, remote `max_containers=2`, client retries 2 with a 5 s delay, no remote-side retries, job store purge 7 days. Cache filenames: full tier `av{ANALYSIS_CACHE_VERSION}.{hash32}.v{KEY_ALGORITHM_VERSION}.json`, fast tier `{hash32}.v{KEY_ALGORITHM_VERSION}.v{BPM_ALGORITHM_VERSION}_fast.json`. The BPM version appears only in the fast-tier name, which is why a tempo-algorithm change doesn't invalidate a full analysis.

## What I'd do differently

1. **Lock the model stack before the first deploy.** The NATTEN/torch pin and the `dinat.py` patch were discovered by breaking them, in an environment where a broken import costs a full image rebuild and a cold start. A lockfile that captures the working combination — not just the top-level versions — would make the combination reproducible instead of archaeologically recoverable.

2. **Split downbeats out from day one.** The cost of bundling was invisible until I measured cold starts, and the split itself was an hour of work. Any model with a different resource profile should start in its own deployment.

3. **Store the model version next to every derived output.** The key algorithm is versioned; tempo, sections, and embeddings are not. When a value looks wrong six months later, the first question is which model produced it, and for most of these features the answer is currently "whatever was in the image at the time."

4. **Make the cache namespace a first-class concept.** Clearing a cache wiped a tier it wasn't supposed to touch. Namespaces that exist only as prefixes of a filename are namespaces that get cleared by accident.

Source: [analyzer_app.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/analysis-service/modal_apps/analyzer_app.py) · [analyzer.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/analysis-service/src/sow_analysis/workers/analyzer.py) · [downbeats_app.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/analysis-service/modal_apps/downbeats_app.py) · [analysis service README](https://github.com/mhuang74/stream_of_worship/blob/main/ops/analysis-service/README.md)
