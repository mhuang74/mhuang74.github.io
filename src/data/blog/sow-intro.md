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

Every Sunday, worship teams face a small but nagging problem: what happens *between* the songs? Someone fumbles with a laptop, there's an awkward silence, the congregation settles out of the mood the last song built — and then the next song starts from a cold stop. For English-language worship there's no shortage of tools, but for Chinese worship music (中文敬拜詩歌), the catalog, the lyrics, even the audio sources live in scattered places with no tooling at all.

[Stream of Worship](https://streamofworship.com) is my attempt to fix that: a system that analyzes songs (tempo, key, structure), strings them into smooth transitions, and renders ready-to-play audio and lyrics videos — so a worship leader can go from "here's my song list" to a seamless, offline-capable worship set.

This post kicks off a series on how it's built. Think of it as the map for what's coming.

<!-- more -->

## What Stream of Worship does

At its core, SOW answers one question: *given a set of Chinese worship songs, produce a single continuous playback where each song flows into the next without a hard stop.*

To get there, the system does four things:

1. **Builds the catalog.** A scraper pulls the song catalog (title, composer, lyricist, album, key, lyrics) from [Stream of Praise (讚美之泉)](https://www.sop.org/), audio is sourced and deduplicated by content hash, and everything lands in a shared PostgreSQL database with object storage (Cloudflare R2) holding the audio, stems, and rendered files.

2. **Analyzes every recording.** A GPU-heavy analysis service runs structural analysis (beats, downbeats, section boundaries), key and tempo detection, and stem separation (vocals, drums, bass, other). It also generates time-synced lyrics through a fallback pipeline — YouTube transcripts first, then cloud ASR, then local Whisper — refined with LLM alignment and a forced aligner into LRC files.

3. **Plans the set.** Transitions between adjacent songs are judged on musical boundaries, not whole-song averages: the key a song *leaves through* against the key the next one *arrives through*, boundary BPM, and an energy arc. Sets follow a fixed five-phase worship arc (讚美 → 感恩 → 敬拜 → 奉獻 → 差遣), and an agentic songset constructor does constrained search over the song pool to propose orderings that fit.

4. **Renders and delivers.** A serverless render worker mixes the crossfaded multi-song audio (MP3) and encodes a synchronized lyrics video (MP4) with chapter markers. The web app provides the songset editor, render pipeline, playback controller with second-screen projection (Presentation API / Google Cast), lyric review, semantic search over the catalog, and offline playback via a service worker. There's also a native Android client.

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

Here's the plan for upcoming posts, roughly in pipeline order:

1. **Why seamless worship transitions are hard** — the problem space: what makes song-to-song flow musically difficult, why Chinese worship catalogs need special handling, and what "seamless" has to mean for it to feel right to a worship leader.
2. **Building the catalog** — scraping sop.org, normalizing Chinese song IDs to pinyin, content-hash audio deduplication, and the shared Neon Postgres + R2 data layer every other component sits on.
3. **The analysis pipeline** — structural analysis with All-In-One (tempo, beats, sections, embeddings), librosa key detection, Demucs stem separation, and the clean-vocals chain — plus why it all lives in a Dockerized FastAPI service with its own job queue.
4. **Synced lyrics from messy sources** — the LRC generation pipeline: YouTube transcripts, DashScope Qwen3 ASR, and Whisper as fallbacks; LLM line alignment; forced-alignment refinement; and gap placeholders for long instrumental passages.
5. **The transition engine** — crossfades, key shifting, tempo matching, and why boundary keys/BPM (exit component vs. entry component) beat whole-song averages for judging compatibility.
6. **The songset constructor** — encoding worship-leading practice as code: the five-phase worship arc, theme classification via embedding anchors, energy arcs, hard constraints and the weighted fitness function.
7. **The web app architecture** — Next.js on Vercel, Drizzle + Neon serverless, Better Auth, render jobs through SQS to Lambda, SSE progress, and second-screen projection.
8. **Offline worship playback** — service workers, Cache Storage byte-range serving for 500 MB videos, the IndexedDB index that decides what's playable, and surviving a mid-service network drop.
9. **Going native: the Android client** — Jetpack Compose over the webapp's JSON APIs, Media3 playback with chapters, and offline downloads via DownloadManager.
10. **Retrospective** — what I'd do differently, what the POC got wrong that production got right, and where the roadmap goes next (timbre matching, smarter transition points, hybrid search).

Most posts will be grounded in the actual repo — real pipelines, real failure modes, real tradeoffs. If any of this sounds like your problem too, the code is open source and the [user guide](https://streamofworship.com) covers the worship-leader workflow.

Next up: **why seamless worship transitions are hard**.
