---
title: "The analysis pipeline: beats, keys, and a separate GPU worker"
author: Michael Huang
pubDatetime: 2026-06-16T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-analysis-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - audio
description: "Full and fast audio analysis, key voting, and the limits of the job and cache recovery paths."
---

Comparing recordings takes a few measurements first: tempo, key, and section boundaries. Running the full analysis every time someone opens a song would make browsing unnecessarily slow, so the results belong in a background pipeline with a cache.

There are two useful levels of detail. A quick pass makes a recording searchable and roughly comparable. Full analysis adds the beat grid, structure, and embeddings needed for more detailed work.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Building the catalog](/posts/sow-catalog). Next: [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline).

<!-- more -->

## Full and fast analysis

_November 6 update: the deployment described here includes the October 24 move to Modal and the October 29 downbeat split, checked at the November 1 revision._

The [full worker](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/analyzer.py) calls a Modal deployment for allin1 analysis and its internal Demucs separation. It receives tempo, beats, downbeats, sections, and embedding information. A local librosa pass adds duration, key, and an RMS-based loudness estimate. That last value isn't a calibrated integrated-LUFS measurement.

Fast analysis stays local and produces duration, tempo, key, and loudness. The queue marks it `partial`; it doesn't upload a full analysis manifest. Its cache filename is separate from the full result, so a quick pass doesn't overwrite a more complete one.

This split also keeps the heavy model dependencies out of the orchestration container. There is no local full-analysis fallback in the reviewed worker. Remote failure goes through the client retry policy and can still fail the job.

## Key detection by voting

The key detector compares chroma features against major and minor profiles. Whole-track averaging is available, but the voting paths use sections or overlapping windows after harmonic/percussive separation.

Quiet windows and ambiguous estimates are discarded. Accepted votes are weighted by duration and capped RMS; short first and last windows receive half weight. If none survive, the detector falls back to a whole-track estimate. That's more specific than assuming every intro and outro is downweighted.

The result carries confidence, a score margin, window agreement, candidates, and an algorithm version. These are diagnostics for an estimate. A high correlation isn't proof that the tonic is right, especially for a recording that modulates.

The [analysis tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/tests/test_analyzer.py) exercise the helpers, while the [cache tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/tests/test_cache.py) check that fast and full results remain distinct.

## Models with different jobs

The October 29 change moved standalone beat-grid detection into [sow-downbeats](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/modal_apps/downbeats_app.py). Component analysis can ask for bar boundaries without starting the full analyzer. The full analyzer still returns its own downbeats.

The lyrics pipeline also has a separate [stem-separation service](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/modal_apps/stem_separator_app.py) for deliverable vocal and accompaniment stems. Those shouldn't be confused with the four stems used internally during full analysis. Their consumers and recovery paths differ.

There were concrete dependency problems during the Modal move. The [October 29 fix](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/modal_apps/analyzer_app.py) captures model-library pins, a patch step, and a non-silent warm-up input. Keeping the working combination in the image definition makes it inspectable. It doesn't mean later model upgrades will be painless.

## Recovery has limits

The [queue](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/queue.py) keeps in-memory state backed by a SQLite job store. At startup it purges old records and requeues interrupted processing and waiting jobs. The [persistence tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/tests/test_queue_persistence.py) cover restart behavior. This is useful recovery, though a seven-day job store isn't a permanent processing history.

The cache is less uniform than I would like. Fast results and beat grids use a temporary file followed by replacement. Full analysis, LRC, and component results use direct JSON writes. Clearing the cache removes all its contents, including both analysis tiers.

So versioned filenames solve one problem: deciding whether a saved result belongs to the current algorithm. They don't by themselves solve interrupted writes, retention, or selective invalidation. I'd make those policies consistent before adding more cached outputs.
