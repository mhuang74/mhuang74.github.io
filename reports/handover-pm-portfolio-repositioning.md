# Handover — PM Portfolio Repositioning (specs/pm_portfolio_repositioning.md)

_Date: 2026-09-28. Branch `new_contents`. Committed through `f6e4462`; a second round of review fixes is applied in the working tree but NOT yet committed/verified._

## Summary of what's done

Spec T0–T7 implemented and committed (`f6e4462`), verified via `pnpm build` (0 errors), `astro check` (0 errors), and browser checks against `pnpm preview`:

- **T0**: Fact sheets for the three flagship repos (shallow-cloned to `/tmp/flagship-*`; clones may still exist). Key finding: stream_of_worship has NO committed audio/media (gitignored) — showcase widget is driven by `eval/run1_standard/proposals.json` instead.
- **T1** (`src/styles/global.css`, `src/components/TechStackCard.astro`): single warm accent family — light `#b34104` (5.62:1 vs `#fdfdfd`), dark `#ffa94d` (7.83:1 vs `#212737`), both WCAG AA. Dark `--border` neutralized (`#3a4254`). Inter Variable (body) + IBM Plex Mono 400/500 (accents) via @fontsource, imported in global.css. TechStackCard: emoji + raw cyan/yellow/orange borders removed; token-based.
- **T2** (`src/layouts/Layout.astro` + chart components): global ~700KB CDN block removed. Shared `window.loadClassicScript(src)` defined inline in Layout — fetches pinned UMD source and evaluates via `new Function(code).call(new Function('return this')())`, per-URL memoized promise. Per-component sequential loading:
  - `VegaChart.astro`: vega → vega-lite → vega-embed (pinned 5.21.0/5.2.0/6.20.2), render after load + `astro:after-swap` re-render.
  - `ChartXKCD.astro`: same pattern, single lib.
  - `DataTable.astro`: jQuery → DataTables + CSS link injection.
  - **Why fetch+eval instead of `<script src>` or esm.run**: (a) Puppeteer-injected module scripts execute strict-mode, so UMD factories with `this`-dependent exports silently no-op; (b) esm.run bare-package URLs resolve to latest majors (vega-lite v6 warnings) and its CJS wrappers break jQuery-plugin binding. Both failure modes were empirically diagnosed in-browser.
- **T3**: `src/data/work/` collection (schema: title/role/team/stack/outcomes/featured/pubDatetime/description), `WorkCard.astro`, `/work` index, `/work/[slug]` case-study template.
- **T4** (`src/pages/index.astro`): Hero (explicit PM+builder h1, mono eyebrow, CTA) → Featured Work → Focus Areas → Featured/Recent Writing → About teaser.
- **T5** (`src/pages/about.md` + `AboutLayout.astro`): story/now/contact; contact CTA = `<Socials />` in AboutLayout. Career-arc paragraph is a marked placeholder — blocked on owner's LinkedIn paste.
- **T6**: three case studies in `src/data/work/`. Quantified claims either verbatim from repos (`~3-4s RAG gen`, `60+ fields/12 resources validated`, `438 songs / 191,406 transitions`) or `[METRIC NEEDED: …]` placeholders (CONTEXT.md forbids fabrication). `ShowcaseSetExplorer.astro` on the SOW page: interactive tab explorer, noscript fallback, theme-reactive via MutationObserver on `data-theme`.
- **T7** (`Header.astro`, `Footer.astro`): nav = Work/Writing/About; Tags+Archives demoted to footer links.

## Verification already done (browser, main-world DOM relay)

Puppeteer `page.evaluate` runs in an ISOLATED world — custom `window.*` globals are invisible to it even when set by page scripts. To read main-world state, relay through a DOM attribute written by an injected `<script>` element (pattern used successfully; reuse it). Verified: 5 vega canvases on `/posts/google-asset-based-ad-extensions`, xkcd+vega on `/posts/quick-look-at-charts`, DataTable 10 rows + paginate + search on `/posts/test-table`, homepage 9 requests with ZERO CDN chart libs, theme toggle round-trip, no emoji in main, fonts computed as Inter/IBM Plex Mono, showcase tab switching re-renders lanes/scores. Screenshots confirmed visual state (light+dark).

