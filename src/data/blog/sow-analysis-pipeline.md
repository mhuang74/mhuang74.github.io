---
title: "The analysis pipeline: beats, keys, and stems on a GPU budget"
author: Michael Huang
pubDatetime: 2026-06-16T00:00:00Z
slug: sow-analysis-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - audio
description: "How audio becomes tempo, key, beats, sections, and stems, and why the heavy models live outside the web request path."
---

The most expensive operation in Stream of Worship is asking a song how fast it is.

Before a song can be sequenced against another one, the system has to know something true about it. How fast it is. What key. Where its sections start. Where the vocal ends. A worship leader knows all of that by ear. My software needs it as numbers, attached to a specific recording, recomputable, and cached.

Getting those numbers is the most expensive thing in the project. One full analysis loads music-structure models, separates four stems, runs key detection, and writes a manifest: minutes of GPU time per song. With hundreds of recordings in the catalog, the first design constraint falls out on its own. Analysis can't happen inside a web request, and it can't happen on a box that's also serving traffic.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Building the catalog](/posts/sow-catalog). Next: [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline).

<!-- more -->

## The problem

My first version ran Whisper inside the same container as everything else. It used so much memory that the kernel killed the whole container, queue state and all. That accident defined the architecture.

The shipped container is CPU-only, carries one lightweight library for spectral work, and exists to orchestrate. Everything that needs a GPU or more than a gigabyte of weights lives somewhere else. There's no in-container fallback on purpose. If the remote inference layer is unreachable, the job fails and retries. A silent path that quietly loads a huge model into the orchestrator is how you get an outage instead of an error.

The second constraint is heterogeneity. Different outputs need different models with wildly different resource profiles. Treat them as one monolithic step and you pay the most expensive model's cold start for every output.

## What I built

### Two tiers

The full tier is one remote call. A single ensemble model returns tempo, beats, downbeats, functional sections, and embeddings, and internally runs stem separation. The service then runs a few cheap local passes on the decoded file, merges everything into one manifest, and uploads it.

The fast tier is local-only: duration, tempo, a fixed-window key vote, and loudness. It marks the job partial, uploads nothing, and never writes into the full tier's cache namespace. Its whole job is making the catalog browseable without burning GPU minutes on songs nobody has picked yet. Upgrading to full analysis is an explicit operator decision, and the two caches stay disjoint so a fast result can never masquerade as a full one.

### Key detection, and why it votes

Key detection gets its own section because the transition engine leans on it hardest, and a naive implementation gets it wrong in a specific, predictable way.

The detector compares the audio's harmonic content against a set of key profiles. It first separates harmonic from percussive so drum transients don't smear the result.

Then it votes. The track is cut into overlapping windows. Each window produces a key estimate. Windows that are too quiet get dropped. Windows that are too close to call get rejected. Intros and outros get half weight because they're unrepresentative. If no window survives, the detector falls back to a whole-track estimate.

Confidence, margin, and agreement get stored next to the key, because the set constructor refuses to transpose on a weak estimate.

The algorithm is versioned, and the version string appears in the cache filename and the database row. Change the voting logic and every cached analysis invalidates automatically.

### Isolating downbeats

Downbeats are the smallest possible model deployment in the pipeline. The detector is accurate but needs several gigabytes of weights. Bundling it into the analyzer made every component analysis pay a multi-gigabyte cold start just to answer where the bar starts. Now it's its own deployment with its own container, its own GPU quota, and its own timeout, called only when a component actually needs bar boundaries.

The analyzer's remote contract is deliberately narrow. Inputs are capped before they leave the orchestrator, so a malformed file fails fast instead of wasting minutes on a remote worker.

The most important comment in that config is the one about retries. Retries belong to exactly one layer. If the remote side retried too, a client retry would multiply into more GPU runs, and that's how a slow job turns into a bill.

### Stems are a different pipeline

The stems produced internally by the analyzer are for its own use. The deliverable stems, clean vocals and instrumental for lyric videos and transitions, come from a separate two-stage separation service with its own failover paths.

The interaction with the queue is the subtle part. Stem separation is triggered by lyrics jobs, and those jobs would otherwise hold a concurrency slot while waiting minutes for a third-party render. So the lyrics job releases its slot while the child runs and re-acquires it when the child completes. The queue records that as two explicit steps instead of one implicit wait.

### The queue, and what happens when it dies

The queue is in-memory and backed by a SQLite store with a startup purge. Concurrency is capped, and the fast tier sizes itself to the available CPU cores.

The recovery rule is one line of intent. Any job found processing at boot gets reset to queued, because a job that was processing when the process exited is by definition not processing now. Combined with client-side idempotency, that makes a hard kill survivable.

Cache writes are atomic: a temporary file plus a replacement, so a kill mid-write leaves the previous entry intact instead of a truncated JSON.

## What broke

The model stack is fragile. A library upgrade produced an import-time failure that looked like a missing symbol in an unrelated package. The fix was pinning both libraries and patching the model code to the combination that works. Model stacks don't have a stable dependency graph. They have one combination that works, and you have to capture it.

A torch upgrade changed the default loading behaviour, and checkpoints started failing on the unpickling guard. The interim fix is an environment flag. A model checkpoint is executable content, and I treat it that way now.

Silence was worse than noise. A warm-up pass on digital silence produced NaN stems that looked plausible in file listings. A two-line change fixed it.

The container couldn't reach the remote inference layer at all. The symptom was timeout, not connection refusal. The host firewall was dropping traffic on the bridge interface. "The models are down" and "the firewall is eating packets" look identical from inside the app.

Clearing a cache wiped fast results too. The clear operation was namespace-wide, so flushing full-tier entries also deleted fast-tier entries for the same recording. Recoverable, expensive in wall time, and it made the two tiers less independent than the design claimed.

## What I would do differently

Lock the model stack before the first deploy. The pins and the patch were discovered by breaking them, in an environment where a broken import costs a full image rebuild and a cold start. A lockfile that captures the working combination, not just the top-level versions, makes it reproducible instead of archaeologically recoverable.

Split downbeats out from day one. The cost of bundling was invisible until I measured cold starts, and the split itself was an hour of work. Any model with a different resource profile belongs in its own deployment.

Store the model version next to every derived output. The key algorithm is versioned. Tempo, sections, and embeddings are not. When a value looks wrong six months later, the first question is which model produced it, and for most of these features the answer is "whatever was in the image at the time".

Make the cache namespace first-class. Clearing a cache wiped a tier it wasn't supposed to touch. Namespaces that exist only as filename prefixes get cleared by accident.
