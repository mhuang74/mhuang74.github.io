---
title: "The transition engine: judge the seam, not the song"
author: Michael Huang
pubDatetime: 2026-10-27T00:00:00Z
slug: sow-transition-engine
featured: false
draft: false
tags:
  - stream-of-worship
  - audio
  - design
description: "Crossfades, beat-aligned gaps, and boundary keys: why transition quality is judged at the seam, not on whole-song averages."
---

Two songs can both be excellent and still refuse to sit next to each other. A transition isn't a property of either song. It's a property of a _pair at a specific point in time_: the moment the first song stops and the second begins.

Almost every music tool describes a song with one number per attribute — one tempo, one key, one loudness. That's fine for browsing a library and useless for joining two tracks, because the two ends of a song are usually not its average. A song that opens with solo piano at 72 BPM and closes with a full band at 88 has a mean tempo that describes neither end, and a key detected over the whole track may describe a chorus the transition never touches.

So the transition engine runs on one rule: score the exit of the first song against the entry of the second, and pick a technique that fits the relationship you find there.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [Synced lyrics from messy sources](/posts/sow-lyrics-pipeline). Next: [The songset constructor](/posts/sow-songset-constructor).

<!-- more -->

## The problem

Three concrete problems sit between "the songs are analyzed" and "the songs can be joined."

**Which key?** A song can have a song-level key from the catalog and a set of component-level keys from analysis. If song A's exit key comes from component analysis and song B's entry key falls back to its song-level key, a harmonic distance computed across them is comparing two different kinds of estimate. That's not a small inaccuracy. It's a category error, and it produces confident nonsense.

**Which tempo?** Same problem, worse consequences. Tempo drives the gap length in beats, so a wrong boundary tempo produces a gap that's musically wrong and audibly so.

**Which technique?** Harmonic distance alone doesn't determine what to do. Two songs a fourth apart want different treatment than two songs in the same key, and a fixed crossfade applied to everything is a decision to stop making decisions.

## Breaking it down

- **Boundary features.** Read entry and exit features from component analysis where they exist, and never mix provenance within a pair. Done when a pair uses component data on both sides or song-level data on both sides, never one of each.
- **Harmonic compatibility.** Reduce both sides to comparable pitch classes, compute circle-of-fifths distance, and map distance to a score. Done when minor keys are handled as their relative majors, so an A-minor/C-major pair scores as compatible.
- **Technique selection.** Choose crossfade length and gap from the relationship. Done when the mapping is a deterministic function of distance and mode, with no model involved.
- **Render math.** Turn beats into milliseconds, then into an actual FFmpeg segment. Done when the arithmetic is testable in isolation from the encoder.
- **Honesty about parameters.** Done when anything reaching the database, the editor, or the chapters JSON either changes the output or is labelled as intent rather than signal.

## What I built

### The seam model

Each item in a songset carries five transition parameters: `gapBeats`, `crossfadeEnabled`, `crossfadeDurationSeconds`, `keyShiftSemitones`, and `tempoRatio`. Defaults are a 2.0-beat gap, crossfade off, zero shift, and a 1.0 ratio. Editor ranges are a 0–8 beat gap in 0.5 steps, a 0–10 second crossfade in the API (0.5–5 s in the editor slider), a shift of −12 to +12 in the songset API and −6 to +6 in the preview endpoint, and a ratio of 0.5–2.0.

That shift range asymmetry is on purpose. The preview endpoint is for auditioning, and an audition that lets you go an octave out is an audition that wastes your time. The full API takes the wider range because a saved plan might be edited offline and re-previewed.

### Boundary aggregation, all-or-nothing

Component rows carry a role — `entry`, `exit`, `entry_exit`, `loop_target`, `none` — and aggregation reads entry from rows marked `entry` or `entry_exit`, exit from `exit` or `entry_exit`.

The provenance rule is the interesting one: **keys never mix provenance within a pair.** If both sides have component keys, the pair is scored on component keys and the source records as `component`. Otherwise both sides fall back to song-level keys and the source is `song_level`. There's no state where one side is component-derived and the other is song-level.

Tempo works differently, because it's per-side rather than per-pair. Each side falls back independently to its song-level tempo, emitting a warning that names the song and says the song-level value was used. If both sides are missing, the warning says the delta is unreliable instead of pretending otherwise. The asymmetry between key and tempo is intentional: a key comparison across mixed provenance is meaningless, while a tempo delta with one known value is merely less precise.

### Harmonic compatibility

Both keys reduce to pitch classes, with minor keys mapped to their relative major via `(pc + 3) % 12`. Distance is the shortest step count around the circle of fifths, and distance maps to a score:

| Circle-of-fifths distance | Compatibility score |
| ------------------------- | ------------------- |
| 0                         | 1.00                |
| 1                         | 0.92                |
| 2                         | 0.78                |
| 3                         | 0.55                |
| 4                         | 0.32                |
| ≥ 5                       | 0.15                |

The steep drop between 2 and 3 is the point of that table. A whole-step or fourth relationship between keys is a normal musical move. Three steps around the circle is where you start needing a musical excuse.

Alongside the distance, the engine suggests a transposition by searching `{−2, −1, 0, +1, +2}` and choosing the candidate that minimizes, lexicographically, the shifted distance, then the absolute shift, then the signed shift. Lexicographic ordering means the smallest useful transposition always wins a tie, which keeps the suggestion honest: it never proposes +2 when +1 achieves the same distance.

Key confidence gates the suggestion. Below 0.6 on either side, the engine emits `low_key_confidence` and hard constraint H8 refuses to build a set that relies on transposing those songs. A transposition derived from an unreliable key estimate is just a way to be wrong more loudly.

### Technique selection

Distance and shift select a technique. `recommend_transition` returns the distance, the suggested shift, the tempo delta, any warnings, and the chosen technique with its crossfade and gap. The technique selection itself is a plain ladder:

```python file="ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/transitions.py:88-107"
    if distance <= 1:
        technique = "pivot"
        crossfade_seconds = 0.0
        gap_beats = 2.0
    elif distance <= 2:
        technique = "relative" if from_mode != to_mode else "direct"
        crossfade_seconds = 0.0
        gap_beats = 2.0
    elif shifted_distance <= 2 and shift != 0:
        technique = "transposition"
        crossfade_seconds = 4.0
        gap_beats = 4.0
    elif distance == 3:
        technique = "vamp"
        crossfade_seconds = 6.0
        gap_beats = 4.0
    else:
        technique = "direct_modulation"
        crossfade_seconds = 8.0
        gap_beats = 6.0
```

Read as a ladder, it says this: close relationships get a short gap and no crossfade, because the songs already agree and a crossfade would smear two different grooves into each other. Distant relationships get progressively longer crossfades and longer gaps, because the listener needs time to be moved. The `direct_modulation` branch — eight seconds of crossfade, six beats of gap — is the engine saying "these don't belong together, here's as much cushioning as the format allows."

Note the ordering. Transposition is checked _before_ the vamp branch. A pair at distance 3 that a single semitone would fix gets scored as a transposition, not a vamp. Cheaper remedy first.

### Render math

The render worker converts those parameters into a timeline. Gap first:

```python file="delivery/render-worker/src/sow_render_worker/audio_engine.py:61-69"
def calculate_gap_ms(item: SongsetItem, tempo_bpm: float | None = None) -> int:
    if item.crossfade_enabled and item.crossfade_duration_seconds:
        return 0
    gap_beats = item.gap_beats if item.gap_beats is not None else 2.0
    if tempo_bpm and tempo_bpm > 0:
        beat_duration_ms = 60000.0 / tempo_bpm
        return round(gap_beats * beat_duration_ms)
    else:
        return round(gap_beats * 1000)
```

Three behaviours are packed into nine lines. **A crossfade zeroes the gap**, because you can't have both — one is silence, the other is overlap. **Beats convert at the boundary tempo** when a tempo exists, so a 2-beat gap is 857 ms at 140 BPM and 1,333 ms at 90 BPM: same musical instruction, different clock time. **With no tempo it falls back to milliseconds-per-beat treated as 1 second**, a degraded mode that keeps the render moving instead of failing.

Segment placement is then `max(0, previous_end + gap_ms − crossfade_ms)`, so a crossfaded pair starts before the previous segment ends. Each segment gets an FFmpeg `afade` in and out, the segments are combined with `amix` at `normalize=0:dropout_transition=0` so the mixer doesn't rescale the sum, and the result is loudness-normalized to −14 LUFS with a true-peak ceiling of −1.5 dBTP and an LRA target of 11. Encode is MP3 at 320 kbps, 44.1 kHz, stereo.

Every one of those numbers is a decision with a reason behind it. `normalize=0`, for instance, because the default `amix` normalization drops the level of the whole file as inputs increase, which would make a five-song set quieter than a two-song set.

## The part that's intent, not signal

This is where I have to be precise about what the system actually does.

`keyShiftSemitones` and `tempoRatio` are selected by the pipeline, persisted in the database, editable in the web app, and emitted into the chapters JSON. The UI displays `bpm × ratio`. And **the render worker applies neither one**. There is no pitch-shift filter, no resampling filter, and no time-stretch filter anywhere in the render worker — I checked that by searching the whole component for the obvious candidates. The values are carried through as metadata describing what the plan intended, while the audible output is untouched audio joined by fades.

I didn't intend that when I designed it, and it's the single most misleading thing in the product surface: a parameter that looks like a knob, persists like a knob, and does nothing.

