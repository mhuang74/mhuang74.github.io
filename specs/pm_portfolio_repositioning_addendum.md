# Addendum — Framework Decision & Showcase Widget Mechanism

_Supplements: `specs/pm_portfolio_repositioning.md`. That plan is unchanged; this file records decisions from the stack-evaluation session (2026-09-28) that lock open questions it left implicit. Implementation NOT started._

## D1 — Framework verdict: stay on Astro

**Decision.** Keep Astro 5.12. Implement `pm_portfolio_repositioning.md` as written. Do not migrate.

**Why (evidence).**

- **Functional fit.** Spec's maximum interactivity (one stream_of_worship waveform/setlist widget, lazy per-post charts) is already achievable with the site's existing mechanism — `is:inline` vanilla scripts polling CDN globals, zero hydration (`src/components/VegaChart.astro:13`, `ChartXKCD.astro:19`, `DataTable.astro:48-123`). Nothing in the brief requires islands, an SSR adapter, or a UI framework integration.
- **Live-demo escalation is a hosting problem, not a framework problem.** Deploy target is GitHub Pages (`.github/workflows/main.yml:50`); `Dockerfile` is nginx-static-only. There is no server runtime anywhere. A future live demo (GAQL playground, embedded runnable agent) would be blocked by hosting even on Next.js. Smallest change at that point: Astro + Node adapter on a container host (Fly.io / Railway / VPS), NOT a framework swap.
- **High migration bar not met.** Interview-locked bar: switch only if a requirement exists Astro structurally can't serve. None does.
- **No lock-in trap.** Content is 7 posts in one collection (`src/data/blog`); any future migration is mechanically small. Staying is not lock-in — it is declining to pay a tax that buys nothing.
- **Signal is framework-invisible.** Audience is skimmer-weighted; the five positioning signals (customer pain points, product taste, aesthetics, hands-on technical, quick learning) are carried by case-study content, metrics, tokens, and restyled chrome — all spec work, none framework work. Eng reviewers do not ding PM candidates for Astro; quickly-learns is proven by Rust/LLM flagships, not the site's own stack.

**Escalation note (prevents future re-litigation).** If a live server-backed demo is later wanted, evaluate **Astro + Node adapter + container host** first. Framework migration is the LAST resort, justified only if a requirement emerges that SSR-Astro cannot serve. This note exists because the framework question, if reopened cold, has no memory of this analysis.

## D2 — Showcase widget mechanism: vanilla inline script (no island)

**Decision.** The stream_of_worship showcase widget (T6) is built as a vanilla `is:inline` script component, matching the existing `VegaChart.astro` / `ChartXKCD.astro` / `DataTable.astro` pattern. No `@astrojs/react`, `@astrojs/svelte`, or any UI framework integration is added to the site.

**Why.**

- Zero `client:*` hydration directives exist anywhere in the codebase today. Adding a framework integration for ONE component introduces a permanent dependency for marginal gain.
- Audio playback / setlist browsing / waveform rendering are well inside vanilla-JS reach (Web Audio API, `<audio>` element, Canvas/SVG waveform).
- Keeps the framework question fully closed: no new runtime, no hydration lifecycle to reason about, deploy model unchanged.

**Constraint carried into T6.** The widget must degrade gracefully without JS (static fallback content), and it must not add a global CDN dependency — any libraries it needs (e.g. a waveform renderer) load per-component, per the T2 pattern.

## Interview record (what was locked, 2026-09-28)

| Axis | Decision |
|---|---|
| Primary audience | Both recruiters and peers, weighted toward skimmers |
| Interactivity ceiling | Spec ceiling for launch; live-demo escalation named as post-launch |
| Stack as signal | Invisible — stack carries no message to evaluator |
| Migration bar | High — switch only on structural unfit |
| Time allocation | Ship in Astro; no new-framework learning during repositioning |
| Widget mechanism | Vanilla inline script, no framework integration |
| Bake-off candidates | None warranted |

## Status gates inherited into the main spec

- No implementation of T1–T7 has started.
- Content work (LinkedIn paste for T5, `[METRIC NEEDED]` numbers for T6) remains the true blocker; framework is not.
