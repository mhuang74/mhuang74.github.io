---
title: Stream of Worship, a series
author: Michael Huang
pubDatetime: 2026-05-05T00:00:00Z
slug: sow-intro
featured: false
draft: false
tags:
  - building
  - stream-of-worship
description: Introducing a series on building Stream of Worship, a system for seamless Chinese worship music transitions
---

Small group leaders have a dilemma. We want worship to be as powerful as Sunday service, but all we have are Youtube videos with lyrics. What happens _between_ the songs? There's a prolonged and awkward silence. An ad may interrupt. The next song starts from a cold stop in a different key. For English-language worship there are plenty of tools. For Chinese worship music there's basically nothing. How do I find compatible songs and create a smooth lyrics video for all the songs?

[Stream of Worship](https://streamofworship.com) is my attempt to fix that. It analyzes songs, strings them into smooth transitions, and renders ready-to-play audio and lyric videos. A worship leader goes from "here is my song list" to a seamless, offline-capable set.

This post kicks off a series on how it's built.

<!-- more -->

## What it does

At its core, it answers one question: given a set of Chinese worship songs, produce a single continuous playback where each song flows into the next without a hard stop.

Four things get it there:

1. Builds the catalog. A scraper pulls the song catalog, audio gets deduplicated by content hash, and everything lands in a shared database with object storage holding audio and rendered files.
2. Analyzes every recording. A GPU-heavy service produces tempo, key, sections, and stems. Lyrics get generated through a fallback pipeline into LRC files.
3. Plans the set. Transitions get judged on musical boundaries, not averages. Sets follow a fixed five-phase worship arc, and an agentic constructor proposes orderings that fit.
4. Renders and delivers. A serverless worker mixes crossfaded audio and encodes a synchronized lyrics video. The web app has the editor, playback, projection, search, and offline support. There's a native Android client too.

The goal is to empower the small group worship leaders:

- interactively browse, discover, preview songs with lyrics
- introduce unfamiliar songs with audio version of worship songset
- generate worship-ready lyrics videos with accurate lyric transitions
- playback pre-downloaded lyrics video without network
- cast lyrics to large screen TV via Chromecast
- share lyrics videos on social media

## Where it stands

The project has been through roughly ten build phases and is past the "does it work" stage.

- Catalog, audio, and analysis pipelines are operational.
- The web app is the primary interface.

Coming later in this series: offline worship playback on downloaded sets, and a native Android client over the same APIs. Still to come after that: better transition quality, hybrid semantic search, a video template marketplace, and languages beyond Chinese.

## The series

Here's the plan for the posts, roughly in pipeline order:

1. [Why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard).
2. [Building the catalog](/posts/sow-catalog).
3. [The analysis pipeline](/posts/sow-analysis-pipeline).
4. [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline).
5. [The transition engine](/posts/sow-transition-engine).
6. [The songset constructor](/posts/sow-songset-constructor).
7. [The web app architecture](/posts/sow-webapp-architecture).
8. [Offline worship playback](/posts/sow-offline-playback).
9. [Going native: the Android client](/posts/sow-android-client).
10. [Ten build phases: what Stream of Worship taught me](/posts/sow-retrospective).

One more post follows the retrospective: [Detector 2.0.0: catching bad Chinese worship lyrics](/posts/lrc-detector-2-0-0). It covers the quality gate that runs over the lyrics these pipelines produce.

Most posts stick to what's actually in the repo: the pipelines, the things that broke, and the numbers I can defend. If this sounds like your problem too, the code is open source and the [user guide](https://streamofworship.com) covers the worship-leader workflow.

Next up: [why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard).
