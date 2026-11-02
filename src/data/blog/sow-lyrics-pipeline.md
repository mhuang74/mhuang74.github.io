---
title: "Synced lyrics from messy sources"
author: Michael Huang
pubDatetime: 2026-10-26T00:00:00Z
slug: sow-lyrics-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - lyrics
description: "YouTube transcripts, two ASR engines, LLM alignment, and deterministic gap placeholders: a cascade for timed Chinese worship lyrics."
---

A worship lyric video is only useful if each line shows up while it's being sung. That's a stronger requirement than "the lyrics are available", and it's the one Stream of Worship actually has to meet. The catalog gives me plain text lyrics and nothing else — no timings, no cue points, no LRC files. Every timestamp in the system had to be manufactured.

Manufacturing them means guessing. Guessing about music is more or less what this pipeline is. A YouTube caption track is accurate when it exists and is sometimes in the wrong language. A cloud ASR transcript is fast and occasionally hallucinates a repeated chorus line into a near-silent outro. Whisper is accurate and slow. None of them can be trusted on its own, and all of them can be wrong in ways that look fine until someone is standing in front of a congregation watching the lyrics drift a line behind the band.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [The analysis pipeline](/posts/sow-analysis-pipeline). Next: [The transition engine](/posts/sow-transition-engine).

<!-- more -->

## The problem

Timed lyrics (`LRC`, the format where each line is prefixed with `[mm:ss.xx]`) have two different failure modes, and the industry tools only address one of them.

The first is **line error**: the text doesn't match what's being sung, or the line boundaries are wrong, or the characters are Simplified where the rest of the system is Traditional. The second is **time error**: the text is right but the clock is off — drifting cumulatively, shifted at the start, or anchored to the wrong verse.

Those need different remedies. Line errors are fixed by better source text and better segmentation. Time errors are fixed by alignment against the actual audio. A pipeline that only fixes one produces files that look correct in a text editor and fail on a projector.

There's a third mode, and it's specific to worship music: **stale lyrics during instrumental passages**. A four-minute song can have a sixty-seven-second instrumental bridge — I measured exactly that on one recording — and any line-based lyric display will just freeze the previous line on screen for that whole stretch. The congregation reads a lyric that was sung a minute ago while the band plays something else entirely. No improvement in ASR accuracy fixes this, because the transcript isn't wrong. The display model is.

## Breaking it down

- **Source selection.** Get the best available timed text for the least cost, and know which source produced each file. Done when every generated LRC records its provenance in the database, not just on disk.
- **Language discipline.** Traditional Chinese is canonical, and the honorific 祢 has to survive conversion. Done when a converted file is byte-identical on a second conversion (idempotent), and 祢 is never mangled into 禰 or 你.
- **Time alignment.** Snap model-produced text onto real audio boundaries. Done when there's no cumulative drift at the end of a four-minute song.
- **Instrumental gaps.** Done when a long instrumental passage produces a _blank_ line instead of a frozen one.
- **Failure recovery.** Every fallback tier fails in its own way. Done when quota exhaustion, a rate limit, and a timeout each have a defined next step that doesn't need a human.

## What I built

### The cascade

Four attempts, in cost order, each one buying accuracy with time:

1. **YouTube transcript.** Fetch the caption track, preferring manual Chinese captions over auto-generated ones (`["zh-Hant", "zh-TW", "zh-Hans", "zh-CN", "zh-HK", "zh"]`, manual winning within the language match). Then send the timed text plus the official lyric text to an LLM with one instruction: correct the characters against the official lyrics, **preserving the timecodes**. Cheap — no audio download, no stem separation — and when it works it's the most accurate option available, because a human subtitler already did the hard alignment.
2. **Qwen3 ASR** via DashScope, either the flash or file-transcription endpoint. Segments get snapped to the official lyric text at a similarity threshold of 0.60, and at least 3 usable segments are required before the output is accepted.
3. **Whisper `large-v3`** on Modal, beam size 5, VAD enabled, language pinned to `zh`. The expensive, reliable backstop.
4. **Manual upload.** A human with a text editor, which for a handful of songs is the correct engineering answer.

The fallback ordering is explicit in the worker instead of implied by control flow:

```python file="ops/analysis-service/src/sow_analysis/workers/queue.py:1555-1570"
                # Stage 1: Try YouTube transcript first — no audio download or stem needed
                youtube_lrc_result = None
                if use_youtube:
                    from .lrc import try_youtube_transcript_lrc
                    from .youtube_transcript import YouTubeRateLimitedError

                    await self._update_stage(job, "trying_youtube_transcript", 0.2)
                    try:
                        youtube_lrc_result = await try_youtube_transcript_lrc(
                            request.youtube_url,
                            request.lyrics_text,
                            request.options,
                            lrc_path,
                            resolved_language,
                            trace=trace,
                        )
```

