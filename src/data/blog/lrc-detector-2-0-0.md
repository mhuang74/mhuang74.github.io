---
title: "Detector 2.0.0: catching bad Chinese worship lyrics"
author: Michael Huang
pubDatetime: 2026-10-06T00:00:00Z
slug: lrc-detector-2-0-0
featured: false
draft: false
tags:
  - lyrics
  - machine-learning
  - stream-of-worship
  - python
description: "A lyrics detector that finds broken timed files on a frozen held-out read, and the errors it catches."
---

The Stream of Worship catalog currently has hundreds of recordings whose lyrics files are marked for review. Every one needs a human to decide whether the timed lyrics are good enough to put on screen. The hard part was never rendering the lyrics video. It is finding the broken files first.

An LRC is a plain text file where each lyric line starts with a timestamp. The detector's job is narrow: given one recording's LRC, its transcript, and optionally a beat grid, return a score. At or above 0.65, the recording is called poor. That is a triage tool, not a general lyrics checker, because the thresholds and features assume this repertoire.

This post is part of [Stream of Worship, a series](/posts/sow-intro), but it stands alone. It covers how the detector works, how it was selected, and what it catches.

<!-- more -->

## How it works

Verdict, confidence, subtype, evidence. That is the output. Confidence is the ranking score, verdict is the score pushed through the cut, and subtype is `text`, `timing`, or `both`.

Parsing the LRC is step one. Timestamped lines get sorted and counted.

Audio-grounded alignment runs next. The aligner matches blocks of lyric lines to blocks of transcript segments, monotone and without reuse. A pairing prior penalizes a match that starts far from the stamp when the same words are also sung near it.

A small trained model scores the recording on top of those features, and a hand-built evidence score gets maxed with it.

One thing to keep straight: promoting the detector did not change the default review queue. Those are separate consumers of the same code.

## How it was selected

Every candidate had to pass two gates. First, cross-validation on a labelled training pool, grouped by song so no leakage. Second, one read on a frozen snapshot of 28 held-out songs, scored under one script with the rules frozen before the read.

The selection sweep chose the cut from the average of several training repeats, not from a single seed. That removed the temptation to tune on one noisy seed.

On that frozen read, the new detector ranked better, found more true problems, produced fewer false alarms, and described the defect more accurately than the previous version. That is the official result.

Three limits belong in the same breath. This is a second look at the same snapshot, so a pass on used data is weaker evidence than a pass on fresh data. The sample is small, and a handful of rows move the numbers. The training pool ranking is not interchangeable with the frozen snapshot.

What I also ran: two batches of real review worklists, unlabelled. Those are application runs, not accuracy measurements. They show the detector asks for more review than before, in both directions, on rows nobody has labelled yet.

## What it catches

Three examples are enough.

The LRC is for a different song. Zero matched lines, fully rejected quiz, and the transcript sings a different text. The detector calls it poor and marks it as a text defect.

One line stamped many times while the real lyric is different. Duplicate spam plus a wrong section. The detector calls it poor and marks both text and timing.

The file stops before the song repeats. Every quoted line exists, but coverage fades in the second half and timing drifts. The pairing prior catches it. The previous version matched the final chorus to the first one and declared the whole file shifted.

## What is and is not proven

The detector is better on the official read. Ranking, recall, and false alarms all improved.

What is not proven is the size of that advantage. The read is a second look at used data, on a small sample. The batch runs show more review requests, not a better accuracy estimate.

The next step that adds information is human labels on the review rows, not another threshold tweak.
