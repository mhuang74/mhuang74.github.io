---
title: "Running the Analysis Service: Modal apps and background jobs"
author: Michael Huang
pubDatetime: 2026-11-06T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-analysis-infrastructure
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - infrastructure
description: "A CPU orchestration service, five Modal GPU apps, and the job and batch recovery paths that connect analysis to the catalog."
---

I want to process a batch of recordings without keeping every model loaded on the service machine. I also want to stop the Admin CLI, come back later, and find out which results still need to reach the catalog.

The Analysis Service handles the work behind the lyrics and analysis posts. Its CPU container accepts jobs, manages state, and coordinates remote models. The Admin CLI selects the catalog work and saves the returned results. Those are separate responsibilities, with separate recovery paths.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Analyzing songs: tempo, key, sections, and meaning](/posts/sow-analysis-pipeline). Next: [The transition engine](/posts/sow-transition-engine).

<!-- more -->

## One coordinator, five GPU apps

The main container runs FastAPI, the queue, librosa measurements, cache access, and clients for external services. It no longer carries the local torch, allin1, Demucs, or Whisper model stack. Qwen3 ASR and the text APIs are external services too.

The [Modal apps](https://github.com/mhuang74/stream_of_worship/tree/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/modal_apps) divide the GPU work this way:

| App                  | Main work                                                | Why it has its own image                     |
| -------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `sow-analyzer`       | allin1 structure analysis and internal Demucs separation | Full music-analysis dependencies             |
| `sow-downbeats`      | Standalone beat/downbeat grid using madmom-infer         | A grid request doesn't need allin1 or Demucs |
| `sow-stems`          | Vocal/accompaniment separation and vocal dereverb        | Separate separation models and dependencies  |
| `sow-whisper`        | faster-whisper transcription                             | Speech-recognition model stack               |
| `sow-forced-aligner` | Qwen3 supplied-text alignment                            | Alignment model stack                        |

All five request L4 GPUs, allow at most two containers each, and use a 300-second scaledown window in the inspected checkout. This is a cap per app, not a global two-GPU limit. The analyzer and stem apps request four CPUs and 16 GiB RAM; downbeats requests four CPUs and 8 GiB.

The [Modal migration PR](https://github.com/mhuang74/stream_of_worship/pull/263) records the memory and dependency problems behind the split. It also includes earlier deployment details, so the current image definitions are the better reference for exact settings.

## Dependencies and cold starts still matter

Moving inference off the service machine doesn't remove dependency work. The analyzer pins compatible torch, NATTEN, allin1, and Demucs versions, patches an import mismatch, and checks imports during the build. Its startup preparation uses non-silent audio because silence was a poor warm-up input for this stack.

Four apps use named Modal volumes for model weights. A cold container can reuse downloaded weights, but still needs to load models. The lighter downbeats image fetches its verified weights into its container cache at startup and doesn't use the same persistent-volume arrangement. Avoiding the full analyzer image is useful even for a small model.

Per-input timeouts and startup timeouts are separate. The larger apps allow up to 1,800 seconds per input; downbeats allows 600. These are kill switches, not expected song-processing times. A warm request and a first request after scale-down can behave quite differently.

## Bound the work before retrying it

The queue limits full-analysis and LRC execution to two concurrent jobs each by default. Fast analysis and component extraction have separate CPU concurrency limits, while embedding jobs have a five-job semaphore. LLM pacing and provider limits add other controls. One batch-concurrency setting couldn't represent all these resources usefully.

Modal's container caps provide another boundary. The clients own inference retries, and the app classes don't add a second retry policy. That avoids multiplying client attempts by platform attempts. Configuration errors, such as a missing deployment, need a different response from a transient remote failure.

The clients also handle payload preparation and log request IDs. Full analysis, Whisper, and forced alignment don't quietly fall back to local model inference when Modal fails. After the applicable retry policy, the job can fail.

Stem separation has a different route. MVSEP is primary; quota exhaustion can wait for reset, while exhausted non-quota retries lead to Modal. If MVSEP already produced vocals and accompaniment but dereverb fails, only that second stage needs the Modal fallback. The [separation worker](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/stem_separation.py) preserves that distinction. It has no in-container model fallback.

## Job state survives the process

The [queue](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/queue.py) keeps active state in memory and backs it with SQLite. A job includes its typed request, result or error, timestamps, status, stage, and progress. `queued`, `waiting`, and `processing` distinguish work awaiting dispatch, assigned to a task, and actually running.

Stage names describe the current operation, such as downloading or awaiting a stem-separation child job. Progress is a reported fraction, not a prediction of remaining time. A job waiting on quota can take much longer than its earlier progress suggests.

At startup, the service reloads queued jobs and requeues interrupted processing and waiting jobs. It restarts their worker paths; it doesn't restore a model midway through inference. Artifact caches can make that replay cheaper. The persistence tests cover the state transitions, without promising exactly-once execution of external work.

Cancellation has limits. Queued work can be skipped, and some workers check cancellation while waiting or before another stage. Cancelling a processing job marks it cancelled but warns that its running task can continue until service restart. It isn't a remote GPU kill or a rollback of uploads already performed.

Startup cleanup removes terminal jobs older than seven days. Active jobs aren't purged by that rule. SQLite is useful operational history, but it isn't the permanent provenance store for the catalog.

## Cached artifacts have another lifetime

Analysis results, beat grids, lyrics, stems, and components can be reused independently of job rows. Full analysis uploads `analysis.json` to R2; component work can upload `components.json`; lyrics and stems have their own objects. Fast analysis keeps a separate local result and doesn't upload a full analysis manifest.

Versioned cache keys distinguish algorithms and analysis tiers. A full-analysis cache hit with requested stems reuses all four cached stems when present; missing stems require another analyzer call to backfill them. A cached result therefore doesn't guarantee every optional artifact is available.

Writes aren't uniform. Fast results and beat grids use a temporary file followed by replacement, while full analysis, LRC, and component JSON use direct writes. Versioning prevents reuse of an old algorithm's output; it doesn't by itself protect an interrupted write.

## From a batch to the catalog

The [Admin CLI batch command](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/commands/audio.py) selects songs by IDs, albums, status filters, or standard input. Step flags choose downloads, lyrics, analysis, embeddings, and components. Fast is the default analysis tier; full must be selected. `--all-steps` fills missing work and includes structured-lyrics backfill and components.

After resolving the recording and inputs, the CLI submits an authenticated HTTP request to the appropriate `/jobs/...` route. The response provides a job ID. The service persists the request, dispatches its worker under the relevant resource limits, and exposes status for polling.

The CLI interleaves polling across active jobs so one completed song can move forward while others are still running. It writes returned measurements and statuses to catalog recordings, persists song and line embeddings, and upserts component rows. Recording-level Theme/Posture aggregation happens there too. Finishing a service job and updating the catalog are distinct events.

The batch manifest records song, recording hash prefix, step, tier, job ID, and status. It is different from R2's analysis artifact. On interruption, the CLI flushes the manifest so `--resume` can reconnect to outstanding job IDs rather than blindly submit the batch again.

Resume skips terminal entries, attempts idempotent catalog writeback for completed ones, and returns active entries to the polling loop. It doesn't automatically rerun every failed entry. If the service has already purged a job, its ID alone can't recover the result. Cached artifacts and catalog synchronization may still help, but I'd resume a batch while its job records are available.
