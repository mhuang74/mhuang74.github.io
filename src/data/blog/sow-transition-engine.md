---
title: "The transition engine: comparing the exit and entry"
author: Michael Huang
pubDatetime: 2026-07-14T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-transition-engine
featured: false
draft: false
tags:
  - stream-of-worship
  - audio
  - design
description: "Boundary features, harmonic recommendations, and what the renderer actually applies."
---

I need to compare the end of one recording with the start of the next. A song's catalog key and average tempo are useful shortcuts, but they can describe the wrong part of a transition.

The transition code recommends a gap, crossfade, and possible key shift. Rendering is a separate step, and some saved settings still don't affect the audio. That distinction matters when auditioning a proposed set.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline). Next: [The songset constructor](/posts/sow-songset-constructor).

<!-- more -->

_November 6 update: boundary-aware constructor scoring was added September 12. The details below are checked against the November 1 revision._

## Which measurements to compare

[Component aggregation](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/components.py) reads rows marked `entry`, `exit`, or `entry_exit`. If more than one row qualifies, occurrence index and row ID provide a deterministic choice. It doesn't search every possible join point.

For keys, the [pair comparison](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/transitions.py) uses component estimates only when both sides have them. Otherwise it falls back to song-level estimates on both sides. This avoids mixing two kinds of key source in one comparison.

Tempo fallback is more limited than that summary might suggest. For a component-key pair, one missing boundary BPM falls back to that song's BPM with a warning. If both boundary BPMs are missing, the current calculation produces a zero delta and a warning instead of recovering both song-level values. Song-level pairs use song-level tempos. Missing data can therefore make a pair look easier than it is; the warning is worth reading.

## Harmony is a rough guide

The [harmony helper](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/harmony.py) maps minor keys to their relative majors and measures shortest distance around the circle of fifths. It searches shifts within two semitones and prefers a smaller shift when distances tie.

That is a convenient compatibility measure, with obvious limits. Relative major and minor aren't interchangeable musical experiences, and compatible keys don't guarantee compatible arrangements.

The recommendation code chooses among `pivot`, `relative`, `direct`, `transposition`, `vamp`, and `direct_modulation`. Close keys get a two-beat gap with no crossfade. More distant cases get four-, six-, or eight-second overlaps depending on the branch. The transposition branch is checked before the vamp branch.

These names describe recommendations. The renderer doesn't synthesize a vamp or construct a pivot-chord passage. Low key confidence adds a warning here; the constructor's separate validator rejects a nonzero shift when the applicable incoming confidence is known and below 0.6. Missing confidence doesn't trigger that rejection.

## From beats to milliseconds

The [render worker’s audio engine](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/render-worker/src/sow_render_worker/audio_engine.py) uses the incoming item's recording tempo to convert its gap from beats to milliseconds. It doesn't consume the constructor's boundary BPM. If tempo is unavailable, it falls back to one second per requested beat.

With crossfade enabled and a duration set, the gap becomes zero. The incoming start is the previous end plus the gap minus the overlap, clamped at zero. Fade filters shape the overlap, delay filters place the tracks, and FFmpeg mixes them. Optional loudness normalization targets −14 LUFS for the resulting mix.

That is enough to produce a continuous file. It doesn't check for overlapping vocal lines or choose a better place inside a chorus to make the edit.

## Saved settings that don't change the mix

`key_shift_semitones` and `tempo_ratio` are loaded and stored, but the reviewed render worker applies neither. There is no pitch-shift or time-stretch filter in its audio path. The [audio engine tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/render-worker/tests/test_audio_engine.py) are useful for the implemented timing and filter behavior; they aren't listening evaluations.

This leaves an awkward gap between scoring and delivery. A proposal can satisfy a harmonic rule through a suggested transposition that the rendered file never receives. I would fix that before presenting transposition as a working audio control.

For now, the practical check is to listen to the rendered transition. A favorable distance or technique label is a reason to try a pair, not a verdict on how it sounds.
