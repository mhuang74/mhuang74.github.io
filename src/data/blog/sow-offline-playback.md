---
title: "Offline worship playback: 500 MB videos, zero Wi-Fi"
author: Michael Huang
pubDatetime: 2026-10-30T00:00:00Z
slug: sow-offline-playback
featured: false
draft: false
tags:
  - stream-of-worship
  - web
  - offline
description: "Service-worker byte ranges, an IndexedDB index, and a connectivity machine that keeps worship playing when the Wi-Fi dies."
---

The offline requirement came from a specific room. A sanctuary with stone walls, a guest network that drops when two hundred phones join it, and a projector driven by a small PC or a TV with a Chromecast in it. The worship leader had already downloaded the set that morning, over coffee, on a network that worked.

Then, mid-service, the laptop lost the network and the video stopped.

That's the failure the whole offline path exists to prevent, and it reframed the requirement for me. "Offline support" isn't a nice-to-have feature flag. It's an invariant: **a set that has been downloaded plays to the end with zero network**, including seeking, including lyrics, including chapter markers. Everything in this post follows from taking that sentence literally.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [The web app](/posts/sow-webapp-architecture). Next: [Going native: the Android client](/posts/sow-android-client).

<!-- more -->

## The problem

A browser is not a filesystem, and a service worker is not a media server. Three of the platform's properties turn a simple idea into a design problem.

**Cache Storage is only enumerable by request URL.** You can ask a cache whether a specific `Request` is present. You can't ask it "which songset is this?" or "when was this downloaded?" or "what is the render job ID for this file?" There's no metadata, no listing by tag, no query. It's a map from URL to `Response`, and nothing more.

**A `<video>` element issues byte-range requests.** It doesn't fetch a file; it fetches `bytes=0-`, then `bytes=131072-`, then seeks to `bytes=8000000-8400000`. If the service worker answers from a cached full response but ignores the `Range` header, some browsers cope and some fail, and Safari is less forgiving than Chrome. If it ignores `Range` on seek, seeking re-downloads the whole file on a network that may no longer exist.

**The network tells you almost nothing reliable.** `navigator.onLine` is true on a captive portal, true on a network with no route to your origin, and true on hotel Wi-Fi that has silently stopped passing packets. It's also false in situations where a cached play is perfectly possible. A boolean is the wrong type for this.

## Breaking it down

- **Two stores, two jobs.** Bytes need one store, metadata needs another. Done when, given a songset ID, the page can answer "is this downloaded, when, and which render job" without reading a single byte of media.
- **Range serving.** Done when a seek produces a 206 with a correct `Content-Range`, served entirely from cache, with no network request.
- **Graceful degradation on malformed ranges.** Done when an odd or unsatisfiable range produces a valid HTTP response instead of a broken media pipeline.
- **A connectivity type that can say "I don't know."** Done when the boot path can tell "definitely offline" from "probably broken", and only the former is allowed to skip API calls.
- **Bounded storage.** Done when the download flow refuses to fill the device, and warns before it gets close.
- **Staleness as an explicit non-goal.** Done when the system documents that a cached copy is frozen, and doesn't pretend otherwise.

## What I built

### Two stores, two jobs

Bytes live in Cache Storage under synthetic keys: `/sow-artifact-cache/<renderJobId>/mp4`, `/mp3`, and `/chapters`. Synthetic, because there's no real URL for "the cached MP4 of render job 42" — the client invents the key and maps it from the real request at serve time.

Metadata lives in IndexedDB: database `sow-offline-index`, object store `songsets`, keyed by `songsetId`, with a record holding `renderJobId`, the `cachedMp3`/`cachedMp4`/`cachedChapters` flags, `cachedAt`, and `chapterContentHashes`. Share links get a parallel token-keyed store, so a shared set's frozen copy can't collide with the owner's.

The split is forced by the enumerability problem, and it produces the system's most important invariant: **playability is decided by `cache.match`, never by the record's flags.** The flags are download-time bookkeeping, and bookkeeping goes stale — a browser can evict a cache entry under storage pressure without telling IndexedDB. So the offline boot asks Cache Storage whether the bytes are actually there, and uses the index only to know _which keys to ask about_.

### Serving byte ranges

The service worker registers one custom route for `/api/r2/artifact/*`, maps the proxy URL to the synthetic cache key, and serves ranges from the cached body through `rangeResponseFrom`:

