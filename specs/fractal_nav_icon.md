# Replace Stock Favicon/Nav Icon with Fractal Image

## Context
Site (AstroPaper v5 Astro template) still ships the stock AstroPaper logo as its nav/tab icon: `public/favicon.svg` (the Astro "rocket-ish" path SVG), plus a full generated icon set under `public/icons/` derived from the same stock mark. User wants that stock icon replaced with the fractal image already in the repo at `static/images/blog-cover-fractal.jpg` (1920x1440 JPEG, also duplicated at `public/images/` and `public/` for OG use). Decided scope: full icon set, so every favicon entry point stays consistent.

## Approach
All derived icons are generated from the source JPEG with `ffmpeg` (already installed at `/home/mhuang/.linuxbrew/bin/ffmpeg`; supports png, mjpeg, and ico muxers). No image editor needed. All icons are square center-crops of the fractal (a 1440x1440 center crop covers the visually interesting middle band of the image).

1. **Generate icon set into `public/icons/` (overwrites tracked files, keeps filenames so `src/layouts/Layout.astro` and `public/icons/site.webmanifest` need no edits):**
   - Center-crop source to square once: `ffmpeg -i static/images/blog-cover-fractal.jpg -vf "crop=1440:1440" /tmp/fractal-square.png`
   - `favicon-16x16.png`, `favicon-32x32.png`: `ffmpeg -i /tmp/fractal-square.png -vf scale=16:16,32:32` (separate runs per size)
   - `apple-touch-icon.png`: 180x180 PNG
   - `android-chrome-192x192.png`: 192x192 PNG
   - `android-chrome-512x512.png`: 512x512 PNG
   - `mstile-150x150.png`: 150x150 PNG
   - `favicon.ico`: `ffmpeg -i /tmp/fractal-square.png -vf scale=32:32 favicon.ico` (ffmpeg ICO muxer default encodes BMP; fine for a 32x32 tab icon)
2. **Replace `public/favicon.svg`:** this is the primary modern favicon link (`Layout.astro:60`). Write a minimal SVG that embeds the fractal as a raster: an SVG wrapper `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="data:image/jpeg;base64,..." width="32" height="32"/></svg>` with a base64 of a 32x32 JPEG center-crop (keeps file small, ~2-4KB, vs 480KB full image). Generate the 32x32 crop with ffmpeg, base64-encode it, and inline it. The old stock SVG is fully replaced (no dead code kept).
3. **No source/config edits:** `Layout.astro:60-85` links, `site.webmanifest`, and `browserconfig.xml` all reference existing filenames which are overwritten in place. `config.toml` (lines 149-155) is Zola-era legacy config, not read by Astro — untouched. `safari-pinned-tab.svg` is referenced by `Layout.astro:84` as a mask icon; leave it as the stock monochrome mark (mask icons must be monochrome silhouette; a photo doesn't work as one) — this is the only entry point not fractalized.
   - Note: `static/images/blog-cover-fractal.jpg` is a tracked duplicate of `public/images/…` (also referenced via `SITE.ogImage` → `/blog-cover-fractal.jpg` at `public/` root). Leave duplicates as-is; out of scope.

## Critical files & anchors
- `public/favicon.svg` — primary favicon, replaced with embedded-raster SVG wrapper.
- `public/icons/*` — 7 generated files overwritten in place (ico, 2 PNG favicons, apple-touch, 2 android-chrome, mstile).
- `src/layouts/Layout.astro:59-85` — read-only anchor; confirms all favicon `<link>`s point at the overwritten filenames (no edits needed).
- `static/images/blog-cover-fractal.jpg` — source image for all crops.

## Verification
- `pnpm build` (or `pnpm dev`) succeeds; `dist/` contains the new icon files.
- `pnpm preview`, open browser tab: tab favicon shows the fractal (blue/orange spiral), not the stock Astro mark. Also check `/favicon.ico`, `/icons/favicon-32x32.png` render 200 in preview.
- `file public/icons/favicon.ico` → "MS Windows icon resource"; `file` each PNG → correct dimensions.
- Visual: `read` the generated 32x32 PNG inline to confirm it's the fractal, not a blank/smeared crop.
