---
title: "Detector 2.0.0: catching bad Chinese worship lyrics"
author: Michael Huang
pubDatetime: 2026-11-02T00:00:00Z
slug: lrc-detector-2-0-0
featured: false
draft: false
tags:
  - lyrics
  - machine-learning
  - stream-of-worship
  - python
description: How a 43-feature lyrics detector reached 0.9779 PR-AUC on 28 held-out songs, and what two 50-song review batches showed.
---

## The problem

The Stream of Worship catalog currently has 342 recordings whose lyrics files are marked `visibility_status='review'`. Every one of them needs a human to decide whether its timed lyrics are good enough to put on screen. The hard part was never rendering the lyrics video; it is finding the broken files first. Rendering a bad LRC just produces a confidently wrong video, and a reviewer who has to open all 342 to find the forty bad ones will not get through them.

An LRC is a plain text file where each lyric line starts with a timestamp:

```text
[00:30.68] 藏我在 翅膀蔭下
[00:38.34] 遮蓋我 在祢大能手中
```

The Detector's job is narrow and specific: given one recording's LRC, its ASR transcript, and optionally a beat grid, return a 0–1 poor-ness score. At or above **0.65** the recording is called `poor`. It is a triage tool for Chinese worship songs, not a general lyrics checker — the thresholds, the feature set, and the training data all assume that repertoire.

This post is part of [Stream of Worship — a series](/posts/sow-intro), but it stands alone. It covers what version 2.0.0 is, how it got there under a two-gate discipline, how it scores a recording, what the official held-out read showed, and three concrete lyric-file errors it caught.

<!-- more -->

## What 2.0.0 is

One verdict per recording, as JSON:

```json
{
  "verdict": "good",
  "confidence": 0.4213,
  "subtype": null,
  "evidence": ["..."]
}
```

`confidence` is the ranking score: it is what PR-AUC is computed on and what the review queue sorts by. `verdict` is that score pushed through the **0.65** cut. `subtype` is `text`, `timing`, or `both`, reported only for `poor` rows and only when the audio-alignment path actually ran.

Canonical identity is pinned by four facts: evaluator version **2.0.0**, evaluator file sha256 starting `ceca0fd2931e`, verdict threshold **0.65**, and the frozen scoring harness `evaluate.py` at harness version **1.0.0**.

One thing to keep straight, because it is easy to assume otherwise: promoting 2.0.0 changed the canonical detector, not the review queue. The ad-hoc review-queue command still defaults to **1.6.0** for ranking. Those are separate consumers of the same evaluator code.

## How 2.0.0 was arrived at

Every candidate in this project has to pass two gates, and both are written down before anything is measured.

**Gate A — the training pool.** Grouped 5-fold cross-validation on 171 labelled rows (102 good, 69 poor). Folds are grouped by song hash, so every row from one song lands in exactly one fold; otherwise near-duplicate rows leak across the boundary and the score is fiction. Runs are repeated over four seeds, `20261015..20261018`.

**Gate B — one official read.** The frozen 28-song validation snapshot (14 poor, 14 good, sha `ff362e74…`) is scored once per candidate and paired head-to-head with the current canonical detector, on the same snapshot and the same interpreter. Thresholds and the ship rule are committed to git before the read. A candidate is promoted only if it wins on the pool **and** passes the pre-declared ship rule on the validation read. A failed or tied gate closes the round with no promotion. The check set is never used to choose a variant.

The official reads run with traditional-to-simplified conversion disabled, because the interpreter has no `opencc`. That is deliberate and recorded — a detector that silently changes behaviour depending on which packages happen to be installed is not a detector you can compare versions of.

The version chain, compressed:

