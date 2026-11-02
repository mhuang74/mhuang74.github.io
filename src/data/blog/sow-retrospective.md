---
title: "Ten build phases: what Stream of Worship taught me"
author: Michael Huang
pubDatetime: 2026-11-01T00:00:00Z
slug: sow-retrospective
featured: false
draft: false
tags:
  - stream-of-worship
  - building
  - retrospective
description: "What ten phases of building Stream of Worship got right, what the POC got wrong, and what comes next."
---

Ten phases, roughly a year of evenings and weekends, and one working system: a catalog of Chinese worship songs, an analysis pipeline that turns audio into tempo, key, structure, and stems, a set constructor that respects a liturgical arc, a serverless renderer, a web app, and two offline-capable clients.

This isn't the launch announcement. It's the part where I say which decisions I'd make again, which ones cost more than they returned, and which numbers I can actually defend.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [Going native: the Android client](/posts/sow-android-client). For the quality gate over the lyrics these pipelines produce, see [Detector 2.0.0](/posts/lrc-detector-2-0-0).

<!-- more -->

## Ten phases

The roadmap in `DEVELOPER.md` defines the phases, and each one closed with its own set of checkboxes. The last column names the closest dated artifact, because git history is useless for this — the repository went through a consolidation that flattened the per-phase commit dates, so any date I took from `git log` would describe the rewrite instead of the work. Even the artifacts are weak evidence: they record when a component was first _mentioned_ in a document, not when it shipped, so the dates don't order the phases.

| #   | Phase            | What shipped                                                                                       | Closest dated artifact                                                           |
| --- | ---------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Foundation       | Typer CLI scaffold, Postgres/Neon schema, TOML config, `db` command group                          | Design doc predates the code (`specs/worship-music-transition-system-design.md`) |
| 2   | Catalog          | sop.org scraper, Chinese→pinyin song IDs, catalog commands, incremental scrape                     | Song-ID migration handover (2026-04-28)                                          |
| 3   | Audio            | yt-dlp download, SHA-256 content-hash dedup, R2 upload, recording metadata                         | Same handover (recordings present by then)                                       |
| 4   | Analysis service | FastAPI + job queue, All-in-One + Demucs workers, clean-vocals chain, R2 stems, Docker             | `docs/analyze-job-flow.md` (2026-09-22)                                          |
| 5   | CLI ↔ service   | `audio analyze/status`, `lyrics generate/align` over HTTP, retry and progress                      | Command surface in the CLI                                                       |
| 6   | LRC generation   | Whisper worker, LLM alignment, Qwen3 ASR, forced-aligner job, LRC upload                           | `docs/lrc-job-flow.md` (2026-09-22)                                              |
| 7   | Turso → Neon     | Postgres/Neon cutover, psycopg3/Drizzle clients, pgvector, tsvector                                | 748-line migration runbook, v4                                                   |
| 8   | Web app          | Next.js 16, Drizzle, Better Auth, catalog + search, songset CRUD, playback, projection, offline SW | `docs/deprecation_analysis.md` (2026-06-20)                                      |
| 9   | Render worker    | Lambda container on SQS, multi-phase render, orphan recovery, REST mode, CJK fonts                 | Fast-start Cast work (2026-06-25)                                                |
| 10  | Android          | Kotlin/Compose, Better Auth via the webapp APIs, Media3 playback, DownloadManager offline          | Delivery notes (2026-06-25)                                                      |

The phase order is not the order of difficulty, and it's not the order of value either. Phases 1–3 were prerequisites that produced nothing visible. Phases 8–10 are where the product became something another person could use. The middle — analysis and lyrics — is where most of the risk lived.

## What worked

**Content addressing as the spine.** One decision went further than any other: the recording's primary key is the SHA-256 of its audio bytes, and the storage prefix comes from that hash. Deduplication, R2 layout, analysis caching, and the transition matrix all key off content instead of off identity or time. Adding a song twice is a no-op. Re-analyzing produces the same cache key. A stale row can't point at different bytes than the ones it was analyzed from.

**Boundary features instead of song averages.** The transition engine scores the exit of one song against the entry of the next, with an all-or-nothing provenance rule so a component-derived key is never compared against a song-level key. That's the one design choice that makes the compatibility scores mean anything, and it came from listening to a bad transition and realizing the numbers described the wrong thing.

