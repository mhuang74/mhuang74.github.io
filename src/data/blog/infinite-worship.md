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
description: "Rebuilding the Infinite Jukebox for worship music after the original analysis API disappeared"
---

I wanted to try the [Infinite Jukebox](https://eternalboxmirror.xyz/jukebox_index.html) idea with Chinese worship music. The original project could turn a song into an endless remix by jumping between similar beats. But the public audio analysis API it depended on is no longer available, so I had to rebuild that part myself.

The result is [Infinite Worship](https://infinite-worship.vercel.app), a web app that keeps a song playing by jumping between beats that sound alike. A song can be uploaded or imported from the catalog. It is analyzed once, then the player can keep choosing different paths through it. The [source code](https://github.com/mhuang74/infinite-worship) is also available.

<!-- more -->

## How the playback works

The basic idea is to treat a song as a graph of beats. When the player reaches a beat with other similar beats, it may jump to one of them instead of continuing normally.

Nothing too sophisticated on the playback side. I ended up with a few rules:

- Beats are the atomic unit. A jump replaces the next beat. Audio is never stretched.
- Match the beat you were about to play. The candidate must match the next beat's cluster, segment position, and measure position.
- Analyze once, jump forever. The result is cached by content hash.
- Randomize the path, bound the randomness. A jump rolls a 15 percent chance per beat, gated to at least 8 beats since the last jump, and no candidate closer than 16 beats away.
- Handle the start and end. The last 16 beats fade out while the first 16 fade in over the first 8 beats.
- If lyrics are available, only jump within 500 ms of a line boundary.

The jump is a hard cut, not a crossfade. It works when the replacement beat sounds close enough to the beat that was supposed to play next. The player schedules one beat at a time with a small lookahead buffer. If the browser falls behind, it skips forward instead of trying to schedule audio in the past.

## Replacing the missing analysis API

The original [Infinite Jukebox](https://eternalboxmirror.xyz/jukebox_index.html) used Spotify [Audio Analysis API](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis) that returned beats, sections, segments, timbre, and other analysis for a song. New apps can [no longer use](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api?trk=public_post_comment-text&utm_source=chatgpt.com) those audio analysis endpoints. Without that data, the hard part is figuring out which beats are safe to connect.

Based on the Spectral Clustering technique from [Brian McFee](https://speakerdeck.com/bmcfee/analyzing-song-structure-with-spectral-clustering), I run the analysis myself using [librosa](https://librosa.org/), [madmom](https://github.com/CPJKU/madmom), and [scikit-learn](https://scikit-learn.org/). They run inside a containerized worker because analyzing one song can take a few minutes. Results are cached by the audio hash, so the same audio file only needs to be analyzed once even when uploaded by different people.

## Turning audio into a jump graph

Here is the rough analysis flow:

1. Load the audio and trim silence.
2. Compute a constant-Q transform.
3. Detect beats and downbeats.
4. Combine the audio features into one vector per beat.
5. Build and smooth a similarity graph.
6. Combine repetition and sequence information.
7. Cluster the graph and generate jump candidates.

The number of clusters took some tuning. Using only the silhouette score produced clusters that looked clean mathematically, but sometimes left the player with almost nowhere to jump. Too few clusters had the opposite problem and allowed too many questionable jumps. So the fitness function also rewards a result that has useful jump choices.

## What the catalog taught me

Testing with real Chinese worship songs exposed one obvious problem. A jump could leave or land in the middle of a sentence. The audio transition might sound fine, but the resulting lyric made no sense. You don't notice this with dance and rock songs playing forever in the background, but using the same technique to extend worship songs where lyrics meaning carry significant weight interrupts the worship experience.

I added a filter that keeps jumps close to lyric line boundaries. It helped, although less than I hoped. There were fewer broken sentences, but a clean lyric boundary did not automatically make a jump keep the flow going, even for faster worship songs. 

Slower songs with sparse arrangements tend to have fewer interchangeable beats. Faster, simpler, and more repetitive songs usually work better. I think song selection may matter as much as more algorithm tuning. Some songs just may not be a good fit for infinite playback.

## What still breaks

There are still quite a few limitations.

The analysis assumes four beats per measure, so songs in other time signatures get weaker jump candidates. There is no key or tempo normalization. Songs with little repetition may not produce enough candidates at all.

On the engineering side, analysis takes minutes instead of milliseconds. The audio dependencies are also a bit fragile, and browser scheduling can only be so precise. Content hashing avoids repeated work, but it is not access control. Changing the DSP parameters also does not invalidate old cached results yet.

My next step is probably a song suitability check before analysis. It seems more useful to warn that a song is a poor fit than to keep adjusting jump probability for a song that was never going to work well.

## Try it out

Hit the Zen Mode Full Screen button for the cool visualization!

If you don't know which song to pick, just click the "Let if flow" link.

[Infinite Worship webapp](https://infinite-worship.michaelhuang.xyz/)
