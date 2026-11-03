---
title: "Offline worship playback: 500 MB videos, zero Wi-Fi"
author: Michael Huang
pubDatetime: 2026-08-25T00:00:00Z
slug: sow-offline-playback
featured: false
draft: false
tags:
  - stream-of-worship
  - web
  - offline
description: "Service workers, byte-range serving, and an offline boot path that keeps worship playing when the Wi-Fi dies."
---

The offline requirement came from a specific room. A sanctuary with stone walls, a guest network that drops when two hundred phones join it, and a projector driven by a small PC. The worship leader had already downloaded the set that morning.

Then, mid-service, the laptop lost the network and the video stopped.

That's the failure the whole offline path exists to prevent. A downloaded set plays to the end with zero network. That includes seeking, lyrics, and chapter markers. Everything in this post follows from taking that sentence literally.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The web app](/posts/sow-webapp-architecture). Next: [Going native: the Android client](/posts/sow-android-client).

<!-- more -->

## The problem

A browser is not a filesystem, and a service worker is not a media server. Three properties turn a simple idea into a design problem.

Cache Storage is only enumerable by request URL. You can ask whether a specific request is cached. You can't ask which songset it belongs to, when it was downloaded, or what render job produced it.

A video element issues byte-range requests. It fetches a few bytes, then a few more, then jumps to a different offset. If the service worker ignores the range header, seeking re-downloads the whole file on a network that may no longer exist.

The network tells you almost nothing reliable. A boolean saying you are online is the wrong type. Sometimes it lies. Sometimes it's false when cached playback is perfectly possible.

## What I built

### Two stores, two jobs

Bytes live in Cache Storage. Metadata lives in IndexedDB: which render job, which artifacts, when downloaded. Playability gets decided by asking the cache directly, not by trusting the metadata. Bookkeeping goes stale. A browser can evict a cache entry without telling the index.

### Serving byte ranges

The service worker maps proxy URLs to cached keys and serves ranges from the cached body. A range past the end returns a proper "unsatisfiable" response. An unparsable range returns the full body and lets the player sort it out. A seek produces a partial content response served entirely from cache.

The miss path fetches without the range header and stores only a full response. A partial response would poison the cache later. That's how a seek stops re-downloading.

### The download flow

The order matters. Fetch the proxy URLs. Ask for persistent storage. Cache the artifacts. Write the index record. Cache the controller document. The last two are best-effort because the bytes are what matter.

The caps matter. There's a warning when a download is getting large and a hard refusal before the browser silently evicts something else.

### A connectivity machine, not a boolean

The app doesn't trust a boolean. It asks the OS first. If the OS says there's no network, that's authoritative. Otherwise it probes. A probe that fails is treated as unknown for affordances, but only a definitive no network is allowed to skip API calls on boot.

The probe can't be answered from cache. Otherwise it would succeed offline and the machine would be lying.

### Booting the controller

When the app boots, it decides once and never re-decides.

If there's definitively no network, it boots silently from cache and attempts no API fetches. If it's nominally online but the fetch chain failed, it falls back to cache and shows a toast, because silently watching a frozen snapshot without being told is a trap. If the network is fine, it behaves normally.

Deciding once is deliberate. A connectivity decision that re-runs on every state flip thrashes on a marginal network and reloads the video mid-song.

### Staleness, deliberately unpursued

A downloaded copy is a frozen snapshot. It pins the render job at download time. If the owner re-renders, the offline copy doesn't know. Rather than paper over it, the design states it and surfaces it on the landing page only.

## What broke

With an expired session, a request for the controller document got redirected to the login page. The service worker cached the login page. The next offline tap served a login page from cache with no way to log in.

The document cache used an expiration policy for browsed pages, which silently evicted the controller while the artifacts survived. That left a lot of cached video that nothing could boot.

The static asset cache got poisoned by a stale-while-revalidate strategy on immutable files. No amount of reloading fixed it until the files were excluded.

A presigned URL expiring mid-service killed playback at an arbitrary timestamp. The recovery swaps to the cached artifact once per boot and resumes at the position captured at error time, not the start.

Auto-caching after a render works only if the tab is still open. There's no server-side hook into the browser's cache.

## What I would do differently

Make the real-browser offline path a merge gate before shipping. Every failure here is invisible to a unit test and obvious to a browser with the network off.

Document platform support in the download UI from day one. A disabled button with a reason beats a download that appears to succeed.

Give every cache a documented lifetime and an owner. Two of these failures were expiration policies applied to the wrong kind of entry.

Keep the index rebuildable. The metadata is derived data. Not providing a rebuild from cache action was an omission.
