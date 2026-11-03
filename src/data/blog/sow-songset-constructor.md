---
title: "The songset constructor: worship practice as a constrained search"
author: Michael Huang
pubDatetime: 2026-07-28T00:00:00Z
slug: sow-songset-constructor
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - design
description: "Encoding the five-phase worship arc, theme inference, hard constraints, and weighted fitness into a songset search."
---

Building a worship set is not picking good songs. It is picking a sequence of good songs that satisfies a pile of constraints nobody wrote down. It has to open with something the congregation can join immediately. It has to move toward intimacy. It has to close in a state that hands off to the benediction. And it has to do all of that in twenty five minutes with the songs this church knows.

That is a constraint satisfaction problem with an aesthetic objective. The obvious move, asking a language model to propose a set, fails in a specific way. A model produces a plausible set. Plausible is not valid. It will put a slow ballad after a fast opener and explain the choice beautifully.

The constructor starts from the opposite premise. Validity is deterministic arithmetic over measured features. The model proposes and annotates. It never validates.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The transition engine](/posts/sow-transition-engine). Next: [The web app](/posts/sow-webapp-architecture).

<!-- more -->

## The problem

Three things are missing before a search can even run.

There is no definition of a valid set. Worship practice is tacit. Leaders know a set should not open with a response song and should not close with a call to praise. I had to write the arc down before I could enforce it.

The catalog has no theme tags. Phase assignment needs a theme per song, and there is not one upstream.

The objective is aesthetic. Any fitness function is a lossy encoding of a leader's judgment. The failure mode is a search that optimizes the encoding instead of the judgment.

## What I built

### The arc as a template

I fixed a five phase shape: call, thanksgiving, worship, response, commission. Set sizes map to templates. Two songs take slots one and four. Three songs take one, three, and five. Four and five fill in between. Six or more gets rejected, because there is no liturgical template for it.

Fixing the arc was deliberate. Inferring it from the selected songs would let the tool accept almost anything. Fixing it means the constructor can only fail by not finding songs, which is a failure I can diagnose. It also keeps the opener and closer tempo rules coherent, because they only make sense when the phase order is fixed.

### Themes

The theme vocabulary is Traditional Chinese, and each theme maps to exactly one phase. The phase vocabulary is coarser than the theme vocabulary. Worship, prayer, faith, and Holy Spirit songs all work in the worship slot. Commission, following, and revival all work at the close.

Classification is component first. Instead of classifying a whole recording, the system classifies its sections. A chorus carries more weight than a verse, scaled by theme confidence. A song whose final chorus is a commission is a commission song, because that is the part the congregation will sing last.

Where the classifier has no data, the fallback fuses four signals: title, lyrics, song embedding, and line embedding. When even that fails, tempo bands assign a phase. Fast songs go to praise. Slow ones go toward the close. It is a blunt instrument, and its purpose is to keep every song usable rather than to be accurate.

### Hard constraints

Nine constraints define a valid set. They cover set size, phase shape, opener tempo floor, closer tempo ceiling, adjacent tempo delta, harmonic distance, duplicate song guard, phase monotonicity, transposition safety, and total duration.

The subtlest one is phase monotonicity. A set can jump ahead in the arc. It cannot loop back. Praise after the response has no shape.

When nothing satisfies everything, the search relaxes in stages and labels the output. A wider tempo jump and a wider harmonic distance relax together, because they are the same musical concession. The opener floor and closer ceiling widen together too. Relaxing the phase shape itself is last, because a set with the wrong arc is not worth handing to a leader.

### Fitness

Weights are theme, tempo, harmony, diversity, with energy and lyrical posture as conditional additions. When energy or posture is unavailable across the pool, its weight redistributes proportionally into the base. Weights always sum to one, so scores stay comparable across runs.

Tempo fit rewards smoothness and a soft landing. Energy is ordinal, never absolute. Studio masters and live recordings are not comparable in raw loudness, but percentile ranks against the pool are. Posture fit is a small lookup table that encodes where a song belongs in the arc.

### The language model's job

The model plans and annotates. It does not reorder, approve, or compute the score. There is a deterministic fallback with no model, which is the real test of the split. If the search cannot run without the model, the model is doing validation work no matter what the design says.

## What broke

The diversity term was degenerate at first. My initial implementation counted non-zero entries in the theme distributions, but every song's distribution was dense. Every proposal got the same score. A fitness component that is constant is worse than none, because it eats weight and only makes the score look considered. The fix measured distance between distributions instead.

Pool exhaustion is not a bug. Some runs cannot fill a phase because the catalog has no qualifying songs. That looked like a failure until I realized it was correct.

Stale caches validated silently. A cache written before component metadata existed produced valid-looking scores with old features. Nothing errored. Versioning the cache namespace fixed it.

The wrong interpreter wrote an empty output file. The downstream parse failed two steps later. The root cause was not wrong data. Artifact shape has to be asserted.

Enrichment moved the numbers, which is the point. Converting the corpus from Simplified to Traditional increased title and lyric matches significantly. The constructor was not wrong before. It was working with a fraction of the available evidence.

## What I would do differently

Collect human set-quality ratings before tuning weights. The initial weights are a judgment, and every adjustment after is validated against another judgment.

Define templates for longer sets. Right now the tool silently caps a long service at five songs.

Add a per-phase pool-health check before search. Tell the operator the pool cannot support a phase before spending a run.

Make the diversity term explicit in its own module. Units stated in the contract make accidental reimplementation harder.
