# Contributing to michaelhuang.xyz

This site is an [Astro](https://astro.build) static site (AstroPaper theme). All content lives in two MDX/Markdown collections; charts and tables are rendered client-side by components you import in your post. This guide explains everything needed to write a new post or edit an existing one.

## Repo layout

| Path | What it is |
| --- | --- |
| `src/data/blog/` | Blog posts (`.md` or `.mdx`). One file = one post. |
| `src/data/work/` | Work case studies (`.md` or `.mdx`). One file = one case study. |
| `src/content.config.ts` | Zod schemas for both collections' frontmatter. |
| `public/` | Static files served at the site root (CSV data files, images). |
| `src/components/` | Chart/table components importable from MDX. |
| `src/config.ts` | Site-wide settings (author name, timezone, post count, etc.). |

**The filename is the URL slug.** `src/data/blog/my-post.mdx` → `/posts/my-post`; `src/data/work/my-project.md` → `/work/my-project`. A post in a subdirectory (`src/data/blog/series/part-1.mdx`) gets the directory in its URL (`/posts/series/part-1`). Note: some older posts carry a `slug:` frontmatter field — it is ignored; the schema has no such key and URLs come only from the filename.

## Writing a blog post

Create `src/data/blog/<your-slug>.md` (use `.mdx` only if you need to import components — see [Charts and tables](#charts-and-tables)). Minimal frontmatter, following `src/data/blog/handsoff.md`:

```yaml
---
title: HandsOff - Protection from little fingers and paws
author: Michael Huang
pubDatetime: 2025-11-14T00:00:00Z
featured: false
draft: false
tags:
  - building
description: A macOS utility to lock keyboard/mouse while leaving the screen viewable
---
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | |
| `pubDatetime` | yes | Full ISO-8601 with `Z`, e.g. `2025-11-14T00:00:00Z`. Future dates schedule the post: it stays hidden until 15 minutes before the timestamp (`scheduledPostMargin` in `src/config.ts`). |
| `description` | yes | Shown on cards, RSS, and social previews. This is the excerpt — there is no `<!-- more -->` separator. |
| `tags` | no | Defaults to `["others"]`. |
| `featured` | no | Puts the post in the homepage "Featured" section. |
| `draft` | no | `true` hides the post everywhere, in dev too. |
| `author` | no | Defaults to the site author. |
| `modDatetime` | no | Set when you materially edit a published post; displayed as "Updated". |
| `ogImage` | no | Remote URL, or path to an image asset. Falls back to the site default. |
| `timezone` | no | IANA name; defaults to `America/Los_Angeles`. |

**Body conventions**

- Add a `## Table of contents` heading where you want an auto-generated, collapsible TOC (`remark-toc` + `remark-collapse` are wired up globally).
- Headings, lists, fenced code blocks, links all work as standard Markdown. Code blocks use Shiki with a light theme (`min-light`) and dark theme (`one-dark-pro`); `// [!code highlight]`-style notation comments and diff markers are supported.
- Cross-link other posts by their URL path: `[another post](/posts/quick-look-at-charts)`.
- Static assets (CSVs, images) go in `public/` and are referenced with absolute paths: `/images/my-figure.png`.

## Writing a Work case study

Create `src/data/work/<project-slug>.md`. Frontmatter follows `src/data/work/mcc_gaql_rs.md`:

```yaml
---
title: "mcc-gaql-rs"
role: "Creator & Maintainer"
team: Solo
stack:
  - Rust (workspace, edition 2024)
  - tonic gRPC
  - Polars
outcomes:
  - "NL→GAQL generation in ~3-4s end-to-end"
featured: false
pubDatetime: 2026-09-28
description: Three Rust CLIs for querying, mutating, and LLM-generating Google Ads GAQL across MCC child accounts.
---
```

| Field | Required | Notes |
| --- | --- | --- |
| `title`, `role`, `description` | yes | |
| `team` | no | Defaults to `Solo`. |
| `stack`, `outcomes` | no | Arrays. `outcomes` renders as a highlighted list on the case-study page; every visible outcome should be a real, verifiable number or fact. |
| `featured` | no | Homepage "Featured Work" section. |
| `pubDatetime` | no | Plain date is fine here (`2026-09-28`). |

The page template renders role/team/stack/outcomes from frontmatter automatically; your Markdown body is the narrative. Existing case studies (`stream_of_worship.mdx`, `mcc_gaql_rs.md`, `googleads_analyst_skill.md`) follow a Problem → Constraints → Decisions → Artifacts structure — start by copying one.

## Editing an existing post

1. Find the file under `src/data/blog/` or `src/data/work/` (match the URL slug to the filename).
2. Edit body and/or frontmatter. If the edit is substantive, update `modDatetime`.
3. Renaming the file changes the URL and breaks inbound links — don't rename published posts.

## Charts and tables

Components are imported at the top of an `.mdx` file, right after the frontmatter, and used as JSX-style elements. All chart libraries load on demand from pinned CDN versions client-side; pages without charts pay nothing.

### Plain Markdown tables

For small static tables, just use pipe tables — they're styled by the site's typography.

| Command | Action |
| --- | --- |
| `pnpm dev` | Local dev server |

### `VegaChart` — full Vega-Lite spec (real datasets, aggregation, interactivity)

Example from `src/data/blog/google-asset-based-ad-extensions.mdx`:

````mdx
import VegaChart from "@/components/VegaChart.astro";

<VegaChart
  id="vis"
  spec={{
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 450,
    height: 300,
    data: { url: "/all_asset_field_type_view_ytd_cleaned.csv" },
    mark: { type: "bar", tooltip: true },
    encoding: {
      x: { field: "date", type: "temporal", bin: false, sort: "x" },
      y: { field: "impressions_sum_sum", type: "quantitative" },
      color: { field: "field_type", type: "nominal" },
    },
  }}
/>
````

- `id`: unique string per page (used as the mount point's DOM id).
- `spec`: a Vega-Lite v5 spec as a JS object. Build specs interactively at the [Vega-Lite editor](https://vega.github.io/editor/).
- Data can come from a CSV in `public/` (`data: { url: "/file.csv" }` — fetched at runtime in the browser) or inline (`data: { values: [...] }`).
- Transforms (aggregate/groupby/sort) run client-side — see the groupby-count example in `src/data/blog/quick-look-at-charts.mdx`.
- The exported chart includes the SVG/PNG download action.

### `ChartXKCD` — hand-drawn style charts for small illustrative data

Example from `src/data/blog/quick-look-at-charts.mdx`:

````mdx
import ChartXKCD from "@/components/ChartXKCD.astro";

<ChartXKCD
  type="Bar"
  title="Top 10 NYC 311 Complaint Types"
  xLabel="Complaint Type"
  yLabel="Count"
  data={{
    labels: ["Noise - Residential", "Heat/Hot Water", "Illegal Parking"],
    datasets: [{ data: [162, 129, 91] }],
  }}
/>
````

- `type` is one of `"Bar"`, `"Line"`, `"Pie"`, `"XY"`. Data is hand-entered — no loader, so pre-aggregate small numbers yourself.

### `DataTable` — sortable/searchable/paginated table from a CSV

Example from `src/data/blog/test-table.mdx`:

````mdx
import DataTable from "@/components/DataTable.astro";

<DataTable id="nyc311-table" dataUrl="/data.csv" pageLength={10} />
````

- `dataUrl` points to a CSV file in `public/`. The CSV's first row is the header; quoted fields with embedded commas are handled.
- `pageLength` defaults to 10. The table sorts by column 0 descending by default.
- Use this for large raw datasets; use Markdown tables or Vega-Lite for anything small or summarised.

Rule of thumb: `ChartXKCD` for a quick hand-drawn illustration with a few points, `VegaChart` for anything driven by real data, `DataTable` for exploring raw rows, plain Markdown tables for small static ones.

## Editing key pages

The fixed pages — landing, about, work index, writing index — are not collection content. Each is a file under `src/pages/` you edit directly. Lists that render automatically from the two collections are called out below; don't look for them in the page file, and don't try to edit them there.

### Landing page — `src/pages/index.astro`

| Section | What it is | How to edit |
| --- | --- | --- |
| `#hero` | Kicker, headline, intro paragraph, CTA button | Inline JSX — edit the strings directly |
| `#featured-work` | "Featured Work" grid | Auto — every `src/data/work/` entry with `featured: true` (shows `stack.slice(0, 4)` and the first `outcomes` entry); edit the case study, not this page |
| `#focus-areas` | "Focus Areas" grid | Hardcoded — edit the `title`/`description` props of each `TechStackCard` in place |
| `#featured-writing` | "Featured" list | Auto — blog posts with `featured: true` |
| `#recent-posts` | "Recent Writing" list | Auto — most recent non-featured posts, capped at `SITE.postPerIndex` (currently 5) |
| `#about-teaser` | "About" paragraph + link | Inline JSX — edit the strings directly |

The hero is plain JSX, so edit the text in the elements themselves:

```astro
<p class="font-mono text-xs tracking-widest text-accent uppercase sm:text-sm">
  Product Manager · Builder
</p>
<h1 class="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
  Product Manager who builds technical products end to end.
</h1>
```

The CTA (`See my work`, linking to `/work`) is a `LinkButton` just below. The focus-areas cards are seven `TechStackCard` components, e.g.:

```astro
<TechStackCard
  title="Machine Learning"
  description="time-series anomaly detection · forecasting · Python · Pandas · NumPy · scikit-learn · Jupyter"
/>
```

The about teaser paragraph ends `…because the best product judgment comes from knowing what the work actually costs.` Since the hero text and card props are JSX in an `.astro` file, `pnpm build` (`astro check`) type-checks the component props; a typo fails the build.

### About — `src/pages/about.md`

This page is a Markdown file, not `.astro`. Its frontmatter just points at the layout:

```yaml
---
layout: ../layouts/AboutLayout.astro
title: "About Me"
---
```

`AboutLayout.astro` renders the `<h1>` from `title` and supplies the header/footer; everything below the frontmatter is plain Markdown prose — edit it like any post body.

The contact links under "Get in touch" are **not** in the Markdown: `AboutLayout.astro` appends a `Socials` block driven by the `SOCIALS` array in `src/constants.ts`. Edit the links there.

### Work index — `src/pages/work/index.astro`

Only two things are editable inline: the `<h1>` (`Selected Work`) and the intro paragraph (`Case studies of products I designed and built — problem, constraints, decisions, and what shipped.`). The card grid auto-renders every `src/data/work/` entry, featured entries first. To change what a card shows, edit that case study's frontmatter — see [Writing a Work case study](#writing-a-work-case-study).

### Writing (posts index) — `src/pages/posts/[...page].astro`

The page title (`Posts`) and description (`All the articles I've posted.`) are inline props on the `Main` layout; the listing itself auto-paginates the blog collection at `SITE.postPerPage`. Individual post content is covered by [Writing a blog post](#writing-a-blog-post).

### Other key pages

| Page | File | How to edit |
| --- | --- | --- |
| Header / nav | `src/components/Header.astro` | The nav links are three hardcoded `<a>` tags — `Work` → `/work`, `Writing` → `/posts`, `About` → `/about` — plus a search icon linking to `/search`. The site name/logo comes from `SITE.title` in `src/config.ts` (icon at `public/icons/favicon.png`). |
| Footer | `src/components/Footer.astro` | `Tags` → `/tags` and `Archives` → `/archives` links, plus the copyright line. |
| Social & share links | `src/constants.ts` | `SOCIALS` (GitHub / LinkedIn / Mail — shown in the footer and on the About page) and `SHARE_LINKS` (share buttons on posts). |
| Site-wide settings | `src/config.ts` | The `SITE` object: `title`, `desc`, `postPerIndex`, `postPerPage`, `scheduledPostMargin`, `showArchives`, `showBackButton`, `editPost`, `googleAnalyticsId`, `timezone`, and more. |
| 404 & redirects | `src/pages/404.astro` | A client-side `REDIRECTS` map (`"/blog/": "/posts/"`, `"/apps/": "/posts/handsoff/"`, …) plus a `/categories/` → `/tags/` fallback. Add an entry whenever a published URL is renamed or removed. |
| Search | `src/pages/search.astro` | Pagefind UI; the search index is rebuilt automatically by `pnpm build`, so there's nothing to edit for content. |
| Archives | `src/pages/archives/index.astro` | Auto-generated from the blog collection; shown only when `SITE.showArchives` is `true`. |
| Tags | `src/pages/tags/` | Auto-generated from post tags. |
| RSS / robots | `src/pages/rss.xml.ts`, `src/pages/robots.txt.ts` | Driven by the collections + `SITE`; no manual edits needed. |

If an edit changes or removes a published URL — a renamed page or post — add a redirect entry in `src/pages/404.astro` so inbound links keep working (see [Editing an existing post](#editing-an-existing-post)).

## Previewing and shipping

```sh
pnpm install   # first time
pnpm dev       # dev server at http://localhost:8081
pnpm build     # type-checks (astro check) + builds + rebuilds search index
```

- `pnpm build` runs `astro check`: a typo in a component prop or frontmatter type fails the build, not just the browser.
- `pnpm format` / `pnpm lint` before committing (Prettier formats MDX too).
- Pushing to `main` triggers the GitHub Actions build and deploys to GitHub Pages — there is no staging step; preview locally first.