| Version / round          | Mechanism                                                                                                                      | Outcome                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1.1.0 (exp_4)            | `confidence = max(model_risk, evidence)` on audio rows; threshold 0.50                                                         | production baseline for the 2.0.0 work                                                                        |
| 1.2.0 (exp_5)            | drop the evidence score, model only                                                                                            | rejected: validation PR-AUC −0.0115 vs 1.1.0                                                                  |
| 1.3.0-thin (exp_6)       | traditional→simplified hard gate + threshold 0.35                                                                              | validation tie 0.9152 with byte-identical confidences; no flip                                                |
| 1.4.0 / 1.5.0 (exp_8–10) | quiz line gate; subtype union repair                                                                                           | validation 1.4.0 exact PR-AUC tie 0.9087; recorded, not promoted                                              |
| 1.6.0 (exp_11)           | free-worship marker normalization (`自由宣告` / `自由敬拜` rows are markers, not lyrics)                                       | kept as a mechanism; review-queue primary                                                                     |
| 1.7.0 (exp_12)           | span-DP pairing prior: penalize a block starting >8 s from its stamp when the same words are sung near the stamp               | training gain, but the pre-declared rule fired `refit`; not ship-eligible                                     |
| 1.8.0 (exp_13)           | 1.7.0 bytes with the embedded logistic regression refit                                                                        | pool +0.054988 mean, 4/4 seeds; no official read spent                                                        |
| 1.9.0 (exp_14)           | 1.8.0 + quiz line gate at 0.60                                                                                                 | pool passed; queue leg failed; no read spent                                                                  |
| exp_15                   | 0.80 quiz-gate scheduling bar + transcript corroboration                                                                       | corroborated the gate; nothing shipped                                                                        |
| exp_16                   | composed stack 2.0.0: token normalization + pairing prior + refit + `q_risk` + quiz gate + subtype union, nested arms A1/A2/A3 | pool A3 0.910467 vs A0 0.802672; official read PR-AUC 0.9779, FP 0, but F1 0.8333 < 0.8462 → **not promoted** |
| exp_17                   | the exp_16 stack with the threshold re-selected across all four seeds instead of one                                           | selected **0.65**; all five ship-rule legs passed → **promoted**                                              |

The exp_16 failure is worth stating plainly, because it is the reason exp_17 exists. At its single-seed threshold of 0.80, 2.0.0 caught 10 of 14 poor songs while 1.1.0 caught 11. Ranking improved, false alarms improved, and the pre-declared F1 leg still failed. exp_17 asked one new question — choose the cut from the average of all four training repeats instead of one — and that sweep picked 0.65. The rule and the five-leg ship rule were frozen before the read; this was not post-hoc tuning.

The sweep facts:

- grid 0.05–0.95 in 0.01 steps; selected cut **0.65**
- mean OOF verdict F1 at 0.65 = **0.826989**; mean OOF false positives = **6.5** (count over 74 good training rows, averaged over four seeds); mean precision 0.853621, mean recall 0.803191
- at 0.80: mean F1 0.805882, mean FP 3.75; at 0.50: mean F1 0.802235, mean FP 13.5
- the selection band is `[0.54, 0.59, 0.63, 0.64, 0.65]`; ties within 0.005 mean F1 go to the highest cut, equivalently the lowest mean FP

## How it works

1. **Parse the LRC.** Collect timestamped lines and `[key:value]` metadata, sort by time, and count lines that are neither as bad lines. A row whose entire text is a free-worship marker (`自由宣告` / `自由敬拜`, bare or bracketed) has its text blanked, because it marks an unscripted section, not a lyric.

2. **Text-only features (Track A).** 23 numbers from the LRC alone: duplicate lines, repeated lines, gaps, implied line durations, timestamp inversions and overlaps, encoding damage, coverage of the audio duration, and related structural checks. These produce `a_score`.

3. **Clean the transcript.** Drop segments that look machine-invented: subtitle watermarks, recogniser-flagged probable silence at low confidence, and one short phrase repeated to fill a segment.

4. **Align lyrics to sung text.** An ordered span dynamic program matches blocks of 1–2 lyric lines to blocks of 1–5 consecutive transcript segments, scoring with fuzzy string similarity (`rapidfuzz` ratio, 0–100). Matches are monotone: order is preserved and no segment is reused.

