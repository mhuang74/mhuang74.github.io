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
description: "A lyrics detector that finds broken timed files, and the three errors it caught."
---

The Stream of Worship catalog currently has hundreds of recordings whose lyrics files are marked for review. Every one needs a human to decide whether the timed lyrics are good enough to put on screen. The hard part was never rendering the lyrics video. It's finding the broken files first.

An LRC is a plain text file where each lyric line starts with a timestamp. The detector's job is narrow: given one recording's LRC, its transcript, and optionally a beat grid, return a score. At or above 0.65, the recording is called poor. That's a triage tool, not a general lyrics checker, because the thresholds and features assume this repertoire.

This post is part of [Stream of Worship, a series](/posts/sow-intro), but it stands alone. It covers how the detector works and three errors it caught.

<!-- more -->

## How it works

Verdict, confidence, subtype, evidence. That's the output. Confidence is the ranking score, verdict is the score pushed through the cut, and subtype is `text`, `timing`, or `both`.

1. **Parse the LRC.** Sort the timestamped lines and count them. A row whose entire text is a free-worship marker (`自由宣告` / `自由敬拜`) gets blanked, because it marks an unscripted section, not a lyric.

2. **Text-only features.** 23 numbers from the LRC alone: duplicate and repeated lines, gaps, implied line durations, timestamp inversions and overlaps, encoding damage, coverage of the audio duration. They produce `a_score`.

3. **Clean the transcript.** Drop segments that look machine-invented: watermark text, probable silence flagged at low confidence, or one short phrase repeated to fill a segment.

4. **Align lyrics to sung text.** An ordered span dynamic program matches blocks of 1–2 lyric lines to blocks of 1–5 consecutive transcript segments, scoring with fuzzy string similarity. Matches are monotone: order preserved, no reuse.

5. **Apply the pairing prior.** If a matched block starts more than 8 s from its lyric stamp while the same words are also sung near the stamp, penalize the far match so the near one wins. Without it, the aligner happily matches a line to a much later repetition of the same chorus.

6. **Audio-grounded features.** 18 numbers from the alignment: fraction of lines matched, median and spread of offsets, drift per minute, sung time with no lyric scheduled, and distance from stamps to the nearest beat. They produce `b_score_fb`.

7. **Score twice.** A logistic regression over all 43 features gives `model_risk`; the fitted constants are embedded, so inference is a numpy dot product and a sigmoid. Separately, five hand-built evidence components — content mismatch, drift, absolute offset, scattered timing, duplicate mismatch — are blended with fixed weights into `evidence`.

8. **Fuse.** On audio rows, `confidence = max(model_risk, evidence)`.

9. **Apply the quiz floors.** A quiz is a pre-computed sidecar that asks an audio model a question about the recording, so it is independent of the text-alignment machinery above. The base quiz asks, per key lyric line, whether that line is audible anywhere in the recording; the share of key lines absent from the audio gives `q_risk = 1 − q_key_frac`, which can only raise the score. The second sidecar probes single lines: it cuts a short audio clip around one lyric line, shows the audio model that line plus a decoy, and asks which one is sung. Rejecting the line twice at confidence ≥ 0.90 — the original probe plus two independent repeats, three votes — confirms the mismatch, floors confidence at 0.99, and the gate classifies the line as a `text` or `timing` defect from where the line's text actually appears in the transcript.

10. **Decide.** At or above 0.65 the recording is `poor`, with a subtype when the evidence rule and the quiz gate disagree on which kind of defect it is.

## Three errors the detector caught

These three rows are unlabelled queue items, checked against the same transcript the detector sees. The excerpts are verbatim ASR output, including its recognition errors. They show what a flag looks like, not accuracy.

### 1. The LRC is for a different song

`1862ddfb0e81`. The LRC reads `[00:30.68] 藏我在 翅膀蔭下`; the transcript at the same times sings `安静 / 让平安入我心`. Verdict: `poor`, confidence 1.0000, subtype `text`. Evidence: `content_mismatch: only 0% of LRC lines match the vocals transcript`, `q_risk=1.0000`. Zero matched lines and a fully rejected quiz is what "wrong file" looks like.

### 2. One line stamped 22 times while the real lyric is different

`0bd7ae0bf08d`. The LRC repeats `祢是配得讚美` 22 times across about six minutes; the transcript actually sings `亲爱的神灵来充满我的心` (the ASR renders 圣灵 as 神灵). Verdict: `poor`, confidence 0.9531, subtype `both`. Evidence: `consec_duplicates: 19 consecutive duplicate lines`, `content_mismatch: only 32% of LRC lines match the vocals transcript`, `localized_timing: 100% of matched lines off by >1s between 279s and 369s`. The file takes the ending refrain and stretches it over the whole recording, missing the first four minutes of real lyric.

### 3. The file stops before the song repeats

`4c398f507da0`. The LRC has 16 lines ending at `[02:06.01] 不要收回祢的聖靈`; the chorus repeats from about 191 s onward with nothing scheduled. Verdict: `poor`, confidence 0.8510, subtype `both`. Evidence: `missing_lines: 45% of vocal time has no lyric line`, `localized_timing: 100% of matched lines off by >1s between 102s and 192s`. Every quoted line exists and roughly matches; the defect is coverage and drift in the second half. The pairing prior matters here specifically: the previous version matched the final chorus to the first one and declared the whole file shifted by −137.53 s.

## Work in progress

Working through the ranked songs, I've confirmed that those with very high suspect scores indeed have LRC issues. But the list is long, and only by working through the entire 300+ songs backlog would I know how well the detector works.
