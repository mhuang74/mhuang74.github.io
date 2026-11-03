---
title: "The transition engine: judge the seam, not the song"
author: Michael Huang
pubDatetime: 2026-07-14T00:00:00Z
slug: sow-transition-engine
featured: false
draft: false
tags:
  - stream-of-worship
  - audio
  - design
description: "Crossfades, beat-aligned gaps, and boundary keys: why transition quality gets judged at the seam instead of on whole-song averages."
---

Two songs can both be excellent and still refuse to sit next to each other. A transition is not a property of either song. It is a property of a pair of songs at a specific point in time.

Most music tools describe a song with one number per attribute. One tempo, one key, one loudness. That is fine for browsing a library and useless for joining two tracks. The two ends of a song are usually not its average.

This engine follows one rule. Score the exit of the first song against the entry of the second. Pick a technique that fits what you find there.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline). Next: [The songset constructor](/posts/sow-songset-constructor).

<!-- more -->

## The problem

Three questions sit between "the songs are analyzed" and "the songs can be joined".

Which key. A song can have one key in the catalog and different keys from analysis at the component level. Comparing a component-level exit key to a song-level entry key compares two different kinds of estimate. That is not a small error. It is a category error.

Which tempo. Tempo drives gap length in beats. A wrong boundary tempo makes the gap musically wrong and audibly so.

Which technique. Harmonic distance alone does not decide the transition. Some pairs want a crossfade, some want a gap, and a constant method applied everywhere is a decision to stop deciding.

## What I built

### The seam model

Each item in a songset carries transition parameters: gap beats, crossfade enabled, crossfade duration in seconds, key shift, and tempo ratio. Defaults are a two beat gap, crossfade off, no key shift, and no tempo change.

That range asymmetry is intentional. The preview endpoint is for auditioning, and an audition that lets you go an octave out wastes your time. The full API accepts wider values because a saved plan can be edited and re-previewed.

### Boundary features

Component rows carry a role. Entry, exit, both, and none. Aggregation reads entry from rows marked entry and exit from rows marked exit.

The rule is simple: keys never mix provenance within a pair. If both sides have component keys, the pair is scored on component keys. Otherwise both sides fall back to song-level keys. One side component and one side song-level is never allowed.

Tempo is per side. Each side falls back to its song-level tempo independently, with a warning that names the song. The asymmetry is intentional. Mixed key provenance is meaningless. Mixed tempo provenance is only less precise.

### Harmonic compatibility

Both keys reduce to pitch classes, with minor keys mapped to their relative major. Distance is the shortest step count around the circle of fifths, and distance maps to a score.

The drop is steep around three steps. One or two steps is a normal musical move. Three steps is where you need a musical excuse.

The engine suggests a transposition by searching the few nearest semitone shifts and choosing the smallest one that minimizes the distance. The suggestion never proposes a two semitone shift when one works. Key confidence gates it. Below 0.6, the engine refuses to transpose at all, because acting on a weak estimate is a way to be wrong more loudly.

### Technique selection

Distance and shift select a technique. Close relationships get a short gap and no crossfade, because the songs already agree and a crossfade smears two different grooves. Distant relationships get longer crossfades and longer gaps, because the listener needs time to be moved.

The order matters. Transposition is checked before the vamp branch. A pair that a single semitone fixes gets scored as a transposition, not a vamp. Cheaper remedy first.

### Render math

The render worker converts beats into milliseconds at the boundary tempo. A two beat gap at 140 BPM is shorter than a two beat gap at 90 BPM. Same musical instruction, different clock time.

A crossfade zeroes the gap, because silence and overlap do not coexist. Segment placement is previous end plus gap minus crossfade. Each segment gets a fade in and a fade out. The result is loudness normalized to a consistent target.

## The part that is intent, not signal

Key shift and tempo ratio are persisted, editable, and displayed in the UI. The render worker applies neither. There is no pitch-shift filter, no resampling filter, and no time-stretch filter anywhere in the render worker.

That is the single most misleading thing in the product surface. A parameter that looks like a knob, persists like a knob, and does nothing.

The reasons are simple. Pitch-shifting a vocal without formant correction sounds wrong. Time-stretching changes the groove in the recording. Both are things a musician hears immediately. There is no A/B harness to tell me whether a shift improves a transition or just changes it.

So the engine recommends a transposition and records it. A human is expected to act on it. The shipped system does not do it automatically.

## Design doc versus shipped path

The original spec planned more machinery: a different beat detector, a stretch library, a task queue, low-latency rendering, and mostly automatic transitions. What shipped is smaller on every axis. Recommendations a human accepts or overrides.

Each removed component would have added a failure mode to a path that already had enough.

## What broke

Mixed key provenance produced nonsense distances before the all-or-nothing rule. A pair got scored with one component key and one song-level key, and the result occasionally recommended a transposition for songs already in the same key.

A missing boundary tempo silently produced a wrong gap. The render still succeeded. That failure only surfaces by listening to the output, not by reading logs.

The preview endpoint and the editor disagreed about crossfade range. A value saved from a script rendered fine and was unrepresentable in the UI. Two surfaces validating the same field with different ranges is a bug waiting for the first power user.

The unused parameter problem is still the one I would undo first.

## What I would do differently

Never persist a parameter the renderer does not consume. Either wire it to a filter or keep it out of the UI.

Build the seam A/B harness before adding any DSP. The reason transposition and tempo matching stalled is that there is no instrument to tell whether a shift improves a transition.

Measure transition acceptance as a rate, not a score. Every number in the algorithm is a property of the algorithm, not the listening experience.

Unify parameter ranges in one schema. The same field existing in three places with two ranges is a bug.
