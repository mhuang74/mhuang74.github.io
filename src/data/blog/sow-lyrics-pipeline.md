---
title: "Synced lyrics from messy sources"
author: Michael Huang
pubDatetime: 2026-06-30T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-lyrics-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - lyrics
description: "Correcting caption text, falling back to ASR, and leaving room for human review."
---

The catalog gives me the words, but I need timestamps to put them on screen while they're being sung. A recording may also repeat a chorus more times than the written lyrics suggest.

Captions are a useful starting point when they exist. Otherwise I need speech recognition to find the words in the audio, then align them with the official text. Neither route removes the need to review the result.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The analysis pipeline](/posts/sow-analysis-pipeline). Next: [The transition engine](/posts/sow-transition-engine).

<!-- more -->

_Updated November 6, 2026: this describes the November 1 code, including October changes to remote inference and tail recovery._

## Try captions before transcribing

The automatic path in the [job queue](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/queue.py) tries YouTube captions, then Qwen3 ASR when enabled, then Whisper. Manual upload is an operator action outside that automatic chain.

The [caption worker](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/youtube_transcript.py) prefers Chinese captions and asks an LLM to correct text against the official lyrics while preserving timecodes. A caption track can still be incomplete, mislabeled, or poorly timed. Having a human caption source doesn't establish its accuracy for this recording.

If captions fail or are rate-limited, the automatic job can continue to ASR. A forced generator behaves differently: it reports failure rather than quietly switching sources. Qwen3 quota exhaustion can wait for the reset once and retry before falling back. The [source-chain tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/tests/test_lrc_fallback_no_flag.py) pin those cases.

As of November 1, Whisper runs on Modal rather than inside the orchestration container. Forced alignment is a separate job for correcting timings when the text is already useful. I prefer an explicit operation here because a timing adjustment deserves its own review.

## Clear the screen during instrumentals

A timestamped lyric file normally leaves a line active until the next one starts. During a long instrumental, that can keep the last sung line on the screen for much too long.

The caption path has a [deterministic gap pass](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/youtube_transcript.py) that uses caption end times and tempo to insert empty timed lines. The renderer can then clear the lyric. The model is told not to manufacture these markers itself.

This depends on having a useful end time, not merely the next line's start. The [gap tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/tests/test_youtube_transcript_gaps.py) cover the insertion rules. They don't establish equivalent behavior across all ASR paths; making the pass source-independent is still useful work.

## Remember how the file was made

The recording stores `lrc_source`, since the short-lived job store can't serve as permanent provenance. The final-result cache key includes the audio hash, a hash of the lyrics, language, and an explicit LRC version string. The Whisper transcription key also includes its model, prompt version, and cache version.

That means a lyrics edit changes the key. A prompt edit only invalidates the relevant cache if its version is updated too. It isn't automatic source-code tracking.

Generated lyrics go through the review workflow before publication. Regeneration and overwrite rules need to be checked per command, rather than assuming every batch path protects a published file in the same way. User feedback flags a problem for review; it doesn't rewrite lyrics on its own.

## Recovering the missing ending

The [October 20 tail-recovery report](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/tail-lyrics-recovery-report.md) looked at a run with 62 completed LRC jobs. Tail fill triggered for 36 jobs and recovered at least one line for 22, appending 43 lines in total. One tail attempt was still in flight when the container was killed.

Qwen3 succeeded on 9 of the 36 attempts; 26 were unusable and fell back to local Whisper in that historical run. Whisper recovered 35 of the 43 lines. Those are log-derived counts, without a database or object-storage cross-check, and they predate the move of Whisper to Modal. They measure recovered output, not whether each recovered line was correct.

This is why I keep text errors, timing errors, and missing coverage separate when reviewing lyrics. A file can contain all the right characters and still miss the final chorus. The [Detector 2.0.0 follow-up](/posts/lrc-detector-2-0-0) looks at ranking files for that review.
