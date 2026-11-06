---
title: "Going native: an Android client over the same APIs"
author: Michael Huang
pubDatetime: 2026-09-08T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-android-client
featured: false
draft: false
tags:
  - stream-of-worship
  - android
  - kotlin
description: "Native video playback, cookie sessions, and downloads managed by Android."
---

I wanted a native player for a phone connected to a larger screen, with downloads managed by Android and direct control over the video surface. The web app already had the backend, so the Android app could use the same JSON APIs and signed media URLs.

That keeps catalog and render logic in one place. It also exposes assumptions that a browser normally handles for me, especially cookies and login redirects.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Offline worship playback](/posts/sow-offline-playback). Next: [Ten build phases](/posts/sow-retrospective).

<!-- more -->

_Updated November 6, 2026: the implementation described here is the November 1 source snapshot. A buildable debug app isn't evidence of a public release._

## Start with the same origin

The app uses OkHttp with a [persistent cookie store](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/core/session/SessionCookieStore.kt). It tries encrypted preferences first, but falls back to ordinary app-private preferences if encrypted initialization fails twice. Cookies can be restored after process death. Startup auth resolution needs to avoid treating an incidental unauthorized response as the final answer before restore completes.

Cookies remain scoped to their host. The emulator's `10.0.2.2`, a computer's LAN address, and the deployed app domain aren't interchangeable. If login works but the next request is unauthorized, checking the configured origin is a useful first step.

The [Android README](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/README.md) documents that setup. I don't have support counts that would justify calling host mismatch the most common user problem.

## The video screen owns its player

The worship screen uses an in-process ExoPlayer built by [VideoExoPlayerFactory](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/feature/player/VideoExoPlayerFactory.kt). It attaches directly to a video surface, handles unplugged-headphone events, enables decoder fallback, and uses network wake mode.

There is also a [MediaSessionService](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/feature/player/SowPlaybackService.kt) in the tree. Its comment explicitly says the current video screen doesn't use it; it was retained for possible background audio. Its presence doesn't mean the worship screen provides background playback or lock-screen controls through that service.

Lifecycle changes need special care. A surviving view model can retain a controller after the old activity's player has been released. The playback fixes rebind the active controller. That is a concrete lifecycle issue, rather than proof that playback survives every screen-off or process-death case.

## Chapters and lyrics

The client reads the render worker's chapter sidecar and normalizes it before use. Playback position selects the current song and lyric line. Tapping a line can seek, while chapter changes drive the larger scroll movement.

The MP4 already contains lyrics, so this panel is a controller aid. Keeping the chapter timeline aligned with the rendered mix matters more than duplicating the renderer's layout on the phone.

Signed URLs can expire. The client checks expiry using the device clock and offers a refresh path for stale URLs. A local check is only a convenience when the clock is correct; the server still decides whether a URL is valid.

## Let Android download the files

The [download scheduler](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/core/download/AndroidArtifactDownloadScheduler.kt) calls DownloadManager directly. It allows metered connections, disallows roaming, and requests a completion notification. This path isn't a WorkManager download worker.

Metadata tracks each artifact separately. Video may be ready while the chapters file has failed. The coordinator saves queued metadata before enqueueing, and the completion receiver can recover the render-job ID and artifact kind from the title if completion arrives before the download ID is saved.

The [offline repository](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/data/offline/OfflineCacheRepository.kt) writes metadata through a sibling temporary file and replacement. Corrupt metadata loads as empty. That protects launch from a bad file, though losing the index isn't the same as recovering every downloaded artifact.

The [coordinator tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/test/java/org/streamofworship/android/core/download/ArtifactDownloadCoordinatorTest.kt) and [repository tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/test/java/org/streamofworship/android/data/offline/OfflineCacheRepositoryTest.kt) cover those boundaries. Device networking, HDMI output, and decoder behavior still need device testing. CI produces a debug APK; release signing remains a separate task.