## Second-round review fixes — applied in working tree, NOT committed, NOT browser-verified

1. **`src/components/ShowcaseSetExplorer.astro` rewritten**: dataset now imported at build time from `src/assets/sow-songset-run1-standard.json` (verbatim copy of the repo's `eval/run1_standard/proposals.json`) instead of hand-transcribed values (which had wrong sub-scores). Header shows run_id; visible in-widget note: "Waveform bars are synthetic placeholders — no audio is shipped…"; noscript fallback now generated from the same data (all 5 proposals).
2. **`src/components/WorkCard.astro`**: `showOutcome = outcome && !outcome.startsWith("[METRIC NEEDED")` — placeholder outcomes no longer render on cards (homepage//work surface stays clean until owner metrics land; keep placeholders in case-study bodies).
3. **`src/data/work/stream_of_worship.mdx`**: showcase paragraph rewritten — old text falsely claimed "proposal 2 wins on tempo flow" (data says prop1: tempo 0.6415 vs 0.526). New text matches verbatim scores and describes the real tradeoff (prop1 dominates; constructor accepted 4s crossfade +1 semitone shift in props 2/5; props 3/4 within 0.15 composite).
4. **Swap-safety**: widget script now has `data-astro-rerun` + `root.dataset.sowInit` double-bind guard (ClientRouter dedupes identical inline scripts by textContent on revisit — old version rendered empty lanes on second visit).

`pnpm astro check` and `pnpm build` pass after these changes (0 errors). Remaining: browser-verify (widget renders, tabs switch, revisit-through-ClientRouter doesn't blank the lanes, cards show no `[METRIC NEEDED]`) then commit.

## BLOCKER: omp browser daemon is broken (harness-side, not site-related)

`browser.open` fails with "Shared browser daemon unavailable". Root cause chain: `/usr/local/bin/chromium` (daemon's configured binary) vanished from the system; I symlinked it to `/usr/bin/google-chrome` (Chrome 154) — binary works (`chromium --version` OK). The daemon still fails: its broker process dies without writing `broker.token`/`broker.sock` in `~/.omp/run/daemons/<scope>/` (scope `94cbe3e240a708ba` for this project). `omp --smoke-test` passes; `omp ps` shows "broker not running". Purging the scope dir didn't help; each `browser.open` recreates the scope but the broker crashes at startup. Logs: `~/.omp/logs/omp.2026-09-28.*.log` (all show the same ENOENT on broker.token). If it persists, alternatives: (a) restart the omp session/daemon host, (b) `npx playwright`/`chromium --headless` + CDP script for the DOM-relay verification, (c) ask the user to restart the harness. Do NOT sink more time into purging `~/.omp/run` — that was tried.

## Remaining tasks (for anyone continuing)

1. Browser-verify the four working-tree fixes above (needs working browser or manual check via `pnpm preview` + real Chrome).
2. Commit the fixes (message should reference "second-round review: JSON-derived widget dataset, card placeholder suppression, prose correction, swap-safe widget script").
3. Owner-input blockers (unchanged): `[METRIC NEEDED]` numbers for the three case studies → then flip `featured: true` (currently `false` on all three); LinkedIn career arc for About.
4. Optional post-launch items from spec: OG-image template accent clash check; `safari-pinned-tab.svg` legacy icon debt (both explicitly out of scope this pass).

## Caveats

- Preview server: `nohup pnpm preview --port 4322 >/tmp/preview.log 2>&1 & disown` works; the omp service wrapper (`name`/`ready`) failed to start this session ("Failed to start daemon broker" — same root cause as the browser daemon).
- `src/assets/sow-songset-run1-standard.json` is a verbatim copy of upstream eval output — if the SOW repo regenerates evals, re-copy rather than hand-edit.
- The spec's T6 "preferred: playable audio/waveform element" was satisfied with the JSON-driven setlist/waveform-widget fallback per addendum D2 (vanilla inline script, no framework, no new CDN deps); real audio would require owner-provided rendered artifacts (none in repo).
- `/tmp/flagship-*` clones and `/tmp` screenshots are ephemeral.
- CONTEXT.md gate: no `featured: true` with placeholders — this is why homepage has no Featured Work section right now; that's intentional, not a bug.
