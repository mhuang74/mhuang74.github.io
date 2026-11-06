---
title: "Why seamless worship transitions are hard"
author: Michael Huang
pubDatetime: 2026-05-19T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-why-transitions-are-hard
featured: false
draft: false
tags:
  - stream-of-worship
  - building
  - worship
description: "What I need to know about two recordings before joining them into a worship set."
---

I want Stream of Worship to join Chinese worship recordings into a set that a small group can play without managing a browser between songs. A crossfade helps with the silence. It doesn't tell me whether the next song starts in a compatible key, or whether two voices will overlap.

So before building a mixer, I needed to decide what makes a useful transition. Nothing as ambitious as replacing a worship leader's judgment. I just want the software to catch some poor combinations and make the remaining ones easier to audition.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Series introduction](/posts/sow-intro). Next: [Building the catalog](/posts/sow-catalog).

<!-- more -->

## Start with the two ends

A catalog usually gives me one key for a song. A recording can change key before its final chorus. Comparing that recording's opening key with the next song's opening key misses the part I'm actually joining.

Tempo has the same problem. A whole-track estimate is useful for browsing, but a slow intro and a faster ending need separate estimates if I'm going to compare them. Section boundaries matter too. Overlapping two instrumental passages is a different edit from overlapping two choruses.

The [boundary comparison code](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/transitions.py) added in September uses an exit key and an entry key when both are available. Otherwise it compares song-level keys on both sides. Keeping those sources visible helps explain a recommendation. It doesn't make the estimates correct.

## A set needs more than compatible pairs

I use a five-phase arc: call, thanksgiving, worship, response, commission. That's the shape I chose for this tool. Other services may need something different.

The constructor favors a stronger opening and a calmer closing, with themes and lyrical posture helping place songs along the way. A song addressing God and a song asking the congregation to respond may have similar musical features but different uses in a set.

These are rules I can encode and adjust. They aren't facts an audio model can discover on its own, and passing them doesn't establish that a set will work for a particular congregation.

## The source data needs work first

For the catalog I started with, [Stream of Praise’s song table](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/scraper.py) supplies titles, credits, keys, and plain lyrics. It doesn't supply synchronized lyrics or the theme labels the constructor needs.

Traditional Chinese is the project's canonical text. Other sources may use Simplified Chinese, and pinyin needs a small correction for the honorific 祢. These details affect search and matching before any musical decision happens. They're problems in this catalog, rather than reasons to assume all Chinese music tools have the same limitations.

## What I mean by seamless

I want a continuous audio or video file, with transitions I can listen to before using it. Lyrics should clear during a long instrumental instead of leaving the previous line on screen. And a prepared download should play without a network connection, including when the player starts offline.

Those are goals for the whole workflow. The implementation still has gaps. As of November 1, the renderer applies gaps and crossfades, but doesn't apply the stored key-shift or tempo-ratio settings. A recommendation to transpose is therefore something to review, not evidence that the rendered audio changed key.

The work has to happen in order: identify the recording, analyze it, align its lyrics, compare transitions, then render and deliver the set. Next is [building the catalog](/posts/sow-catalog), starting with IDs that survive another scrape.