5. **Apply the pairing prior.** If a matched block starts more than 8 s from its lyric stamp while the same words are also sung within ±8 s of that stamp, subtract a small per-line penalty so the near-stamp occurrence wins. This is the 1.7.0 mechanism. Without it, the aligner happily matches a line to a much later repetition of the same chorus.

6. **Audio-grounded features (Track B).** 18 numbers from the alignment: fraction of lines matched, median and spread of offsets, fraction off by more than 1 s and more than 2 s, drift per minute, sung time with no lyric scheduled, repeated-line count disagreement, and distance from stamps to the nearest beat. These produce `b_score_fb`.

7. **Trained score.** The 43 features (23 Track A + 18 Track B + `a_score` + `b_score_fb`) are median-imputed, standardised, and passed through a logistic regression fitted on the fixed 121-row training split (74 good, 47 poor). Training used `LogisticRegression(C=0.5, class_weight="balanced", max_iter=2000)` behind median imputation and `StandardScaler`; the fitted medians, means, scales and coefficients are embedded as literals. At inference there is no scikit-learn — `numpy` does the dot product and the sigmoid. Ten of the 43 coefficients are exactly 0.0, so those inputs cannot move the score.

8. **Hand-built evidence score.** Five components — content mismatch, drift, absolute offset, scattered timing, duplicate mismatch — are each mapped into 0–1 through a hyperbolic-tangent curve against reference ranges frozen from an earlier sample, then blended with fixed weights: content 0.30, drift 0.25, offset 0.15, scatter 0.15, duplicate 0.15.

9. **Fuse.** On audio rows, `confidence = max(model_risk, evidence)`.

10. **Quiz floors.** A readable base quiz sidecar contributes `q_risk = 1 − q_key_frac`, the share of the quiz's key lines absent from the audio, and it can only raise the score. A second, line-level quiz gate can raise a confirmed mismatch to **0.99**: the base answer plus two independent confirmations form a 3-vote rule; two rejections at confidence ≥ 0.90 confirm the event, and the gate classifies it as a `text` or `timing` defect.

11. **Decide.** `poor` when confidence ≥ 0.65. `subtype` is `text`, `timing`, or `both` when the base rule and the quiz gate disagree. Otherwise `good`.

The quiz machinery is two pre-computed sidecars, base and confirm, keyed by the sha256 of the LRC bytes. Re-save an LRC even with identical text and it loses its sidecars — a detail that has cost me a confusing debugging session or two.

## Performance

The official read, head-to-head on the same 28-song snapshot with the same interpreter:

| Measure         | 1.1.0 @ 0.50             | 2.0.0 @ 0.65                 | Δ       |
| --------------- | ------------------------ | ---------------------------- | ------- |
| PR-AUC          | 0.9087                   | **0.9779**                   | +0.0692 |
| Recall@6        | 0.4286 (6/14)            | 0.4286 (6/14)                | 0       |
| Recall@K (K=14) | 0.7857 (11/14)           | **0.8571 (12/14)**           | +0.0714 |
| Precision       | 0.9167                   | **1.0000**                   | +0.0833 |
| Recall          | 0.7857                   | **0.8571**                   | +0.0714 |
| Verdict F1      | 0.8462                   | **0.9231**                   | +0.0769 |
| Confusion       | TP 11, FP 1, TN 13, FN 3 | **TP 12, FP 0, TN 14, FN 2** |         |
| Subtype rate    | 0.3571                   | **0.4286**                   | +0.0715 |

What each line means:

- **PR-AUC** is ranking quality independent of where the cut sits.
- **Recall@6** is how many of the 14 poor songs land in the top six — the part of the queue a reviewer actually reaches first.
- **Verdict F1** balances caught poor songs against false alarms at the published cut.
- **Subtype rate** is the share of poor songs whose `text`/`timing`/`both` description is right.

