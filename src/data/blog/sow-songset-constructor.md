---
title: "The songset constructor: worship practice as a constrained search"
author: Michael Huang
pubDatetime: 2026-10-28T00:00:00Z
slug: sow-songset-constructor
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - design
description: "Encoding the five-phase worship arc, 12 themes, nine hard constraints, and a weighted objective into a songset search."
---

Building a worship set isn't picking good songs. It's picking a _sequence_ of good songs that satisfies a pile of constraints nobody ever wrote down. It has to open with something the congregation can join immediately. It has to move toward intimacy instead of away from it. It has to stay in a vocal range people can actually sing. It has to close in a state that hands off to the benediction. And it has to do all of that in twenty-five minutes with the songs this particular church knows.

That's a constraint satisfaction problem with an aesthetic objective, and it's exactly the kind of problem where the obvious move — ask a language model to propose a set — fails in a specific way. A model will produce a plausible-looking set. Plausible isn't valid. It'll happily put a 68 BPM ballad after a 140 BPM opener, or open with a song that has no congregational line, and it'll explain either choice beautifully.

Stream of Worship's constructor starts from the opposite premise. Validity is decided by deterministic arithmetic over measured features. The model proposes and annotates. It never validates.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [The transition engine](/posts/sow-transition-engine). Next: [The web app](/posts/sow-webapp-architecture).

<!-- more -->

## The problem

Three things are missing before a search can even run, and each one is a research problem dressed up as a data problem.

**There's no definition of a valid set.** Worship practice is tacit. Leaders know a set shouldn't open with a response song and shouldn't close with a call to praise, but "knowing" means a five-phase intuition, not a rule anyone can code. I had to write the arc down as a decision record before I could enforce it.

**The catalog has no theme tags.** The only theme information anywhere upstream is a handful of informal tags in a research document — nine of them, most of which don't exist as database columns. Phase assignment needs a theme per song, per section, and there isn't one.

**The objective is aesthetic.** "Good set" is not a number. Any fitness function is a lossy encoding of a leader's judgment, and the failure mode is a search that optimizes the encoding instead of the judgment, producing sets that score well and feel wrong.

## Breaking it down

- **The arc.** Fix the phase structure as a template. Done when every generated set has exactly one song per template slot, in order.
- **Phase inference.** Assign every recording to one or more phases with a confidence. Done when coverage is measured and stated rather than assumed, and songs without data fall back deterministically.
- **Hard constraints.** Encode the rules a set must not break. Done when a violated set is rejected with the violation named, and the validator has no model in it.
- **Fitness.** Encode preference, with weights I can justify. Done when each component is bounded, interpretable, and independent.
- **Search.** Enumerate the space well enough to produce diverse top-k proposals. Done when the same inputs produce the same proposals, and dead ends are avoided rather than pruned by luck.

## What I built

### The arc as a template

ADR-0003 fixes a five-phase shape: 讚美 (Call) → 感恩 (Thanksgiving) → 敬拜 (Worship) → 奉獻 (Response) → 差遣 (Commission). Set sizes map to templates — two songs take slots (1, 4), three take (1, 3, 5), four take (1, 3, 4, 5), five take (1, 2, 3, 4, 5). Six or more gets rejected with `--count supports only 2-5`, because there's no liturgical template for it and inventing one on the fly would be guessing.

Fixing the arc instead of inferring it was a trade I made on purpose. Inferring an arc from the selected songs would let the tool accept almost anything. Fixing it means the constructor can only fail by not finding songs, which is a failure I can diagnose. It also keeps the constraint set coherent: the opener-tempo floor and the closer-tempo ceiling are rules _about specific phases_, and they only make sense because the phase order isn't negotiable.

### Themes: deriving what the catalog doesn't have

The 12-value theme vocabulary is Traditional Chinese, and each theme maps to exactly one phase:

