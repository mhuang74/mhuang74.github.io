# michaelhuang.xyz

Personal blog of Michael S. Huang — <https://michaelhuang.xyz>.

## Stack

- [Astro](https://astro.build) with the [AstroPaper](https://github.com/satnaing/astro-paper) theme
- Tailwind CSS 4
- MDX for posts (`src/data/blog/`)
- Pagefind for search
- Charts & tables rendered client-side via CDN libraries: Vega/Vega-Lite (vega-embed), chart.xkcd, jQuery DataTables

## Commands

| Command        | Action                                     |
| :------------- | :----------------------------------------- |
| `pnpm install` | Install dependencies                       |
| `pnpm dev`     | Start local dev server at `localhost:8081` |
| `pnpm build`   | Build the production site to `./dist/`     |
| `pnpm preview` | Preview the production build locally       |
| `pnpm lint`    | Run ESLint                                 |
| `pnpm format`  | Format code with Prettier                  |

## Local dev server

`pnpm dev` starts the dev server bound to `0.0.0.0` on port `8081` (accessible from other machines on the network), so open:

- <http://localhost:8081>
- or `http://<machine-ip>:8081` from another device

To use a different host/port temporarily, pass CLI flags which override the script defaults:

```sh
pnpm dev --port 3000
```

## Deployment

Deployed to GitHub Pages via GitHub Actions (`.github/workflows/main.yml`). Pushes to `main` trigger a build and deploy.