```js file="delivery/webapp/public/sw-artifact-serving.js:87-106"
if (start >= size) {
  return new Response(null, {
    status: 416,
    headers: {
      "Content-Range": `bytes */${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

const slice = blob.slice(start, end + 1);
return new Response(slice, {
  status: 206,
  headers: {
    "Content-Type":
      cachedResponse.headers.get("Content-Type") ?? "application/octet-stream",
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
  },
});
```

Three behaviours get decided before that block, and each one is a spec choice:

- **Suffix ranges** (`bytes=-N`, meaning "the last N bytes") are supported, converted to `start = size - N`, `end = size - 1`. Media elements use them to read trailing metadata, and a container format whose index lives at the end of the file won't seek without them.
- **A range past the end of the body** is unsatisfiable and returns 416 with `Content-Range: bytes */<size>` — the asterisk form. Media elements recover from 416. They don't necessarily recover from a 200 with a truncated body.
- **An unparsable or multiple range** returns the cached full response untouched, per RFC 9110's instruction that an invalid `Range` header must be ignored. Deliberate degradation: serve everything, let the player sort it out, rather than construct a malformed partial response.

The miss path has an equally specific rule. When the artifact isn't cached, the worker fetches **without** the `Range` header and stores the result only if it's a full 200. `cache.put` refuses a 206, so a naive implementation that forwarded the range would either throw or poison the cache with a fragment that later serves as if it were the whole file. Retrieving the full body once and slicing from cache after that is how a seek stops re-downloading.

The `?download=1` query parameter bypasses all of this and goes straight to the network, because the download flow needs the original `Content-Disposition` header to trigger a save dialog, and a cached `Response` no longer carries it.

### The download flow and its caps

Order matters, and it goes: fetch the proxy URLs from the API, request persistent storage via `navigator.storage.persist()`, cache the artifacts, write the IndexedDB record, then cache the controller document. The record write and the document cache are both best-effort — a failed index write doesn't fail the download, because the bytes are what matter and the index can be rebuilt from them.

The caps are a 500 MB warning and a hard refusal above 1 GB, checked before any write. The warning is a flag on the result so the UI can say "this is getting large" without blocking; the refusal throws with an explicit message instead of letting the browser silently evict something else. On iOS the whole path is gated to 17.4 and later, because older versions don't support the storage APIs the design depends on, and the UI shows an "Update iOS" affordance instead of a feature that would half-work.

### A connectivity machine, not a boolean

The hook replaces every `navigator.onLine` read with a three-state enum:

- `online` — `onLine` is true **and** a probe returned 204.
- `offline` — `onLine` is false. No probe needed; the OS is authoritative when it says no.
- `unknown` — everything else: probe in flight, probe timed out, probe failed.

`unknown` is treated as offline for **affordances** (fail toward offline: show the cached option, don't promise a network feature), but only a definitive `offline` is allowed to gate the redirect logic and the zero-fetch boot. That asymmetry is the whole design. A probe failure on a loaded network shouldn't send the user into a degraded mode, and a genuinely absent network shouldn't produce a spinner.

The probe is a `HEAD /api/health` with a 5-second `AbortController` timeout and `cache: "no-store"`, plus a `NetworkOnly` carve-out in the service worker so the health check itself can never be answered from cache — otherwise the probe would succeed offline and the machine would be lying. Probes fire on boot, on the `online` event, on `visibilitychange`, and on demand after app fetch failures. No timers, no polling. A phone in a pocket that wakes up after twenty minutes needs a probe at that moment, not a background interval.

### Booting the controller

The playback controller makes its connectivity decision exactly once per effect, then never re-decides. Three branches:

1. **Definitive offline** → boot silently from cache, with **zero API fetches attempted**. Not "fail fast" — never attempted, because an API call on a dead network costs a timeout before the cached copy appears.
2. **Nominally online but the chain failed** → fall back to the cached copy and show a toast. The toast is required: a silent fallback hides the fact that the user is now watching a frozen snapshot instead of the current render.
3. **Online** → the normal fetch chain.

Deciding once is on purpose. A connectivity-driven boot that re-runs on every state flip will thrash — cache, network, cache — as the probe oscillates on a marginal network, and the user sees the video reload mid-song.

### Staleness, deliberately unpursued

A downloaded copy is a frozen snapshot. It pins the `renderJobId` at download time, and if the owner re-renders the songset, the offline copy doesn't know and can't know without a network call — which is exactly what the offline boot refuses to make.

Rather than paper over that, the design states it: staleness surfaces on the landing page (which is online) when the recorded `renderJobId` differs from the latest, and nowhere else. Share links use token-scoped frozen copies for the same reason. There's also no proactive "you are offline" banner — that decision has its own record, because a permanent offline indicator is noise in the exact moment the system is working as designed.

## What broke

**Login HTML poisoning.** With an expired session, a request for the controller document got a 307 to `/login`, which `fetch()` followed and resolved as a **200 with HTML**. The service worker cached it under the controller path. The next offline tap on "Start Worship" served a login page from cache, with no way to log in. The guard is a check on `response.redirected` plus the resolved pathname, applied in both the page-side cache writer and the worker route.

**The generic route evicted the controller document.** The document cache used a 7-day / 50-entry expiration. That's right for browsed pages and catastrophic for a pre-cached controller: fifty navigations later, or seven days later, the entry silently disappears while the artifacts survive — leaving 500 MB of cached video that nothing can boot to reach. The fix is a dedicated `NetworkFirst` route over the _same_ cache, registered _before_ the generic route, carrying no expiration plugin at all.

**`StaleWhileRevalidate` poisoned the static asset cache.** Dev chunks are stamped `immutable`. Revalidation then re-fetched from the HTTP cache, got the same stale body back, and `cache.put` re-stored it. The cache was permanently stale and no amount of reloading fixed it until the route excluded `/_next/` from the strategy entirely.

**The presigned URL died mid-service.** Airplane mode, or the four-hour expiry, kills playback at an arbitrary timestamp. The recovery swaps to the cached artifact **once per boot**, guarded by a ref, and resumes at a position captured at error time rather than at zero — because the swap itself resets `currentTime`, and resuming from the start of a ten-minute set mid-service is worse than the failure.

**Auto-cache is tab-contingent.** When a render finishes in the composer, the page caches the result, but only if the tab is still open, because there's no server-side hook that could reach into the browser's cache. Every design that assumed "the render completes, therefore the device has it" was wrong.

## Evidence

| Storage / limit            | Value               | Why that number                                                                  |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| Warning threshold          | 500 MB              | One set is tens to hundreds of MB; half a gigabyte is the point to tell the user |
| Hard refusal               | 1 GB                | Refuses before writing, so the browser never silently evicts something else      |
| Connectivity probe timeout | 5 s                 | Long enough for a slow mobile network, short enough not to stall the boot        |
| iOS minimum                | 17.4                | Below this the storage APIs the design depends on are unavailable                |
| Generic document cache     | 7 days / 50 entries | Correct for browsed pages; why the controller route is exempt                    |
| Document network timeout   | 10 s                | `NetworkFirst` fallback budget                                                   |
| Signed URL TTL             | 3600 s              | Longer than a service; shorter than a leak window                                |
| Range response             | 206 / 416 / 200     | 206 for a valid range, 416 past EOF, full 200 for an invalid one                 |

## What I'd do differently

1. **Make the real-browser e2e harness a merge gate before shipping the offline path.** Every failure in that list is invisible to a unit test and obvious to a browser that seeks a cached video with the network disabled. That test stayed a manual ritual for far too long.

2. **Document platform support in the download UI from day one.** The iOS 17.4 gate got discovered as a bug report instead of stated as a requirement. A disabled button with a reason beats a download that appears to succeed.

3. **Give every cache a documented lifetime and an owner.** Two of the five failures above were expiration policies applied to the wrong kind of entry. A table listing each cache, its strategy, its expiration, and who may evict it would have prevented both.

4. **Keep the index rebuildable.** Because playability is decided by `cache.match`, the IndexedDB record is derived data. Writing it best-effort was right. Not providing an explicit "rebuild index from cache" action was an omission — the data to do it is all there.

Source: [sw-artifact-serving.js](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/public/sw-artifact-serving.js) · [sw.js](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/public/sw.js) · [useConnectivity.ts](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/src/hooks/useConnectivity.ts) · [offline design notes](https://github.com/mhuang74/stream_of_worship/blob/main/docs/offline_worship_design_explained.md)