```python file="ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/phases.py:7-20"
THEME_TO_PHASE = {
    "讚美": 1,
    "感恩": 2,
    "敬拜": 3,
    "祈禱": 3,
    "信心": 3,
    "聖靈": 3,
    "奉獻": 4,
    "認罪": 4,
    "十字架": 4,
    "差遣": 5,
    "跟隨": 5,
    "復興": 5,
}
```

The phase vocabulary is coarser than the theme vocabulary: four themes map to phase 3 and three map to phase 5. That's the encoding of a musical judgment — "worship," "prayer," "faith," and "Holy Spirit" songs are interchangeable in the worship slot of a set, while "commissioning," "following," and "revival" all work as closers.

Classification is **component-primary**. Instead of classifying a whole recording, the system classifies its sections: a chorus row carries weight 1.0 and a non-chorus row 0.5, scaled by each row's theme confidence and normalized into a distribution over themes. A song whose final chorus is a commission and whose verses are thanksgiving is a commission song, because that's the part the congregation will be singing last.

Coverage is where I have to be blunt. 312 of 444 recordings (70.3%) have component rows, so roughly three in ten fall back. The fallback fuses four signals — title, lyrics, song-level embedding, line-level embedding — with agreement weights of 0.45 / 0.35 / 0.15 / 0.05 and disagreement weights of 0.35 / 0.25 / 0.25 / 0.15. When even that produces nothing usable, a tempo-band fallback assigns a phase: ≥100 BPM to phase 1, ≥90 to 2, ≥70 to 3, else 4. Secondary phases are kept only when they reach 0.85 × the dominant score, capped at two.

That tempo fallback is a blunt instrument and I labelled it as one. Its purpose isn't accuracy. It's making sure no song is _unusable_ just because a model had no opinion.

### Nine hard constraints

H0 through H9, each with a numeric threshold and a nameable failure:

| ID  | Constraint                           | Threshold                                                                   |
| --- | ------------------------------------ | --------------------------------------------------------------------------- |
| H0  | Set size matches the request exactly | 2–5 songs                                                                   |
| H1  | Phase shape                          | Exactly one phase-1 opener; ≥1 phase 3/4 in the middle; closer in phase 4/5 |
| H2  | Opener entry tempo                   | ≥ 90 BPM                                                                    |
| H3  | Closer exit tempo                    | ≤ 90 BPM (≤ 80 intimate)                                                    |
| H4  | Adjacent boundary tempo delta        | ≤ 45 BPM with crossfade/gap, ≤ 40 without (55 when relaxed)                 |
| H5  | Adjacent harmonic distance           | ≤ 3 (≤ 4 relaxed) unless a shift is applied                                 |
| H6  | Song identity                        | No duplicate song IDs                                                       |
| H7  | Phase monotonicity                   | Phase drop ≤ 1 between adjacent songs                                       |
| H8  | Transposition safety                 | Requires key confidence ≥ 0.6                                               |
| H9  | Total duration                       | ≤ 1500 s (25 min)                                                           |

H7 is the subtlest one. A set may go 1 → 4, because a big jump forward is a deliberate dramatic move, but not 4 → 1, because a set that returns to praise after the response has no theological shape. Allowing a drop of one catches the accidental case without forbidding a legitimate one.

When nothing satisfies everything, the search relaxes in stages and every stage labels its output. First a five-song request gets retried against the four-song template (`fell_back_to_4_song_template`). Then H4 and H5 relax **together** (`relaxed_H4_H5`) — a wider tempo jump and a wider harmonic distance are the same musical concession, so paying for both at once is cheaper than paying for them one at a time. Then, with automatic relaxation enabled, the arc gates widen as a pair: the opener floor drops to 80 BPM and the closer ceiling rises to 100 BPM (90 for an intimate close), labelled `relaxed_H2_H3`. Relaxing H1 — the phase shape itself — is a separate, last-resort opt-in, because a set with the wrong arc isn't a set worth handing to a worship leader.

### Fitness: containing the model with arithmetic

