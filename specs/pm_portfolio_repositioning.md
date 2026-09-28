# Reposition Site as Product-Manager Portfolio

_Status: plan only — NOT implemented. Do not edit this plan in place; supersede with a new spec if direction changes._
_Addendum (2026-09-28): framework verdict + showcase-widget mechanism locked in `specs/pm_portfolio_repositioning_addendum.md`. This plan unchanged._

## Context

Site is an Astro 5.12 + Tailwind v4 blog on the AstroPaper theme (`package.json` still named `astro-paper`). A read-only audit plus a structured interview established:

- Homepage (`src/pages/index.astro`) has **no hero** — opens with an `<Hr/>` then the "Focus Areas" section (`id="tech-stack"`), seven `TechStackCard`s with emoji icons and raw Tailwind `cyan/yellow/orange-400` left borders that bypass the token system.
- About page (`src/pages/about.md`) is one line: "Hi! I am Michael Huang."
- No font is loaded anywhere; body renders in Tailwind's default mono stack (`src/styles/global.css`). IBM Plex Mono is fetched only for OG images (`src/utils/loadGoogleFont.ts`).
- Split color identity: light accent `#006cac` (blue) vs dark accent `#ff6b01` (orange); dark `--border` is orange-tinted, not neutral. All tokens live in `src/styles/global.css:6-17` via Tailwind v4 `@theme inline`.
- ~700KB+ of chart/table JS (vega, vega-lite, vega-embed, chart.xkcd, jQuery, DataTables) loads globally from `src/layouts/Layout.astro` on every page; only a few posts use it.
- The three flagship projects exist only as GitHub repos, with no surface on the site: `github.com/mhuang74/stream_of_worship`, `github.com/mhuang74/mcc-gaql-rs`, `github.com/mhuang74/googleads-analyst-skill`.
- Glossary: `CONTEXT.md` (repo root). Terms used below — Positioning, Case Study, Flagship, Work card, Writing, Focus Areas, Showcase demo — are defined there.

## Decision record (interview-locked)

| Axis | Decision |
|---|---|
| Hero | Hybrid: explicit PM + builder headline, Featured Work directly beneath |
| Case-study depth | Mixed: 3 Flagships get full pages, all other projects are Work cards |
| Aesthetic | Systematic / product-like — the site itself demonstrates design eye |
| Tone | Warm professional; emoji never as UI decoration |
| Typography | Sans body + mono accents (eyebrows, labels, data) |
| Accent | One warm amber/vermilion family, distinct light + dark variants |
| IA | New `/work` section; nav = Work / Writing / About; Tags + Archives demoted |
| Homepage order | Hero → Featured Work → Focus Areas (restyled) → Recent Writing → About teaser |
| Demos | Lazy-load chart/table JS per post; one live interactive Showcase widget on the stream_of_worship case study |
| Metrics | Each Flagship carries ≥1 real quantified outcome; placeholders until owner supplies numbers |
| Scope | Homepage + About + /work + nav + global-token/font rework; blog post pages get token cascade only |
| Content effort | Agent drafts case studies from the three GitHub repos; owner fact-checks and supplies metrics |
| Color mode | Light default, dark via toggle (keep existing `toggle-theme.js` mechanism) |

## Approach

Phased; T0 feeds all copy work, T1 precedes all visual work.

### T0 — Research (feeds T5/T6)

- Scout the three flagship repos (README, code layout, demos, media assets) into a fact sheet per repo: what it does, stack, notable engineering, anything embeddable.
- Owner pastes LinkedIn role descriptions (public profile scrapes thin — only headline + certs are visible). Blocked on owner input; everything below except T5/T6 prose can proceed without it.

### T1 — Design tokens & typography (`src/styles/global.css`, `src/layouts/Layout.astro`)

- Replace the split accent with one warm amber/vermilion family: define light-mode and dark-mode accent variants as separate tokens; validate contrast of both against their `--background` values (light `#fdfdfd`, dark `#212737`) to WCAG AA for text/UI use.
- Make dark `--border` neutral (kill the orange-tinted border).
- Extend `@theme inline` with any new tokens rather than introducing raw palette colors.
- Load two fonts (one sans for body, one mono for accents) with `font-display: swap` — self-hosted via `@fontsource` preferred over Google Fonts CDN. Body switches from `font-mono` to sans; mono applied to eyebrows, labels, data, and code only.
- Restyle `TechStackCard`: remove emoji icons, replace raw `border-cyan-400/yellow-400/orange-400` with token-derived treatment; keep the grid layout.
- Keep AstroPaper's existing focus-visible/selection styles but re-point them at the new accent token.

### T2 — Prune global JS (`src/layouts/Layout.astro`)

- Remove the global CDN `<script>`/`<link>` tags for vega, vega-lite, vega-embed, chart.xkcd, jQuery, DataTables from the layout.
- Inject them only where used: the components/posts that render charts and tables (search for `vega-embed`, `chart.xkcd`, `DataTable` usages; likely `src/components/VegaChart.astro`, `ChartXKCD.astro`, `DataTable.astro`). Load per-component, deferred/lazy.
- Homepage payload drops accordingly; blog posts that need charts keep working.