**Deterministic rules containing the model.** The songset constructor's LLM proposes and annotates; validity comes from nine hard constraints and a weighted fitness function with no model in it. There's a deterministic fallback path that needs no API key at all. The test of whether that division is real is whether the system still works when the model is absent, and it does.

**Offline as a launch requirement, not a feature.** Treating "plays with zero network" as an invariant from the start is why the service worker serves byte ranges, why the player caches the controller document, and why the Android client uses `DownloadManager`. Added later, each of those would have been a rewrite.

**Monorepo boundaries enforced by dependency direction.** Only the analysis service imports machine-learning libraries. The admin CLI and the Android app never touch Postgres, R2, or the queue directly; they go through APIs. That's why an analysis container with a 12 GiB model could move off-box without touching anything else, and why the Android client can be a pure client.

**Measurement gates.** The Detector's evaluation used grouped cross-validation on labelled rows plus a frozen 28-song validation snapshot, so improvements were measured against a fixed read instead of against the same data that inspired each change. That discipline — a frozen set, a stated metric — is the reason the lyrics work has numbers worth quoting at all. The artifact is [Detector 2.0.0](/posts/lrc-detector-2-0-0).

## What I'd change

**Two TUI generations before the web app.** The first interface was a Textual app; the second replaced it; both were then superseded by the web app, and both are now marked deprecated in the repository's own analysis. Two intermediate interfaces is one and a half too many. The lesson isn't "don't build a TUI" — the TUI was useful for testing pipeline stages. It's that a terminal interface for a phone-first workflow was a category error, and I spent months discovering it.

**Turso → Neon.** The original data layer was SQLite-compatible and hosted; the cutover to Neon Postgres needed a 748-line runbook in its fourth version, new client stacks (psycopg3 for the workers, Drizzle for the web app, psycopg2 in one legacy path), and a pgvector migration. Postgres was the right destination. Picking it at phase 1 would have removed an entire phase.

**rclone for R2 backup, rejected on measurement.** I benchmarked rclone against boto3 before adopting it. Across configurations rclone hit 0.38×–0.72× boto3's throughput. The interesting part was why. R2 imposes an account-level aggregate throughput cap around 5–7 MiB/s on this workload, so adding workers past about eight doesn't help. Going from 8 workers to 32 made throughput _worse_, from ~7.3 MiB/s down to ~5.0 MiB/s, because the fixed cap got sliced into more streams with more protocol overhead. Good outcome for the process (measure, then decide), and a reminder that parallelism is a resource-allocation decision, not a dial.

**Design-document overreach.** The original transition-system design specified madmom, pyrubberband, Celery, Redis, sub-2-second transition rendering, and 95% of transitions automatic. What shipped is All-in-One plus a separate downbeat app, an in-memory queue with a SQLite store, and deterministic recommendations a human accepts or overrides. The spec wasn't wrong about what would be nice. It was wrong about what a solo project could maintain, and every one of those components would have added a failure mode to a path that already had enough.

**A README that documented SSE for a polling implementation.** The web app's README lists a server-sent-events progress endpoint. The route doesn't exist; the client polls every 10 seconds. Cheapest possible class of error, and the most corrosive: a reader who trusts the docs loses an hour before concluding the docs are wrong, and then trusts everything else less.

**Parameters that reached the UI without reaching the renderer.** `keyShiftSemitones` and `tempoRatio` are persisted, editable, and displayed, and the render worker applies neither. A saved plan promises a transposition the audio never delivers. I wouldn't ship a control whose value can't change the output.

**Two pipelines, one gap-placeholder feature.** The deterministic gap-placeholder pass that fixes stale lyrics during instrumental passages is implemented only on the YouTube transcript path, not on the ASR paths. It's recorded as a deliberate follow-up in its own decision record, and I never followed up. The ASR paths are exactly the ones with timing gaps.

**The Qwen3 tail experiment.** Recovering lyrics for a tail the caption track missed triggered on 36 of 62 jobs and recovered at least one line on 22 of them (61%, 43 lines total). But the Qwen3 path produced junk on 26 of 36 attempts — 72% — and Whisper cost about 42.6 seconds of transcription per recovered line. The verdict was "keep both, the Qwen3 tail path is the weak link", which is an honest conclusion and also an admission that the feature half-works.

