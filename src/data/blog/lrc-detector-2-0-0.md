---
title: "Detector 2.0.0: finding lyrics files to review first"
author: Michael Huang
pubDatetime: 2026-10-06T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: lrc-detector-2-0-0
featured: false
draft: false
tags:
  - lyrics
  - machine-learning
  - stream-of-worship
  - python
description: "Ranking suspect timed lyrics, with three recorded examples and limits on what they establish."
---

Finding the broken lyrics files first would make the review queue easier to work through. An LRC file can look reasonable in a text editor while showing the wrong chorus or leaving the final minute uncovered.

The detector's job is to rank files for a human to check. It compares timed lyrics with a transcript and, when available, beat and audio-model evidence. It doesn't publish a file or replace listening to the recording.

This post is part of [Stream of Worship, a series](/posts/sow-intro), following the [retrospective](/posts/sow-retrospective).

<!-- more -->

_Verification note, November 6, 2026: the [November 1 source snapshot](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/README.md) doesn't contain the Detector 2.0.0 implementation, fitted model, quiz sidecars, or the evaluation artifacts behind the examples below. The workflow and outputs here are retained from the recorded examples for this post; their exact implementation and scores haven't been independently reproduced. The repository's [TTS round-trip scorer](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/lab/poc-scripts/score_lrc_quality.py) is a different experiment._

## Compare the words and the clock

An LRC line has a timestamp and text. The working detector description separates defects in the words from defects in their timing. Repeated lines, encoding damage, long gaps, and poor coverage are useful clues from the LRC alone. A transcript adds evidence about what was sung and when.

The alignment matches ordered blocks of lyric lines with consecutive transcript segments. It preserves order and avoids reusing a segment. Repeated choruses make that tricky: the same words can match well in several places. A pairing prior prefers a nearby occurrence when the text is also sung near the lyric's timestamp.

The recorded workflow combines a fitted model score with hand-built evidence for content mismatch, drift, absolute offset, scattered timing, and duplicate mismatch. Audio-model quiz sidecars can raise suspicion when they reject a line. A recording is flagged `poor` at a score of 0.65 or above in these examples, with subtype `text`, `timing`, or `both`.

I use that score to order review. `confidence: 0.95` shouldn't be read as a demonstrated 95% chance that a file is bad. That would need a labeled evaluation and calibration results. The same transcript contributing to a score and explaining it isn't independent confirmation either.

## Three recorded flags

These were unlabelled queue items compared with the transcripts used by the detector. The ASR excerpts preserve recognition errors. They're examples of suspicious files, not an accuracy sample.

**A different song's lyrics**

For `1862ddfb0e81`, the LRC contains `[00:30.68] 藏我在 翅膀蔭下`, while the transcript at that part reads `安静 / 让平安入我心`. The recorded verdict is `poor`, score 1.0000, subtype `text`. It reports no matched LRC lines and quiz risk 1.0000.

That is a useful file to inspect first. The flag suggests the wrong lyrics were attached; confirming that diagnosis still requires the recording and source file.

**An ending refrain across the whole recording**

For `0bd7ae0bf08d`, the LRC repeats `祢是配得讚美` 22 times across roughly six minutes. The transcript includes `亲爱的神灵来充满我的心`, with ASR rendering 聖靈 as 神灵. The recorded score is 0.9531, subtype `both`.

The evidence lists 19 consecutive duplicates, only 32% of lines matching the transcript, and timing errors among matched lines between 279 and 369 seconds. Repetition alone is normal in worship music. Repetition that omits the other sung material is the reason to review this file.

**The repeated chorus is missing**

For `4c398f507da0`, 16 LRC lines end at `[02:06.01] 不要收回祢的聖靈`. The recorded transcript comparison finds another chorus from about 191 seconds with no lyrics scheduled. The score is 0.8510, subtype `both`, with 45% of vocal time reported uncovered.

The earlier comparison recorded an apparent −137.53-second shift after matching the wrong chorus occurrence. That illustrates why repeated text needs a timing prior. Without the earlier and later evaluation artifacts, I can't claim a reproduced fix or quantify its improvement.

The useful next measurement is a human-labeled review sample, including low-scoring files. Checking only the top of the list can show that it finds some bad files. It won't tell me how many it misses.