A YouTube rate limit doesn't block the job — it falls through to ASR rather than waiting out a cooldown. But an operator who explicitly pinned the generator to `youtube` gets a hard error instead of a silent quality downgrade, because "I asked for the caption track and got Whisper" is a different product outcome than "any timed lyrics will do."

The Qwen3 stage branches too: a quota-exhaustion error parks the job in a `waiting_for_qwen3_asr_quota_reset` stage, waits once for the UTC-midnight reset, retries once, then falls to Whisper. Any other ASR error goes straight to Whisper. Concurrency is capped at 2 concurrent ASR calls and 3 concurrent LLM calls with a 2-second minimum interval between them, 32 retries, and a 1200-second wall budget per job. I picked those numbers by watching a provider's rate limiter, not by reading its documentation.

**The forced aligner is not part of this cascade.** It's a separate job an operator runs deliberately: Qwen3-ForcedAligner, chunks capped at 300 seconds, a 900-second total ceiling, and a ±30-second search around each cut snapped to the quietest RMS frame. It writes its own provenance value. It's a second pass you invoke when the first pass got the text right and the timing slightly wrong, and I'd rather it stay manual than have it silently rewrite a good file.

### Gap placeholders, deterministically

The fix for stale lyrics during instrumental passages is the smallest piece of code in the pipeline and the one I'm most confident about, because it involves no model at all.

After the LLM has corrected the text, a deterministic pass walks consecutive line pairs, computes each line's audible end from the transcript cues, and — when the gap exceeds 12 beats of the recording's tempo — inserts an empty-text line 4 beats after the previous line ends:

```python file="ops/analysis-service/src/sow_analysis/workers/youtube_transcript.py:896-920"
        line_end: Optional[float] = None
        for cue in sorted_cues:
            if cue.start < line.time_seconds - _TIMESTAMP_MATCH_TOLERANCE:
                continue
            if cue.start >= next_start - _TIMESTAMP_MATCH_TOLERANCE:
                break
            line_end = cue.end
        if line_end is None:
            logger.warning(
                "Gap placeholder: no cue matches timestamp %.2fs — skipping gap",
                line.time_seconds,
            )
            continue

        gap = next_start - line_end
        if gap <= threshold_seconds + 1e-6:
            continue

        placeholder_time = line_end + placeholder_seconds
        if placeholder_time >= next_start - 1e-6:
            placeholder_time = next_start - 0.01

        if placeholder_time <= line.time_seconds:
            continue
        out.append(LRCLine(time_seconds=placeholder_time, text=""))
```

`threshold_seconds` and `placeholder_seconds` both come from beats and the recording's detected tempo, so the placeholder lands at a musically sensible moment instead of an arbitrary offset. The renderer treats an empty-text line as a blank-screen marker: the previous lyric fades, and the next lyric previews four beats before its timestamp.

Two decisions here matter more than the code. First, **the threshold is in beats, not seconds** — 12 beats is roughly five seconds at 140 BPM and eight seconds at 90 BPM, which is about how long a musical breath actually feels. Second, **the LLM never inserts placeholders**. Asking a language model to emit empty timed lines is asking it to invent timestamps, and timestamp invention is exactly the failure mode this pass exists to avoid. Determinism after the model, not inside it.

The known caveat, recorded in ADR-0008: inserting lines shifts the `line_start` and `line_end` indices that component-level analysis uses, so the two features disagree slightly about line identity. And only the YouTube path implements the insertion — the ASR paths don't, which is an inconsistency I haven't closed.

### Provenance, because memory is not durable

The job store is SQLite with a 7-day purge, which means anything about a job a human might want to know six weeks later can't live there. So each recording carries its `lrc_source` in Postgres: which tier produced the file, permanently.

The cache key had the same problem in a different form. Early on it hashed content and lyrics text, which meant editing the lyric text served a stale file — and worse, changing the prompt or the language did too. The composite key now folds in the language and a pipeline version constant, so a prompt revision invalidates the cache by construction instead of by me remembering to clear it.

### The review queue is the landing state

Every machine-generated file lands with `visibility_status='review'`. Anything published stays published: batch runs skip published recordings, and the publish-guard tests refuse to regenerate or overwrite a published file. The nuance is that an _explicit_ regenerate with the review flag does demote a published file. That's correct, since the operator asked for it, but it means "published is protected" is a guard on the batch path rather than an absolute invariant, and the code says so more honestly than my notes did.