## By the numbers

| Measure                              | Value                                  | Source                      |
| ------------------------------------ | -------------------------------------- | --------------------------- |
| Scraped catalog rows                 | 685                                    | Migration handover report   |
| Active songs after dedup             | 581                                    | Same                        |
| Soft-deleted duplicate rows          | 104 (~15.2%)                           | Same                        |
| Recordings in catalog                | 444                                    | Scrape audit, 2026-10-22    |
| Visibility split                     | 74 published / 370 review              | Same audit                  |
| Usable songset pool                  | ~438 songs                             | Constructor eval traces     |
| Precomputed transition pairs         | 191,406                                | Same traces                 |
| Recordings with component themes     | 312 / 444 (70.3%), measured 2026-09-11 | Constructor guide           |
| Architecture decision records        | 11                                     | `docs/adr/`                 |
| Versioned specs                      | 486                                    | `specs/`                    |
| Vitest files (web app)               | 154                                    | `delivery/webapp` test tree |
| Tail-fill jobs triggered / recovered | 36 / 22 (43 lines)                     | Tail recovery report        |
| Worst measured instrumental gap      | 67.1 s                                 | Same report                 |
| Migration runbook length             | 748 lines (v4)                         | `specs/`                    |

Three of these need a caveat. The 70.3% component coverage is a measurement from a specific date, not a property of the system — it improves as analysis runs. The visibility split comes from the repo's own audit and doesn't reconcile with an earlier count I published, so I'm citing the audit and its date instead of deriving a number. And "versioned specs" counts files, not decisions; plenty of them are superseded versions of the same design.

## What's next

**Timbre as a compatibility factor.** Every harmonic and tempo measure in the transition engine describes pitch and time. Nothing describes _sound_, and two songs a fourth apart with radically different production can still clash. Timbre distance is the largest missing signal.

**Spectral clustering inside chorus-to-chorus overlaps.** The current engine assumes a transition happens at a section boundary. That's right most of the time and wrong for the case that matters most: going from the end of one chorus straight into the start of another. The best join point inside that overlap is a search problem, not an assumption.

**A bad-transition filter that can explain itself.** "Closeness sounds bad" is a real phenomenon and I can't yet say why. A filter that flags a transition _and_ reports which feature made it sound close would turn a heuristic into something diagnosable.

**Hybrid semantic search.** The catalog has lexical search over a weighted `tsvector` and vector search over embeddings, combined at the application layer. Reciprocal-rank fusion is the obvious next step, and it's the kind of change that's easy to measure.

**Six-plus song templates, and non-Chinese languages.** The five-phase arc has no defined template above five songs, so long services can't be expressed. And the whole architecture — Traditional Chinese canonical, pinyin as a normalization bridge, the honorific handling — is a worked example of what another language would need.

**Gap placeholders on every path.** The smallest item on this list and the one with the clearest user-visible payoff.

## Closing

The system is open source: [mhuang74/stream_of_worship](https://github.com/mhuang74/stream_of_worship). The [user guide](https://streamofworship.com) covers the worship-leader workflow, and the [series introduction](/posts/sow-intro) maps every post in this sequence.

If there's one thing this project taught me, it's that the interesting engineering was almost never where I expected it. I thought the hard part would be the DSP. The hard part was identity: stable song IDs, content-hashed recordings, provenance that survives a cache purge, and a state machine that can say "I don't know" instead of guessing. The DSP is mostly librosa and FFmpeg calls, and I'd write those the same way again.

The second thing it taught me is that honesty in a system is a feature, and it's usually the cheapest one to add. Every failure in this series I could fix cheaply, I fixed by making the system _admit_ something: a warning that names the missing boundary tempo, a taxonomy that separates full analysis from partial, an index that says "review" instead of "published", a README that should have said "polling." Where I let the system imply more than it delivered — a transposition knob that shifts nothing, a streaming endpoint that doesn't stream — the cost wasn't in the code. It was in the next reader's trust.

Source: [DEVELOPER.md roadmap](https://github.com/mhuang74/stream_of_worship/blob/main/DEVELOPER.md) · [deprecation analysis](https://github.com/mhuang74/stream_of_worship/blob/main/docs/deprecation_analysis.md) · [TODO](https://github.com/mhuang74/stream_of_worship/blob/main/TODO.md)