### T3 — /work surface (new)

- Content collection for case studies (mirror the existing `src/data/blog/` + `content.config.ts` pattern), e.g. `src/data/work/` with frontmatter: `title, role, team, stack[], outcomes[], featured, publishDatetime, description`.
- Routes: `src/pages/work/index.astro` (all Work cards) and `src/pages/work/[slug]/index.astro` (case-study template: problem → constraints → decisions → artifacts → outcome; "technical appendix" cross-link into related blog posts).
- New `WorkCard.astro` component (title, role, stack chips, one metric, link). Not a restyled `Card.astro` — different data.

### T4 — Homepage restructure (`src/pages/index.astro`)

- Add hero section at top: the site currently lacks an `<h1>` on the homepage (other pages have one); headline = explicit PM + builder claim, one-sentence subcopy, CTA to `/work`.
- Section order locked: Hero → Featured Work (3 Flagship `WorkCard`s) → Focus Areas (restyled cards, heading/subcopy rewrite — current copy "Problems that I have worked on" is placeholder-grade) → Recent Posts renamed "Recent Writing" → About teaser (short pitch + link to `/about`).
- Keep existing post-query logic (`getSortedPosts`, featured/recent split) unchanged; `SOCIALS` include stays at the bottom.

### T5 — About rewrite

- Convert `src/pages/about.md` (or replace with `.astro` if section structure needs it) using `AboutLayout.astro`.
- Three sections, in order: professional story (career arc from LinkedIn paste), now/approach (current focus + working style, first person, warm), contact CTA (reuse existing social icons from `constants.ts`). No timeline-of-roles (explicitly excluded in interview).

### T6 — Flagship case studies (3 pages)

- One page per flagship repo, drafted from T0 research: stream_of_worship, mcc-gaql-rs, googleads-analyst-skill.
- Every quantified claim left as `[METRIC NEEDED: <what to measure>]` placeholder for the owner — fabricated numbers are forbidden by CONTEXT.md.
- stream_of_worship page hosts the **Showcase demo**: a small interactive widget built from repo artifacts (preferred: playable audio/setlist/waveform element). Fallback if the repo yields nothing embeddable: self-hosted recorded demo video. No YouTube embed.
- New blog entries for mcc-gaql-rs and googleads-analyst-skill are owner-indicated but are content work, not blocking; case-study pages can cross-link when those posts land (stream_of_worship's post is already added in this branch).

### T7 — Nav restructure (`src/components/Header.astro`, `src/constants.ts` if needed)

- Primary nav: Work (`/work`), Writing (`/posts`), About (`/about`). Keep search + theme-toggle icon buttons.
- Demote Tags and Archives out of the nav; if kept reachable, as footer links (`Footer.astro`). `SOCIALS` unchanged.

## Out of scope (explicit)

- Blog post/tag/archive page layout redesign — token cascade only this pass.
- OG-image template (`src/utils/og-templates/`) restyle — flag if accent there clashes.
- `safari-pinned-tab.svg` and other legacy icon debt — untouched.
- Deleting or migrating any existing blog content.

## Critical files & anchors

- `src/styles/global.css:6-17` — token definitions to rewrite (`@theme inline` mapping below it).
- `src/layouts/Layout.astro` — global CDN scripts to remove (T2); font `<link>`s to add (T1).
- `src/pages/index.astro` — hero + section reorder; featured/recent logic at file top stays.
- `src/components/TechStackCard.astro` — emoji + raw-color removal (T1).
- `src/components/Header.astro` — nav links (T7).
- `src/content.config.ts` — pattern to mirror for the work collection (T3).
- `src/pages/about.md` + `src/layouts/AboutLayout.astro` — rewrite (T5).
- `src/components/VegaChart.astro`, `ChartXKCD.astro`, `DataTable.astro` — per-component script loading (T2).

## Verification

- `pnpm build` clean; `pnpm preview` + browser check of every changed route: `/`, `/work`, each `/work/<slug>`, `/about`, `/posts`, one post with charts (confirm lazy-loaded chart still renders), `/tags` (confirm still reachable if demoted).
- Homepage: no emoji in UI chrome; fonts render as sans body / mono accents (devtools computed style); accent color identical family in both modes; toggle round-trips.
- Lighthouse (or devtools) on `/`: total JS weight down substantially versus the current ~700KB+ chart/table CDN payload; no vega/jquery requests on the homepage.
- Contrast: new accent vs both backgrounds passes WCAG AA for text-sized UI usage (automated check or manual measurement during T1).
- Per CONTEXT.md: no case study ships to `featured: true` with `[METRIC NEEDED]` placeholders remaining — owner metrics gate launch of each Flagship card on the homepage.
- `stream_of_worship` Showcase widget is interactive in preview (or recorded-video fallback is in place).
