---
title: "Infinite Worship: endless playback after the analysis API disappeared"
author: Michael Huang
pubDatetime: 2026-10-20T00:00:00Z
featured: false
draft: false
tags:
  - building
  - infinite-worship
  - music
description: "How I rebuilt the Infinite Jukebox for worship music after the analysis API disappeared, and which songs still fight the method."
---

A worship set has a shape: a list of songs, a start time, and an end. The end is the part nobody designs. The last chorus fades, someone prays, and the room moves on. That is why the interesting question about worship music is not how to make a song longer. It is what happens if a song never has to end at all.

Infinite Worship is a web app that plays a song as an endless remix by jumping between acoustically similar beats. Upload a track or import one from the catalog, and it analyzes the audio once, then walks a graph of interchangeable moments for as long as you leave it running. A jump is not a crossfade or a repeated chorus. It is a hard cut to a beat that already sounds like the beat that was about to arrive. The [live app](https://infinite-worship.vercel.app) and the [source](https://github.com/mhuang74/infinite-worship) are both open.

<!-- more -->

## The five rules

An infinite remix is not a longer song. It is a graph walk that stays inside the song's own vocabulary. Almost everything follows from five constraints, plus one optional filter for lyrics:

- Beats are the atomic unit. A jump replaces the next beat. Audio is never stretched.
- Match the beat you were about to play. The candidate must match the next beat's cluster, segment position, and measure position.
- Analyze once, jump forever. The result is cached by content hash.
- Randomize the path, bound the randomness. A jump rolls a 15 percent chance per beat, gated to at least 8 beats since the last jump, and no candidate closer than 16 beats away.
- Own the edges. The last 16 beats fade out while the first 16 fade in over the first 8 beats, and a lyric filter keeps jumps within 500 ms of a line boundary so the song neither stops nor cuts mid-line.

The first constraint is the load-bearing one. The player schedules one beat at a time, keeps a lookahead buffer, and a slow main thread can make it skip forward rather than schedule audio in the past.

## The API that made this possible, and then did not

The original Infinite Jukebox was a weekend hack built on a public analysis endpoint that returned beat and section data. That API is gone. New apps cannot use the audio-analysis endpoints now. Without that, the analysis that made the original a weekend project is the hard part.

I chose to run it in-house: librosa, madmom, and scikit-learn behind a containerized worker, off the request path. That is where the minutes-long analysis happens. The results are cached by the audio hash, so identical audio uploaded by two different people resolves to one analysis.

## Turning audio into a jump graph

The pipeline is a straight shot from waveform to labeled graph. In order: load the file, trim silence, compute a constant-Q transform, detect downbeats, aggregate to one vector per beat, build the similarity graph, smooth it, combine repetition with sequence, take the graph Laplacian and cluster, then serialize segments and jump candidates.

The tricky part is choosing the number of clusters. Silhouette alone does not work: too many clusters gives clean matches with nowhere to jump. Too few gives promiscuous jumps. The fitness function rewards a segmentation that actually has somewhere to go.

## What the catalog taught me

Testing against a large set of real Chinese worship songs exposed a flaw immediately: a jump could leave or land mid-sentence. Even when the audio seam was invisible, the lyric became a fragment.

The lyric filter fixed that mechanically by forcing jumps to line boundaries, but the effect was smaller than I hoped. Fewer jumps were cleaner, yet not musically inevitable. The problem is worst on slower worship songs with sparse arrangements and fewer interchangeable beats. On faster, simpler, more repetitive material it works better.

So infinite playback is partly a fit problem, not only an algorithm problem. The next step is a gate that decides which songs belong in the infinite-playback set, rather than tuning jump probability for songs that will never work.

## What still breaks

Musical. The measure assumption is four beats per bar, so other meters get weaker candidates. There is no key or tempo normalization, so a jump can land in the wrong key or energy. Songs with little repetition yield few candidates.

Engineering. Analysis is minutes, not milliseconds. The dependency matrix is fragile. Browser scheduling has a floor. Content hashing is not access control. Changing the DSP parameters does not invalidate existing cached analyses.

The project is open source, the app is live, and the next milestone is the song-suitability classifier rather than more probability tuning.