The paired 1.1.0 run reproduced the earlier exp_9 read on all 28 rows exactly (`max_abs_confidence_delta 0.0`), which is the check that the measurement setup had not drifted.

Three limitations belong in the same breath as the table:

- **This is a second read of the same 28 songs.** exp_16 had already scored this snapshot; exp_17 is a second look, not a fresh independent holdout. The threshold was selected on the training pool and the read is a check, so the result is not peeking — but a pass on used data is weaker evidence than a pass on fresh songs.
- **Small n and a coarse grid.** 28 songs, 14 per class, and a 0.01 threshold grid make mean-F1 differences below about 0.005 sub-flip noise. "Mean FP 6.5" is a count over 74 good training rows averaged over four repeats, not a rate.
- **The pool is a selection instrument.** A3 mean OOF PR-AUC on the training pool was **0.910467** against 1.1.0's **0.802672**, with per-seed A3 values `0.905838 / 0.910421 / 0.918626 / 0.906983`. It is not interchangeable with the 28-row read.

So: 0.9779 is the official 28-song read. It is not a general accuracy estimate for the detector on arbitrary worship recordings.

## Two 50-song batches

Separately from the gates, I ran 2.0.0 over real review worklists. 342 recordings carry `visibility_status='review'`; batch50 is the first 50 by `hash_prefix`, and batch2 is the next 50 excluding batch50. These rows are **unlabelled**. There is no snapshot, no PR-AUC, no official read. They are application runs over a worklist, not accuracy measurements.

| Batch   | 2.0.0 @ 0.65          | 1.6.0 @ 0.50 | 1.1.0 @ 0.50 | vs 1.6.0: good→poor | vs 1.6.0: poor→good |
| ------- | --------------------- | ------------ | ------------ | ------------------- | ------------------- |
| batch50 | **20 poor / 30 good** | 16 / 34      | 16 / 34      | 6                   | 2                   |
| batch2  | **16 poor / 34 good** | 15 / 35      | 15 / 35      | 5                   | 4                   |

The operational facts behind those numbers:

- 50/50 rows ranked in each batch, 0 unprovisioned, 0 evaluator errors.
- Beat grid present on 29/50 batch50 rows and 33/50 batch2 rows; a missing grid leaves the two beat features imputed, not an error.
- 14 of the 50 batch50 rows carry an unresolved transcript gate, so their content evidence is an upper bound.
- The quiz gate contributes events on 5 of 50 batch50 rows and 2 of 50 batch2 rows at 0.65.

The good→poor moves are **unlabelled escalations**, not established false flags. They mean the detector now asks a reviewer to look at a row it previously passed. Whether those rows deserve the flag is exactly what the review is for.

Two of the eight batch50 verdict changes are also not usable as queue verdicts in their current form. `1a9e53858778` moved to good with 14 content-unmatched and 2 unverified lines, and `0fdb6f105b34` moved to good with 15 content-unmatched lines. Clearing those needs a fusion/content-floor round, not an aligner prior. That is the strongest single reason not to read the batch counts as accuracy.

And the queue default remains 1.6.0. The batch pages are ad-hoc application runs.

## Three errors the detector caught

These three rows are **unlabelled queue items**. Each was checked against the same ASR transcript the detector sees; the transcript excerpts are verbatim ASR output, including its recognition errors. They illustrate what a flag looks like, not ground-truth accuracy. Lyric lines are quoted in short fragments only.

### Example 1 — the LRC is for a different song

`1862ddfb0e81`, `an_jing`.

| Field      | Value                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LRC        | `[00:30.68] 藏我在 翅膀蔭下` / `[00:38.34] 遮蓋我 在祢大能手中` ("Hide me under the shadow of Your wings / cover me in Your mighty hand")                       |
| Transcript | `31.78–34.22 安静` / `34.22–37.86 让平安入我心` / `37.86–43.84 深深知道你是我的身` ("Be still / let peace enter my heart / knowing deeply that You are my God") |
| Detector   | `poor`, confidence **1.0000**, subtype `text`                                                                                                                   |
| Evidence   | `content_mismatch: only 0% of LRC lines match the vocals transcript`, `excessive_repeats: one line repeated 6x`, `q_risk: q_risk=1.0000`                        |