Base weights are theme 0.40, tempo 0.30, harmony 0.20, diversity 0.10. Energy and posture are _conditional_. They join at 0.05 each only when the signal exists across the whole pool, and their absence redistributes proportionally into the base:

```python file="ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/fitness.py:116-140"
W_BASE: dict[str, float] = {"theme": 0.40, "tempo": 0.30, "harmony": 0.20, "diversity": 0.10}


def score(
    proposal: SongsetProposal,
    config: RunConfig,
    matrix: dict[tuple[str, str], TransitionCandidate],
) -> ScoreBreakdown:
    theme = f_theme(proposal, config.count)
    tempo = f_tempo(proposal)
    harmony = f_harmony(proposal, matrix)
    diversity = f_diversity(proposal)
    energy = f_energy(proposal)  # None when the signal is absent pool-wide
    posture = f_posture(proposal)  # None when the signal is absent pool-wide
    absent = (energy is None) + (posture is None)
    scale = 1.0 - 0.05 * (2 - absent)
    weights = {key: round(value * scale, 4) for key, value in W_BASE.items()}
    total = (
        weights["theme"] * theme
        + weights["tempo"] * tempo
        + weights["harmony"] * harmony
        + weights["diversity"] * diversity
    )
    if energy is not None:
        total += 0.05 * energy
```

That scale factor is the whole idea in one line. With both signals present, the base weights shrink by 10% to 0.36 / 0.27 / 0.18 / 0.09 and energy and posture take 0.05 each. With one absent, the base shrinks by 5%. Weights always sum to 1.0, so a score is comparable across runs even when the available signals differ — which matters, since the score is what the operator sees while choosing between proposals.

Two components deserve their own explanation, because they're where the encoding could go wrong:

**Tempo fit is 0.75 × smoothness + 0.25 × arc bonus.** Smoothness is `1 − Σ|ΔBPM| / (25 × gaps)`, clamped at zero — a normalized penalty on total tempo movement, so a set with four small steps beats a set with one huge jump. The arc bonus is 1.0 when the opener is at least as fast as the closer, which encodes "land softer than you open" as a binary.

**Energy is ordinal, never absolute.** The score uses pool-percentile ranks of entry and exit energy, blended 0.5 adjacency + 0.5 arc shape, and it penalizes a set that ends louder than it opened. Absolute loudness would compare a studio master to a live recording and reward mastering choices. Percentile ranks compare songs to each other, and that's the only comparison that survives the source heterogeneity.

**Posture fit is a small lookup table** — three postures against five phases. "About God" songs fit phase 1 and phase 5 (1.0) and phase 4 (0.0); "to congregation" songs fit phases 1, 4, and 5. That table is where theology enters the objective function, and it's crude on purpose. A finer model would be a claim I can't defend.

### Search

Beam search over template slots, with a precomputed transition matrix treated as read-only. The matrix is the expensive artifact — for a 438-song pool that's 191,406 ordered pairs, each with a boundary key comparison, a boundary tempo delta, and a technique recommendation — and it gets computed once per run instead of inside the beam loop.

Dead-end songs are only permitted in the final position, because a song with no viable successor will otherwise eat a beam slot at position two and strand the search.

The canonical entry point is a 12-step skill workflow that calls this shared rules package, not the older in-CLI command or the LangGraph proof of concept; both are deprecated. That matters for reproducibility: the rules are one package, so a fitness number from an evaluation run means the same thing as a fitness number from an interactive session.

### The LLM's job

The language model plans and annotates. It doesn't reorder, doesn't approve, and doesn't compute the score. Its output is commentary on proposals that have already been validated and ranked by `score_songset`.

There's a deterministic fallback path that needs no model at all, and that's the real test of whether the division of labour is honest: if the search can't run without the model, the model is doing validation work no matter what the design says.

## What broke

