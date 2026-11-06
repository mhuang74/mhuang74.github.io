---
title: "Analyzing songs: tempo, key, sections, and meaning"
author: Michael Huang
pubDatetime: 2026-06-16T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-analysis-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - audio
description: "Measuring recordings, identifying useful sections, and adding text embeddings and Theme/Posture tags for songset planning."
---

I want to find songs that fit together, then compare the places where they might join. Tempo and key help narrow the choices. Section boundaries help locate a chorus. Lyrics add another question: does this song belong at this point in the worship set?

The analysis service produces several kinds of evidence for those decisions. They don't all come from one model, and they don't all describe the whole song.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Synced lyrics: generation and alignment](/posts/sow-lyrics-pipeline). Next: [Running the Analysis Service: Modal apps and background jobs](/posts/sow-analysis-infrastructure).

<!-- more -->

## A quick measurement pass

[Fast analysis](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/analyzer.py) uses librosa to measure duration, tempo, key, and RMS-based loudness. That loudness value isn't calibrated integrated LUFS. The result makes a recording roughly comparable without requiring full structural analysis.

Tempo is an estimate from the audio, with algorithm-specific handling for ambiguous pulse choices. A recording can plausibly be counted at half or twice the returned BPM. Having a number is useful for filtering; it doesn't remove the need to listen when a transition sounds wrong.

Fast analysis doesn't identify verses or choruses. The queue marks its analysis tier `partial`, and its output has no full beat grid, labeled sections, or audio embedding information. Component analysis is a separate job, even when an Admin CLI batch requests both steps.

That separation lets me add useful section information to a recording that has only fast analysis. It also avoids treating “analysis completed” as a promise that every possible feature exists.

## Finding sections from timed lyrics

The preceding lyrics post explains how the LRC follows the actual performance, including repetitions. Those timestamps make repeated text useful for section identification: a chorus appearing three times becomes three intervals in the audio.

The [repetition heuristic](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/components.py) normalizes lyric lines, looks for repeated windows, and can merge similar text using fuzzy matching. It scores candidates using repetition and position, with configurable length and content weights. The default length and content weights are neutral, so the presence of a worship keyword doesn't by itself boost a candidate.

The winning block is treated as a chorus, and nearby preceding lines supply a possible verse for looping. Repeated verses, short refrains, and an opening chorus can confuse this rule. Missing or badly split LRC lines also change which blocks appear to repeat. This is a practical fallback, not a general music-structure model.

The current default identification order is more involved than the old “allin1, then repetition” description. After cache lookup, the worker tries structured lyrics aligned to LRC through an LLM when the inputs and credentials are available. Next come supplied or cached allin1 labels, then optional whole-song LLM segmentation, and finally repetition. Explicit segmentation modes restrict the choice rather than always traversing that whole chain.

Structured lyrics supply named sections; the LRC supplies their occurrences in the recording. Optional LLM segmentation instead asks for sections from the timed lyrics. Neither route should be confused with acoustic forced alignment, which adjusts lyric timing rather than deciding section labels.

## Full analysis adds musical structure

The full pass uses [All-In-One, through allin1](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/modal_apps/analyzer_app.py), for BPM, beats, downbeats, and labeled sections such as verse, chorus, bridge, and outro. Its internal Demucs separation produces bass, drums, other, and vocals. Those four stems support the analyzer and can be retained when requested.

They differ from the vocal and accompaniment deliverables prepared for lyrics recognition. In particular, an allin1 vocal stem isn't the same artifact as the dry-vocal output used by the lyrics pipeline.

Component analysis can use the full pass's labels and timing to identify chorus occurrences and transition roles. The first chorus can supply an entry, the last an exit, and a preceding verse a loop target. These are candidates for planning, not automatic instructions to cut the audio there.

Per-component measurements then describe the relevant audio slices: BPM, key, groove density, backbeat strength, and energy. By default, feature computation focuses on transition roles and the first bridge; an option includes every component. A quiet first chorus and a louder final chorus can therefore carry different measurements even though they share words.

Beat grids also have their own path. Component analysis can request a standalone grid for snapping boundaries to bars without running full allin1 analysis. If downbeat detection fails, available beats can still help; otherwise the result has less timing evidence. The deployment details belong in the next post.

## Key detection needs more than one average

The local key detector builds harmonic chroma: energy grouped into the twelve pitch classes after separating harmonic and percussive content. It compares those values against rotated major and minor Krumhansl-Schmuckler profiles. The best correlation supplies a candidate tonic and mode.

A whole-track estimate is available, but the voting paths divide the recording into supplied sections or overlapping windows. This gives a short intro less influence than a long sung section and exposes disagreement within a recording.

The detector rejects windows shorter than eight seconds, quiet windows, nearly flat chroma, and candidates whose top two profile scores are too close. Accepted votes are weighted by duration, capped RMS, and profile score. Short first and last windows get half weight. If no votes survive, it falls back to the whole-track detector.

The result includes confidence, the score margin, window agreement, alternative candidates, and an algorithm version. These are diagnostics, not a probability that the key is correct. A modulating recording can legitimately contain competing keys. For transition planning, the exit section's estimate may be more relevant than whichever key won across the whole track.

## Embeddings describe the text too

The [embedding worker](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/embedder.py) is another separate job. It combines title, composer, and raw lyrics into a song-level text input. It also embeds individual lyric lines containing at least four CJK characters, keeping their original line indices. With the default `text-embedding-3-small` configuration, the requested vectors have 1,536 dimensions.

Song vectors help discovery by meaning rather than exact wording. Line vectors let a short passage contribute even when the rest of the lyrics discuss something else. This matters when a song's bridge fits a theme more closely than its title does. The four-character eligibility rule also limits what receives line-level coverage.

These vectors are distinct from allin1's audio embeddings. The full-analysis result reports audio embedding shape information; that isn't the semantic text vector used for lyric search. Calling both “embeddings” without saying which input they represent makes the pipeline sound more unified than it is.

## Theme and Posture answer different questions

Component classification assigns a Theme from twelve Chinese categories and a vocal Posture: “To God,” “About God,” or “To Congregation.” A lyric can be about praise while addressing the congregation. Theme describes the subject; Posture describes whom the words address.

The classifier uses the component's lyrics and an LLM, with a pronoun-based heuristic as a confidence cross-check. Repeated components with the same normalized lyric content share one classification call, then copy its fields. This saves calls and keeps identical choruses consistent, although those rows can still have different audio features.

The [Admin CLI aggregates the saved component tags](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/commands/audio.py#L2571) into recording-level values. It takes the most frequent valid label, resolving ties by the first chorus, average confidence, then earliest occurrence. Deduplicating model calls doesn't deduplicate those aggregation votes. Repeated choruses still contribute repeated rows.

One [classification fix](https://github.com/mhuang74/stream_of_worship/commit/b9f773255b53c1de6a59153a50b0bf4cb4c21140) came from a 300-token output budget. A reasoning model consumed the budget before returning JSON, leaving empty content and null tags with misleading confidence. Classification now has a separate model setting, a default 2,048-token budget, explicit truncation detection, and no confidence for dropped labels.

A successful HTTP response wasn't enough. The useful check was whether the returned fields could actually support the next decision.