The point is that this is not a bad timestamp or a typo. The LRC's words — 藏我在 翅膀蔭下 / 遮蓋我 在祢大能手中 — never appear in the transcript, which sings a different text (安静 / 让平安入我心). The file does not belong to this recording. Zero matched lines and a fully rejected quiz is what "wrong file" looks like.

### Example 2 — one line stamped 22 times while the real lyric is different

`0bd7ae0bf08d`, `mi_shi_pei_de_zan_mei`.

| Field      | Value                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LRC        | `[00:26.13] 祢是配得讚美` repeated **22 times** across roughly six minutes, with two blank rows interleaved                                                                                                                                                                   |
| Transcript | `38.56–50.82 亲爱的神灵来充满我的心` / `53.14–64.22 亲爱的神灵来充满我` ("Dear Spirit, come fill my heart" — the ASR renders 圣灵 as 神灵)                                                                                                                                    |
| Detector   | `poor`, confidence **0.9531**, subtype `both`                                                                                                                                                                                                                                 |
| Evidence   | `consec_duplicates: 19 consecutive duplicate lines`, `excessive_repeats: one line repeated 22x`, `content_mismatch: only 32% of LRC lines match the vocals transcript`, `localized_timing: 100% of matched lines off by >1s between 279s and 369s (median abs offset 13.25s)` |

This is duplicate spam plus a wrong section: the file takes the song's ending refrain and stretches it over the whole recording, missing the first four minutes of actual lyric. The 32% match is those repetitions that do happen to line up with a late chorus.

### Example 3 — the file stops before the song repeats

`4c398f507da0`, `gei_wo_qing_jie_de_xin`.

| Field      | Value                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LRC        | 16 lines, ending at `[02:06.01] 不要收回祢的聖靈` ("do not take Your Holy Spirit from me")                                                                                                                                                                        |
| Transcript | the chorus repeats from about **191 s** onward — `220.28–225.76 神啊求你为我造情节的心` and following — with no LRC lines scheduled after 126 s (ASR "情节" is a misrecognition of "清洁")                                                                        |
| Detector   | `poor`, confidence **0.8510**, subtype `both`                                                                                                                                                                                                                     |
| Evidence   | `missing_lines: 45% of vocal time has no lyric line; e.g. 191-215s vocals present, no lyric scheduled`, `localized_timing: 100% of matched lines off by >1s between 102s and 192s (median abs offset 1.51s)`, `scattered_timing: 42% of matched lines off by >1s` |

Every quoted line exists and roughly matches; the defect is coverage and late timing in the second half. The 2.0.0 pairing prior matters here specifically. On this same row, 1.6.0 reported a −137.53 s systematic offset — the aligner had matched the final chorus to the first one — while 2.0.0 localises the problem to the repeated section instead of declaring the whole file shifted.

## What is and is not proven

2.0.0 is better on the official 28-song read: ranking (0.9779 vs 0.9087), recall at the cut (12/14 vs 11/14), verdict F1 (0.9231 vs 0.8462), false alarms (0 vs 1), and subtype description (0.4286 vs 0.3571). The training pool and the official read agree on the direction, and the paired baseline run reproduced to the row.

What is not proven is the size of that advantage. The read is a second look at data exp_16 already used, and 28 songs is small enough that a handful of rows move the numbers. The batch runs are queue behaviour, not accuracy: they show the detector asks for more review than 1.6.0 does, in both directions, on rows nobody has labelled. The queue still defaults to 1.6.0.

The next step that would actually add information is human labels on the 100 review rows, not another threshold tweak. A threshold chosen on 121 training rows and checked on 28 used songs is not going to get meaningfully better at the margin; labels would tell me whether the escalations are catches or noise, which is the question that matters for the 342-row backlog.
