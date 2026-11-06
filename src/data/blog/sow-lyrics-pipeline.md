---
title: "Synced lyrics: generation and alignment"
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
description: "Matching official lyrics to a recording, recovering repeated endings, and aligning lines to the vocals."
---

I need the words on screen to match what people are singing. The catalog gives me official lyrics, but a recording can repeat a chorus, shorten a verse, or add another ending. A correct copy of the song's text isn't yet a useful lyrics video.

The lyrics pipeline has two jobs: work out which lines were sung, then place those lines in time. Keeping those questions separate makes it easier to fix a file whose words are useful but whose timestamps are poor.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Building the catalog](/posts/sow-catalog). Next: [Analyzing songs: tempo, key, sections, and meaning](/posts/sow-analysis-pipeline).

<!-- more -->

## Generation starts with the recording

[LRC generation](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/queue.py) tries YouTube captions first, then Qwen3 ASR when configured, then Whisper. Captions already contain text and timing, so they can save a transcription pass. Manual upload remains a separate operator action.

The caption worker prefers Chinese tracks and asks an LLM to correct the text against the official lyrics while preserving timecodes. The recording determines the sequence and repetitions; the official text helps with characters that sound alike. Otherwise, correcting a transcript could accidentally turn a live arrangement back into the shorter printed song.

A caption track can still be incomplete or badly timed. Even a human-provided track might cover only part of the performance. Captions are a starting point, and their presence doesn't establish that the resulting LRC is ready to publish.

If captions are unavailable or rate-limited, the automatic job moves on to ASR. Qwen3 quota exhaustion gets one wait for reset and another attempt before Whisper takes over. Explicitly forcing a generator is different: its failure is reported instead of quietly selecting another source. That distinction helps when comparing generators on the same recording.

## Recognize the singing, then correct the words

For ASR, the service can prepare a vocal track before recognition. It reuses an existing dry-vocal stem where possible; otherwise it requests separation and waits for the result. Both Qwen3 and Whisper use that shared audio selection rather than independently preparing the same recording.

Dry vocals are preferred, with ordinary vocals usable when the separation result provides them. If vocal preparation was requested and no usable stem arrives, the job fails. It refuses to quietly transcribe the full mix. Full-mix input is still possible when stem use is disabled, but that is an explicit choice.

Qwen3 returns timestamped phrases. A [canonical-text pass](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/services/canonical_snap.py) matches sufficiently similar recognized phrases to the official lyrics, followed by LLM correction into lyric lines. Whisper provides another set of timed phrases for the LLM to reconcile with the same text. In both cases, the task includes preserving sung repetitions.

The word “alignment” appears in this generation code too. Here it means assigning canonical lyric lines to the transcription's timestamps. It isn't the separate acoustic forced-aligner operation described below. Text correction can fix a wrong character without establishing exactly where the singer began that line.

## Don't leave the last lyric on screen

An LRC line stays active until another timestamp replaces it. That works during singing, but a long instrumental can leave the previous words hanging on screen.

The caption path has a deterministic gap pass. It uses caption end times and tempo to insert empty timed lines, allowing the player or renderer to clear the text. The LLM is instructed not to invent these markers itself.

This needs the end of the sung phrase, not just the next phrase's start. A long interval between starts might contain a held note, an instrumental, or both. The [gap tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/tests/test_youtube_transcript_gaps.py) check the caption rules; they don't establish equivalent gap handling across every ASR path.

## Recover the uncovered ending

Worship recordings often keep going after the captions stop. The pipeline checks the gap from the last non-empty lyric timestamp to the recording's duration. With the default settings, tail recovery triggers when that gap exceeds the smaller of 30 seconds and 15% of the recording.

The recovery pass takes an overlapping clip starting 15 seconds before the last lyric. It tries Qwen3, then Whisper if Qwen3 fails or produces too few usable phrases. Recovered phrases are corrected against the official text, shifted back into recording time, and merged after the existing ending. Lines at or before the seam and immediate duplicates are discarded.

A long gap can also be a real instrumental outro. Tail recovery must tolerate finding no new lyrics. Whisper's tail settings disable VAD because speech detection can discard singing, while a no-speech check helps reject unusable output. Neither setting makes an appended line automatically correct.

The [October 20 recovery report](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/tail-lyrics-recovery-report.md) recorded 43 appended lines across 22 jobs. Those were log-derived recovery counts, without a correctness audit. The useful lesson was that a successful caption job could still miss the final chorus. Counting completed jobs alone wouldn't reveal that problem.

## Alignment is a separate operation

When the words and repeats are already useful, I can submit them to Qwen3 ForcedAligner to replace the timing. This operation takes supplied text and audio. It doesn't discover an omitted chorus or decide which words should have been there.

It reuses the same vocal-selection path as transcription. The model returns character or word segments, and the [mapping helper](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/forced_alignment.py) normalizes punctuation and whitespace, tracks text positions, and maps overlapping segments back to the original lines. Line starts become LRC timestamps. Unmatched text can receive estimated timings, so a completed operation still needs listening review.

The model handles roughly five minutes at a time. Longer recordings, up to the configured 15-minute total limit by default, are divided near quiet points. Existing LRC times help assign lines to chunks; without them, character-proportional estimates provide the fallback. Each chunk is aligned separately, and its timestamps are shifted by the chunk's start time before the lines are joined.

Quiet cuts reduce the chance of splitting a sung phrase. They don't guarantee it, and incorrect input timings can still put text in the wrong chunk. The joins deserve particular attention when reviewing a long recording.

## Review three different things

I check text accuracy, timing accuracy, and coverage separately. Correct characters can arrive late. Good timestamps can accompany the wrong words. Both can look fine while an entire repeated section is missing. The [Detector article](/posts/lrc-detector-2-0-0) goes deeper into finding files that need review.

The recording stores `lrc_source`, including whether caption output needed ASR tail recovery. The final-result cache includes the audio hash, lyric-text hash, language, and an explicit LRC version. Transcription caches also carry model and prompt-version information. Editing lyrics changes the relevant key; changing a prompt requires updating its version deliberately.

Source tracking helps explain how a file was made. It doesn't replace checking what the file says while the song plays. I'd review the repeats and ending before spending time polishing a few early timestamps.
