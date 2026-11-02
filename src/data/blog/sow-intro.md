---
title: Stream of Worship — a series
author: Michael Huang
pubDatetime: 2026-09-26T00:00:00Z
slug: sow-intro
featured: false
draft: false
tags:
  - building
  - stream-of-worship
description: Introducing a series on building Stream of Worship, a system for seamless Chinese worship music transitions
---

Every Sunday, worship teams hit the same small, nagging problem: what happens _between_ the songs? Someone fumbles with a laptop, there's an awkward silence, the congregation drifts out of the mood the last song built, and then the next song starts from a cold stop. For English-language worship there's no shortage of tools. For Chinese worship music (中文敬拜詩歌) there's basically nothing — the catalog, the lyrics, even the audio sources live in scattered places with no tooling at all.

[Stream of Worship](https://streamofworship.com) is my attempt to fix that: a system that analyzes songs (tempo, key, structure), strings them into smooth transitions, and renders ready-to-play audio and lyric videos. A worship leader goes from "here's my song list" to a seamless, offline-capable set.

This post kicks off a series on how it's built.

<!-- more -->

## What Stream of Worship does

At its core, SOW answers one question: _given a set of Chinese worship songs, produce a single continuous playback where each song flows into the next without a hard stop._

Four things get it there:

1. **Builds the catalog.** A scraper pulls the song catalog (title, composer, lyricist, album, key, lyrics) from [Stream of Praise (讚美之泉)](https://www.sop.org/), audio is sourced and deduplicated by content hash, and everything lands in a shared PostgreSQL database with object storage (Cloudflare R2) holding the audio, stems, and rendered files.

2. **Analyzes every recording.** A GPU-heavy analysis service runs structural analysis (beats, downbeats, section boundaries), key and tempo detection, and stem separation (vocals, drums, bass, other). It also generates time-synced lyrics through a fallback pipeline — YouTube transcripts first, then cloud ASR, then local Whisper — refined with LLM line alignment, with a forced-alignment job available as a second pass, into LRC files.

3. **Plans the set.** Transitions between adjacent songs are judged on musical boundaries, not whole-song averages: the key a song _leaves through_ against the key the next one _arrives through_, boundary BPM, and an energy arc. Sets follow a fixed five-phase worship arc (讚美 → 感恩 → 敬拜 → 奉獻 → 差遣), and an agentic songset constructor does constrained search over the song pool to propose orderings that fit.

4. **Renders and delivers.** A serverless render worker mixes the crossfaded multi-song audio (MP3) and encodes a synchronized lyrics video (MP4) with chapter markers. The web app has the songset editor, the render pipeline, a playback controller with second-screen projection (Presentation API / Google Cast), lyric review, semantic search over the catalog, and offline playback via a service worker. There's a native Android client too.

The end goals, straight from the project README:

- Generate audio files containing multiple songs with smooth transitions between songs
- Generate video files containing lyrics videos of multiple songs with smooth transitions
- Provide an interactive tool to select songs from the library, experiment with transition parameters, and generate output audio/video files
- Provide an admin tool to manage the song library (via scraping sop.org) and perform song analysis and lyrics LRC generation

## Where it stands

The project has been through roughly ten build phases and is past the "does it work at all" stage:

- **Catalog, audio, and analysis pipelines are operational** — scraping, download, dedup, analysis jobs, and LRC generation all run through an admin CLI plus a Dockerized FastAPI analysis service.
- **The web app is the primary interface** (Next.js 16, Neon Postgres with pgvector, Better Auth, Vercel) with render jobs processed by an AWS Lambda worker via SQS.
- **An Android app ships** as a native client over the same JSON APIs, including offline artifact downloads.
- **Offline worship playback works**: a set downloaded to the device plays with zero network — seekable, with lyrics and chapter markers — because venue Wi-Fi is the least reliable thing in the room.

What's still open: better transition quality (timbre as a compatibility factor, smarter transition-point selection inside chorus-to-chorus overlaps), hybrid semantic search ranking, a video template marketplace, and languages beyond Chinese.

## The series

Here's the plan for the posts, roughly in pipeline order:

1. **[Why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard)** — the problem space: what makes song-to-song flow musically difficult, why Chinese worship catalogs need special handling, and what "seamless" has to mean for it to feel right to a worship leader.
2. **[Building the catalog](/posts/sow-catalog)** — scraping sop.org, turning Chinese song IDs into pinyin, content-hash audio deduplication, and the shared Neon Postgres + R2 data layer every other component sits on.
3. **[The analysis pipeline](/posts/sow-analysis-pipeline)** — structural analysis with All-In-One (tempo, beats, sections, embeddings), librosa key detection, Demucs stem separation, and the clean-vocals chain, plus why all of it lives in a Dockerized FastAPI service with its own job queue.
4. **[Synced lyrics from messy sources](/posts/sow-lyrics-pipeline)** — YouTube transcripts, DashScope Qwen3 ASR, and Whisper as fallbacks; LLM line alignment; a forced-alignment second pass; and gap placeholders for long instrumental passages.
5. **[The transition engine](/posts/sow-transition-engine)** — crossfades, beat-aligned gaps, and why boundary keys and BPM (exit component vs. entry component) beat whole-song averages for judging compatibility, plus where key shifting and tempo matching fit in.
6. **[The songset constructor](/posts/sow-songset-constructor)** — encoding worship-leading practice as code: the five-phase arc, theme classification via embedding anchors, energy arcs, hard constraints, and the weighted fitness function.
7. **[The web app architecture](/posts/sow-webapp-architecture)** — Next.js on Vercel, Drizzle + Neon serverless, Better Auth, render jobs through SQS to Lambda, 10-second progress polling, and second-screen projection.
8. **[Offline worship playback](/posts/sow-offline-playback)** — service workers, Cache Storage byte-range serving for 500 MB videos, the IndexedDB index that decides what's playable, and surviving a mid-service network drop.
9. **[Going native: the Android client](/posts/sow-android-client)** — Jetpack Compose over the webapp's JSON APIs, Media3 playback with chapters, and offline downloads via DownloadManager.
10. **[Ten build phases: what Stream of Worship taught me](/posts/sow-retrospective)** — what I'd do differently, what the POC got wrong that production got right, and where the roadmap goes next (timbre matching, smarter transition points, hybrid search).

Already published: **[Detector 2.0.0: catching bad Chinese worship lyrics](/posts/lrc-detector-2-0-0)** — a 43-feature detector for bad timed lyrics.

Most posts stick to what's actually in the repo: the pipelines, the things that broke, and the numbers I can defend. If any of this sounds like your problem too, the code is open source and the [user guide](https://streamofworship.com) covers the worship-leader workflow.

Next up: **[why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard)**.
