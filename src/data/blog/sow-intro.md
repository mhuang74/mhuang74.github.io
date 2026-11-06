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

I want to make worship in small groups flow more like Sunday service. But when all we have are YouTube videos with lyrics, there's often an awkward silence between songs. An ad may interrupt. The next song starts in a different key. There are plenty of tools for English-language worship, but I've found very little for Chinese worship music. How do I find compatible songs and create one lyrics video for the whole songset?

[Stream of Worship](https://streamofworship.com) is my attempt at this. It analyzes songs, creates transitions between them, and renders audio and lyrics videos. The idea is to give it a song list and get a continuous worship set that can also play offline.

This is the first in a series of posts on how it's built.

<!-- more -->

## What it does

Given a set of Chinese worship songs, I want to play them continuously, with each song flowing into the next without a hard stop.

There are four main parts:

1. Build the catalog. A scraper collects the song catalog, and content hashes identify duplicate audio. A shared database holds the records, while object storage holds audio and rendered files.
2. Analyze the recordings. A service makes heavy use of GPUs to find tempo, key, song sections, and stems. The lyrics pipeline tries several sources to produce LRC files.
3. Plan the songset. The transition engine checks the musical boundaries where songs join, rather than relying on song-wide averages. An AI agent proposes song orders that follow a fixed five-phase worship progression.
4. Render the songset. A serverless worker crossfades the audio and renders a video with synchronized lyrics. The web app provides editing, playback, projection, search, and offline support. There's a native Android client too.

I want small group worship leaders to be able to:

- browse, discover, and preview songs with lyrics
- introduce unfamiliar songs using an audio version of the songset
- generate lyrics videos with lyrics that change at the right time
- play downloaded lyrics videos without a network connection
- cast lyrics to a large-screen TV via Chromecast
- share lyrics videos on social media

## Where it stands

I've worked through roughly ten phases of building this so far.

- The catalog, audio, and analysis pipelines are working.
- The web app is the primary interface.

Later posts cover offline playback of downloaded songsets and a native Android client using the same APIs. There's still more I want to work on: better transitions, hybrid semantic search, a video template marketplace, and support for languages beyond Chinese.

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

One more post follows the retrospective: [Detector 2.0.0: catching bad Chinese worship lyrics](/posts/lrc-detector-2-0-0). It covers how I check the lyrics these pipelines produce for errors.

Most posts cover what I've built so far, what broke, and what I learned. The code is open source. If you'd like to try it for your small group, the [user guide](https://streamofworship.com) explains how to put a songset together.

Next up: [why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard).