The reasons it stayed that way aren't mysterious. Pitch-shifting a vocal by a semitone changes the formants unless you use a formant-preserving algorithm, and a worship recording shifted without that care sounds like a different singer. Time-stretching changes the groove, and every tempo-matching strategy degrades the feel of a recording whose tempo was a performance decision. Both are things a musician would hear immediately and reject. And there's no A/B harness that would tell me whether a +1 shift improves a transition or merely changes it, so shipping the DSP would have meant shipping an opinion with an encoder behind it.

So the engine _recommends_ a transposition and _records_ it, and a human is expected to act on it — by picking a different recording, say, or by having the band play in that key. The design document imagined the renderer doing it automatically. The shipped system doesn't.

## Design doc versus shipped path

The original spec is a useful measure of how much the design changed:

| Concern                     | Spec planned                 | Shipped                                         |
| --------------------------- | ---------------------------- | ----------------------------------------------- |
| Downbeat and beat detection | madmom                       | All-in-One + a separate downbeat app            |
| Time-stretch / pitch-shift  | pyrubberband                 | Not applied by the render worker                |
| Job orchestration           | Celery + Redis               | In-memory queue + SQLite store, SQS for renders |
| Transition latency          | Under 2 seconds              | Minutes, as a batch render                      |
| Automation                  | 95% of transitions automatic | Deterministic recommendation + human choice     |

Every row moved toward less machinery and more explicit decisions. Not because the original plan was wrong about what would be nice, but because each of those components would have added a failure mode to a path that already had enough of them.

## What broke

**Mixed key provenance produced a nonsense distance.** Before the all-or-nothing rule, a pair could be scored with one component key and one song-level key, and the resulting distance occasionally recommended a transposition for songs that were already in the same key. The fix was a rule, not a model.

**A missing boundary tempo silently produced a wrong gap.** The gap fell back to beats-as-seconds, which at 140 BPM makes a 2-beat gap 40% too long. The render still succeeded. The warning exists now, and this is the kind of failure that only surfaces by listening to the output rather than by reading a log.

**The preview endpoint and the editor disagreed about crossfade range.** The API accepts 0–10 seconds; the slider offers 0.5–5. A value of 8 seconds saved from a script renders fine and is unrepresentable in the UI. Two surfaces validating the same field with different ranges is a bug just waiting for the first power user.

**A parameter with no consumer.** Covered above, and it's the one I'd undo first.

## Evidence

| Measure                           | Value                             | Note                                           |
| --------------------------------- | --------------------------------- | ---------------------------------------------- |
| Scored pairwise transitions       | 191,406                           | 438-song pool, computed once per run           |
| Technique ladder                  | 5 techniques                      | Distance- and shift-derived, no model          |
| Compatibility score range         | 0.15 – 1.00                       | Six buckets by circle-of-fifths distance       |
| Shift search space                | 5 candidates                      | `{−2, −1, 0, +1, +2}`, lexicographic tie-break |
| Confidence gate                   | 0.6                               | Below this, transposition is forbidden (H8)    |
| Gap, 2 beats at 140 BPM           | 857 ms                            | `gap_beats × 60000 / tempo`                    |
| Gap, 2 beats at 90 BPM            | 1,333 ms                          | Same instruction, different clock              |
| Loudness target                   | −14 LUFS, −1.5 dBTP, LRA 11       | Applied post-mix                               |
| Output                            | MP3 320 kbps, 44.1 kHz, stereo    | `normalize=0` to avoid gain loss with N inputs |
| Params persisted but not rendered | `keyShiftSemitones`, `tempoRatio` | Carried as intent metadata                     |

## What I'd do differently

1. **Never persist a parameter the renderer doesn't consume.** Either wire it to a filter or keep it out of the database and the UI entirely. A parameter that survives a save-and-reload cycle is a promise, and this one isn't being kept.

2. **Build the seam A/B harness before adding any DSP.** The reason transposition and tempo matching stalled is that there's no instrument to tell whether a shift improves a transition. That harness — same seam with and without, blind, repeatedly — is a day of work, and it's the prerequisite for every audio decision in this area.

3. **Measure transition acceptance as a rate, not a score.** Every number in the evidence table is a property of the algorithm. None of them is a property of the listening experience, and a compatibility score of 0.78 doesn't tell me whether a worship leader kept that transition or replaced it.

4. **Unify the parameter ranges in one schema.** The crossfade range exists in three places with two values. Ranges belong next to the type, not next to each input widget.

Source: [transitions.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/transitions.py) · [harmony.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/harmony.py) · [audio_engine.py](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/render-worker/src/sow_render_worker/audio_engine.py) · [transition design spec](https://github.com/mhuang74/stream_of_worship/blob/main/specs/worship-music-transition-system-design.md)