**The diversity term was degenerate.** My first implementation measured diversity by counting non-zero entries in the per-song theme distributions. But every song's theme dict was dense — all 12 themes with scores, many near zero — so the term counted `12 × items` for every proposal and returned the same value for all of them. A fitness component that's constant across candidates is worse than no component at all. It eats 10% of the weight budget, contributes nothing, and makes the score _look_ more considered. The fix was measuring distance between normalized distributions, and the spec now records explicitly that the dense-dict counting must not come back as an "optimization."

**Pool exhaustion is not a bug.** Some runs can't fill a phase, because the catalog doesn't have qualifying songs for it. In the first standard run, phase 2 was absent from every one of the top-k proposals — not because the search failed, but because nothing in the pool cleared the phase-1 tempo floor and the phase-2 theme requirement at the same time. The output was correct and looked broken. That wants a per-phase pool-health check before the search, not a different search.

**Stale caches validated silently.** A cache written before component metadata existed produced proposals with plausible scores and no component-derived phases. Nothing errored. The numbers were just computed from older features. Versioning the cache namespace is the same lesson as the key algorithm version in the analysis pipeline, and I learned it twice.

**A bare `python` invocation wrote a 0-byte output.** The run looked like it succeeded, and the downstream parse failed with a JSON decode error two steps later. The root cause was the wrong interpreter, not wrong data. Exit codes aren't enough; artifact shape has to be asserted.

**Enrichment moved the numbers, which is the point.** Converting the enrichment corpus from Simplified to Traditional raised title matches from 76 to 106 and lyric matches from 342 to 372. The constructor wasn't wrong before that change. It was working with a fraction of the available evidence.

## Evidence

| Run                         | Composite (rank 1) | Theme        | Tempo         | Harmony | Diversity | Note                                           |
| --------------------------- | ------------------ | ------------ | ------------- | ------- | --------- | ---------------------------------------------- |
| run1 standard               | 0.8485             | 1.0          | 0.6415        | 0.78    | 1.0       | Phase 2 absent from all top-k                  |
| run3 intimate               | —                  | 0.875–0.9375 | —             | —       | —         | Intimate close mode (H3 at 80 BPM)             |
| run4 energetic              | —                  | —            | 0.3625–0.3925 | —       | —         | Tempo is the binding constraint at high energy |
| Enrichment (before → after) | —                  | —            | —             | —       | —         | Title hits 76 → 106; lyric hits 342 → 372      |
| Component-theme coverage    | 312 / 444 (70.3%)  | —            | —             | —       | —         | Remainder uses fused fallback                  |
| Transition matrix           | 191,406 pairs      | —            | —             | —       | —         | 438-song pool, precomputed once                |

Artifact: `eval/run1_standard/proposal_report.md`, `run3_intimate` / `run4_energetic` proposal JSON, `reports/enrichment_eval_comparison.md`.

## What I'd do differently

1. **Collect human set-quality ratings before tuning weights.** The 0.40 / 0.30 / 0.20 / 0.10 split is a judgment, and every adjustment after it gets validated against another judgment. Ten leaders ranking twenty sets would turn the objective from an opinion into a fit.

2. **Define 6+ song templates.** The holdup is doctrinal, not technical, but the effect is that the tool silently caps a long service at five songs, and there's no way to express a six-song set that's legitimate in some traditions.

3. **Add a per-phase pool-health check before search.** The run1 result — a missing phase producing proposals that look like failures — is a reporting problem with a cheap fix. Tell the operator the pool can't support phase 2 before spending a run discovering it.

4. **Make the diversity term's units explicit in its own module.** The bug was a mismatch between what the function measured and what its name claimed. A function whose contract is stated in terms of normalized distributions is harder to accidentally reimplement as a counter.

Source: [fitness.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/fitness.py) · [phases.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/phases.py) · [hard_constraints.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/hard_constraints.py) · [constructor guide](https://github.com/mhuang74/stream_of_worship/blob/main/docs/agent_guide_songset_constructor.md)
