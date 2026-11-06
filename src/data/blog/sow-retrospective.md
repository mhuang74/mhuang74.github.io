---
title: "Ten build phases: what Stream of Worship taught me"
author: Michael Huang
pubDatetime: 2026-09-22T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-retrospective
featured: false
draft: false
tags:
  - stream-of-worship
  - building
  - retrospective
description: "What I would keep, what I would simplify, and which results still need listening tests."
---

I wanted to write down what I would keep after building Stream of Worship, and what I would change if I started again. The project now covers catalog ingestion, analysis, lyrics, set construction, rendering, and playback. Getting those pieces to agree took more work than any one algorithm.

The ten-phase outline is a useful way to follow the build: CLI and schema, catalog scraping, audio downloads, analysis jobs, CLI/service integration, lyrics generation, database migration, web app, render worker, and Android. It isn't a measurement of time spent or a claim that each phase finished before the next began.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Going native: the Android client](/posts/sow-android-client). Next: [Detector 2.0.0](/posts/lrc-detector-2-0-0).

<!-- more -->

**Separate songs from recordings**

A song has bibliographic identity. A recording has a hash of its audio bytes. Keeping them separate gives analysis and storage a stable reference even when catalog metadata needs correction.

The [April 28 migration record](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/handover_db_migration_song_ids.md) is a useful reminder of why this matters: 685 rows became 581 active songs and 104 soft-deleted duplicates, with all 21 recording references valid afterward. Those are migration counts. They shouldn't be combined with later review or download counts as if they were one current catalog snapshot.

Content hashes don't solve all cache problems either. Model versions, prompt versions, and output schemas still need their own invalidation rules.

**Keep judgment and explanation separate**

The constructor can search and rank without a model. The model's explanation isn't what makes a proposal pass. I would keep that split.

The [July 26 example](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/eval/run1_standard/songset_review.md) generated five proposals from 438 candidates with no LLM and relaxed phase coverage. It demonstrates a runnable search, not that a congregation preferred the output. I still need listening feedback before treating a score improvement as a product improvement.

The same applies to boundary scoring. Comparing an exit with an entry is useful, but missing BPMs and uncertain keys still reach the rules. A precise-looking score can hide incomplete input.

**Use the interface people need**

The repository retains a legacy CLI/TUI, a later user TUI, and the web app. The terminal tools are useful for operating and inspecting the pipelines. I would put the phone workflow first for someone preparing a worship set.

I would also choose the shared database earlier. The project moved from SQLite-based storage to Postgres, with separate clients for the admin tools, web app, and render worker. The CLI isn't merely an HTTP client: it still performs database and storage operations. Android is the client that stays behind the web APIs.

**Benchmark before replacing a working tool**

The [June 20 backup benchmark](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/admin-r2-backup-rclone-download-v1-results.md) didn't meet the threshold for switching from boto3 to rclone. Its single-connection boto3 diagnostic reached 7.85 MiB/s; the tested rclone configurations were slower, so the proposed production changes stopped there.

The report called this an account-level cap. The measurements establish a bottleneck on that client and network path, but don't isolate Cloudflare's account policy from the rest of the path. I'd keep the decision and narrow the explanation: rclone didn't help this workload in that test.

**Check the path that runs**

The web client polls render status every ten seconds, while the README lists an SSE route that doesn't exist. The Android tree contains a background playback service the current video screen doesn't use. The renderer stores key shift and tempo ratio without applying either.

All three make the system harder to understand by reading its surface. The unused render settings matter most to the user: a saved transposition can pass a planning rule and still leave the audio unchanged. I would resolve that before adding another recommendation feature.

**Date the expensive experiments**

The [October 20 tail-recovery run](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/tail-lyrics-recovery-report.md) appended 43 lines across 22 jobs. Qwen3 was often unusable on the short, repeated endings, and local Whisper recovered most of those lines. The report is log-derived, includes an interrupted attempt, and doesn't establish correctness for every appended line.

Later in October, Whisper and full analysis moved to Modal. The older timings therefore describe an earlier deployment, not the current cost of the pipeline. The analysis service now orchestrates remote models; it isn't the one machine doing all the GPU work.

**Test the downloaded workflow**

Browser downloads need more than media bytes. Player documents and scripts have to survive too, and some preparation remains best-effort. Android's DownloadManager path has different lifecycle and metadata concerns. I'd keep testing them as separate workflows.

Next I'd collect human ratings of rendered transitions, fix the controls the renderer ignores, and make cold offline launch a repeatable device check. Timbre and chorus-level join-point search are interesting additions, but I first want to know how often a leader accepts the simpler output.

The project is open source at [mhuang74/stream_of_worship](https://github.com/mhuang74/stream_of_worship). The [source snapshot](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/README.md) and [series introduction](/posts/sow-intro) have the project map. The [user guide](https://streamofworship.com) covers preparing a set.
