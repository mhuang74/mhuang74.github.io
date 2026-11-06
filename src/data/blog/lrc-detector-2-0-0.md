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

## How it works

There are three sides to the detector: a trained model that starts with the LRC text, a hand-built model of common defects, and lyrics quizzing against the recording. The earlier revisions describe the following scoring process.

**The LRC text and alignment model**

An LRC line has a timestamp and text. First, the detector sorts the timestamped lines. A line containing only `自由宣告` or `自由敬拜` gets its text blanked, because it marks an unscripted section rather than a lyric. It then extracts 23 features from the LRC alone: duplicate and repeated lines, gaps, implied line durations, timestamp inversions and overlaps, encoding damage, and coverage of the audio duration. These also produce a summary score, `a_score`.

The text alone can't tell me whether the right words appear at the right time. So the detector also compares the LRC with an automatic speech recognition (ASR) transcript. Before alignment, it drops suspected transcription artifacts such as watermarks, low-confidence silence, and short phrases repeated to fill a segment.

The aligner matches blocks of 1–2 lyric lines with blocks of 1–5 consecutive transcript segments using fuzzy text similarity. It preserves order and doesn't reuse a segment. Repeated choruses make that tricky: the same words can match well in several places. If a match starts more than 8 seconds from the lyric's timestamp while the same words are also sung within 8 seconds of it, a pairing penalty favors the nearby occurrence.

That comparison supplies another 18 features: the share of lines matched, typical timing offset and its spread, the share off by more than 1 or 2 seconds, drift per minute, uncovered vocal time, repeated-line count differences, and distance to the nearest beat when a beat grid is available. These produce `b_score_fb`.

The trained model uses all 43 inputs: the 23 LRC features, 18 alignment features, and the two summary scores. Missing values are filled with training medians, the inputs are standardized, and a fitted logistic regression returns `model_risk` between 0 and 1. The fitted constants are embedded, so scoring only needs a numpy dot product and a sigmoid.

**The hand-built model**

Separately, five kinds of evidence get their own scores between 0 and 1: content mismatch, drift, absolute offset, scattered timing, and duplicate mismatch. Each uses a hyperbolic-tangent curve against reference ranges fixed from an earlier sample. Their weighted sum is `evidence`:

```text
evidence = 0.30 × content_mismatch
         + 0.25 × drift
         + 0.15 × absolute_offset
         + 0.15 × scattered_timing
         + 0.15 × duplicate_mismatch
```

For recordings with audio alignment, the detector takes the higher of `model_risk` and `evidence`. A strong warning from the hand-built model can therefore raise a low trained-model score.

**Lyrics quizzing against the audio**

The ASR comparison above checks lyrics against a transcript. The quiz adds questions to an audio model about the recording itself, with answers saved in pre-computed sidecar files. The base quiz asks whether each key lyric line is audible anywhere in the recording. If `q_key_frac` is the share found, then `q_risk = 1 − q_key_frac` is the share missing.

A second quiz checks individual lines near their timestamps. It cuts a short audio clip, presents the expected line and a decoy, and asks which one is sung. The original probe and two independent repeats give three votes. Two rejections at confidence ≥ 0.90 confirm a mismatch and raise the recording's score to at least 0.99. Where the expected words appear in the transcript helps classify the defect as text or timing.

**The final score**

The quiz scores act as floors. They can raise suspicion, but they can't cancel a warning from the other two models. For a recording with alignment and a readable base quiz, the combination is:

```text
confidence = max(model_risk, evidence, q_risk)
confidence = max(confidence, 0.99)  # if the line quiz confirms a mismatch
```

At **0.65 or above**, the recording is flagged `poor`, meaning Poor LRC quality. Below 0.65, it is called `good`. Poor recordings can also have subtype `text`, `timing`, or `both`; text and timing findings from the evidence rule and quiz gate are combined when they disagree.

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
