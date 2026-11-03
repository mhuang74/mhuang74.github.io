---
title: "Synced lyrics from messy sources"
author: Michael Huang
pubDatetime: 2026-06-30T00:00:00Z
slug: sow-lyrics-pipeline
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - lyrics
description: "YouTube transcripts, ASR engines, LLM alignment, and deterministic gap placeholders for timed Chinese worship lyrics."
---

A worship lyric video is only useful if each line shows up while it's being sung. That's stronger than "the lyrics are available", and it's what Stream of Worship actually has to meet. The catalog gives me plain text lyrics and nothing else. Every timestamp had to be manufactured.

Manufacturing timestamps means guessing. A YouTube caption track is accurate and sometimes in the wrong language. A cloud ASR transcript is fast and occasionally hallucinated. Whisper is accurate and slow. None of them can be trusted alone, and all of them can be wrong in ways that look fine until someone is watching lyrics drift behind the band.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The analysis pipeline](/posts/sow-analysis-pipeline). Next: [The transition engine](/posts/sow-transition-engine).

<!-- more -->

## The problem

Timed lyrics have two failure modes, and the industry tools only address one.

Line error is when the text doesn't match what's being sung, or the boundaries are wrong, or the script is wrong. Time error is when the text is right but the clock is off.

Those need different remedies. Line errors need better source text and segmentation. Time errors need alignment against the audio. A pipeline that fixes one produces files that look correct in an editor and fail on a projector.

There's a third mode, and it's specific to worship music: stale lyrics during instrumental passages. A four-minute song can have a long instrumental bridge. A line-based display freezes the previous line on screen for that whole stretch. The congregation reads an old lyric while the band plays something else. No ASR improvement fixes this because the transcript isn't wrong. The display model is.

## What I built

### The cascade

Four attempts, in cost order, each buying accuracy with time:

1. YouTube transcript. Fetch the caption track, prefer manual Chinese captions, then send the text plus the official lyrics to an LLM with one instruction: correct the characters, preserve the timecodes. Cheap. And when it works, it's the most accurate option because a human already did the alignment.
2. Cloud ASR. Segments get snapped to the official lyric text. Fast and decent.
3. Whisper. Accurate and slow. The reliable backstop.
4. Manual upload. A human with a text editor, which for a handful of songs is the correct answer.

The fallback ordering is explicit, not implied. A rate limit falls through to ASR rather than waiting. An operator who explicitly pinned the source gets a hard error instead of a silent downgrade.

A quota exhaustion parks the job until the reset and retries once. Other ASR errors go straight to the backstop. Concurrency is capped, and I picked the numbers by watching a provider's rate limiter, not by reading its documentation.

The forced aligner is not part of this cascade. It's a separate job you run when the first pass got the text right and the timing slightly wrong. I'd rather it stay manual than have it silently rewrite a good file.

### Gap placeholders

The fix for stale lyrics during instrumentals is the smallest piece of code in the pipeline, and it involves no model at all.

After text correction, a deterministic pass walks consecutive line pairs. When the gap between one line's end and the next line's start is long enough, it inserts an empty line at a musically sensible moment. The renderer treats it as a blank screen marker. The previous lyric fades. The next lyric previews before its timestamp.

Two decisions matter more than the code. First, the threshold is in beats, not seconds, because a musical breath is measured in beats. Second, the model never inserts placeholders. Asking it to emit empty timed lines is asking it to invent timestamps, which is exactly the failure mode this pass avoids.

### Provenance

The job store has a short retention, so anything a human wants to know six weeks later can't live there. Each recording carries its source permanently.

The cache key had the same problem in a different form. Early on it hashed only content and lyric text, so editing the text served a stale file. Now the prompt and the language version are in the key, so a prompt revision invalidates the cache automatically.

### Review queue is the landing state

Every machine-generated file lands in review. Published files are protected. Batch runs skip them. An explicit regenerate demotes them. That's correct because the operator asked for it.

User feedback is advisory. It flags a file for a human. It doesn't change a file.

For the quality gate over these files, see [Detector 2.0.0](/posts/lrc-detector-2-0-0).

## What broke

The auto-generated Chinese caption track on one video was not Chinese. The correction prompt now mentions it, but the pipeline already spent an LLM call producing confident nonsense before the fix. The real fix is a script-detection gate before the LLM call.

Whisper, given near-silent reverb and a lyrics prompt, loops the same line over and over into the silence. There's a deduplication guard and a no-speech filter, but the behaviour is a property of the model that no post-filter removes.

A queue of jobs got killed externally. The job tally lived in the non-durable store, so I had to reconstruct the recovery state from the database instead of the queue. That incident is why provenance moved into the durable store.

The tail recovery experiment measured what happens when lyrics end before the audio. A caption track cuts out before the vocals do. Recovering that last stretch is expensive and most attempts come back junk. The honest verdict is that the feature half-works.

## What I would do differently

Collect human labels before tuning thresholds. The first thresholds were chosen by eye.

Make gap placeholders source-agnostic from day one. Right now they only exist on the caption path, and the ASR paths are exactly the ones that need them.

Persist job provenance before the first long run. A durable column is cheap. Reconstructing what happened from a report is not.

Treat wrong language as detectable, not as a prompt instruction. A script check costs microseconds and would have saved an LLM call plus a bad file.
