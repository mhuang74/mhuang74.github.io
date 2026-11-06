---
title: "Offline worship playback: downloading the player as well as the video"
author: Michael Huang
pubDatetime: 2026-08-25T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-offline-playback
featured: false
draft: false
tags:
  - stream-of-worship
  - web
  - offline
description: "Caching rendered artifacts, serving byte ranges, and starting a downloaded set without a network."
---

A downloaded worship set should start and keep playing without Wi-Fi. Saving the MP4 is only part of that. The browser also needs the player page, its scripts, and enough metadata to find the right file.

Seeking makes the requirement more interesting. A video element asks for byte ranges, so the service worker needs to answer those requests from the saved file too.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The web app](/posts/sow-webapp-architecture). Next: [Going native: the Android client](/posts/sow-android-client).

<!-- more -->

_November 6 update: this covers the November 1 code, including September's cache-first boot and media-error recovery changes._

## Bytes and bookkeeping

[Cache Storage](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/offline/artifact-cache.ts) holds complete audio, video, and chapter responses under stable keys derived from the render job ID. IndexedDB stores the songset name, job ID, artifact flags, and download time.

The resolver checks the actual cache before declaring a set playable. An index flag can survive after the browser evicts the bytes. Requesting persistent storage helps when the browser grants it, but the request can fail or be refused.

The current budget helper warns at 500 MiB of estimated origin storage usage and refuses a new cache operation when usage is already at least 1 GiB. It doesn't reserve space for the incoming file or prove that the download will fit. The [cache tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/lib/offline/artifact-cache.test.ts) cover the implemented checks, not a guarantee against browser eviction.

## Answer the range request

The [service-worker handler](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/public/sw-artifact-serving.js) maps an artifact proxy URL to its saved response. A valid range returns status 206 with a slice of the body. A range starting past the end returns 416. Unsupported or malformed range syntax falls back to the full response.

On a cache miss, the handler requests a complete file without the Range header. Only a full 200 response is stored; a partial file mustn't occupy a key that promises the whole video. There are [range-serving tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/lib/offline/sw-artifact-serving.test.ts) for those cases.

This lets a cached video seek without returning to storage. It still relies on the browser being able to read that cached body; storage can disappear between an index lookup and playback.

## Prepare the cold start

The [download helper](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/offline/download-offline.ts) gets proxy URLs, requests persistent storage, caches artifacts, and writes the index. It then attempts to save the controller and worship-list documents. The [document helper](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/offline/document-cache.ts) also warms their script, style, and font dependencies.

It rejects redirected or login-page responses so an expired session doesn't cache login HTML under the player URL. Downloaded controller documents use a route without the ordinary page cache's expiration policy.

There is a limitation here: index writes and document warming are best-effort. The media can finish downloading while the work needed for a fresh offline launch fails. A successful download notification alone doesn't prove the whole offline workflow works. I would test opening the saved set with the network off on the actual playback device.

## Prefer the downloaded copy

The current [playback core](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/hooks/usePlaybackCore.ts) checks for a usable downloaded copy even while online. If it finds one, that snapshot is what plays. With definitive OS-offline state, it attempts no boot API calls. Otherwise it can use the online chain and fall back to cache after a recoverable failure.

The decision is made for a boot, rather than restarting the player whenever connectivity changes. If online media fails later, the core makes one recovery attempt using the offline copy. The player preserves the failure position when resuming.

A local snapshot stays tied to its render job. A later edit or render doesn't alter the downloaded bytes, so updating the copy is a separate action.

## What the verification established

The [September recovery handover](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/handover_offline_drop_recovery.md) records a forced media-error test that swapped to cached playback and resumed. It also records an important caveat: dropping the network didn't always reproduce a failure because Chromium's HTTP cache could keep serving the video.

The static-asset problem in that report concerned stable development chunk URLs serving mixed builds. It wasn't evidence that immutable production assets were generally broken. Some offline navigation checks were still affected by that development hydration problem.

The [cache-first handover](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/offline-worship-simplification-handover.md) likewise reports passing unit checks and a build, with several browser scenarios still outstanding at that handover. Those records support the recovery design, but don't establish reliable offline playback on every target device. That's the part I still want a real-browser check to answer.