User feedback on lyrics is advisory, per ADR-0007. It flags a file for a human. It does not change a file.

For the quality gate that runs over these files — a 43-feature detector that scores whether timed lyrics are bad — see [Detector 2.0.0](/posts/lrc-detector-2-0-0).

## What broke

**Wrong-language captions.** The auto-generated Chinese caption track on one video was not Chinese. The correction prompt now explicitly tells the model that auto-generated subtitles "may be in the wrong language", but by then the pipeline had already spent an LLM call producing confident nonsense. The real fix is a script-detection gate before the LLM call, which doesn't exist yet.

**ASR hallucination on quiet tails.** Whisper, given a clip of near-silent reverb and a lyrics prompt, will loop — emitting the same line over and over into the silence. There's a deduplication guard that drops repeated lines within a 3-second window, and a `max_no_speech_prob` filter set to 0.6, but the underlying behaviour is a property of the model that no post-filter fully removes.

**A 194-job queue behind a SIGKILL.** The container was killed (exit 137) with `OOMKilled=false` — an external kill, not the kernel reclaiming a process. Roughly 194 LRC jobs were queued at the time. Because the job tally lived in the non-durable store, I had to reconstruct the recovery state from the database and the reports instead of from the queue itself. That incident is why `lrc_source` moved into Postgres.

**The tail recovery experiment.** Lyrics that end well before the audio does turned out to be common enough to measure: across 62 completed LRC jobs, tail fill triggered on 36. It recovered at least one line on 22 of those 36 (61%), appending 43 lines total. The split between engines was the interesting result: the Qwen3 tail path produced unusable output on 26 of 36 attempts — 72% — with 16 failures from too few usable phrases, 9 from no valid fragment, and one 1814-second file-transcription timeout. Whisper cost about 42.6 seconds of transcription wall time per recovered line. Recovering one line in the final thirty seconds of a song for that price is not a slam dunk, which is why the report's verdict was "keep both, but the Qwen3 tail path is the weak link" rather than "ship it".

## Evidence

| Stage               | Engine                              | Strength                            | Failure mode                                  | Fallback                                     |
| ------------------- | ----------------------------------- | ----------------------------------- | --------------------------------------------- | -------------------------------------------- |
| 1. Captions         | YouTube zh track (manual first)     | Human-level timing, no audio decode | Wrong-language track; rate limit; no captions | Stage 2 (or hard error if pinned)            |
| 2. Cloud ASR        | Qwen3 ASR, snap ≥0.60, ≥3 segments  | Fast, cheap, decent segmentation    | Quota exhaustion; too few usable fragments    | Wait once for UTC reset, retry, then Stage 3 |
| 3. Local ASR        | Whisper `large-v3`, beam 5, VAD, zh | Accurate, no quota                  | Slow; loops on near-silent tails              | Manual                                       |
| 4. Forced alignment | Qwen3-ForcedAligner (separate job)  | Re-times good text onto real audio  | Chunk/total caps (300 s / 900 s)              | Re-run with different cuts                   |
| 5. Manual           | Human with an editor                | Correct                             | Does not scale                                | —                                            |

Measured tail-fill run: 62 jobs completed, 36 triggered, 22 recovered ≥1 line, 43 lines appended, 26/36 Qwen3 attempts unusable, ~42.6 s Whisper wall per recovered line, worst measured instrumental gap 67.1 s. Report: `reports/tail-lyrics-recovery-report.md`.

## What I'd do differently

1. **Collect human labels before tuning thresholds.** The 0.60 snap threshold and the 0.03 key-margin rejection were both chosen by eye. Without labels, every tuning decision after that is a guess that happens to produce plausible output. The Detector's next step is a labelling pass, not a threshold sweep, and that should have been this pipeline's first step.

2. **Make gap placeholders source-agnostic from day one.** The insertion pass depends only on line timestamps and transcript cues, and the ASR paths produce both. Gating it to the YouTube path was an accident of where the code happened to live, and it means the ASR-sourced files — the ones most likely to have timing gaps — are exactly the ones missing the fix.

3. **Persist job provenance before the first long run.** The SIGKILL taught me that expensively. A durable column is cheap. Reconstructing what happened from a report is not.

4. **Treat "wrong language" as a detectable condition, not a prompt instruction.** A script check costs microseconds and would have saved an LLM call plus a bad file.

Source: [youtube_transcript.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/analysis-service/src/sow_analysis/workers/youtube_transcript.py) · [queue.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/analysis-service/src/sow_analysis/workers/queue.py) · [ADR-0008](https://github.com/mhuang74/stream_of_worship/blob/main/docs/adr/0008-gap-placeholders-inserted-post-llm.md)
