---
title: "Going native: an Android client over the same JSON APIs"
author: Michael Huang
pubDatetime: 2026-10-31T00:00:00Z
slug: sow-android-client
featured: false
draft: false
tags:
  - stream-of-worship
  - android
  - kotlin
description: "A Jetpack Compose client over the webapp's JSON APIs: Media3 playback, chapters, and DownloadManager offline copies."
---

There's a version of this story where the Android app is an afterthought — a WebView pointed at the web app, wrapped in an icon. That version is cheap, and it fails in the one place that matters: a phone driving a projector over HDMI, with no browser chrome, no URL bar, and a screen that must not go to sleep mid-song.

So the Android client is native. It's also, deliberately, not a second backend. Every byte it fetches comes from the same JSON APIs and the same signed URLs the web app uses, with the web app playing the role of backend. That constraint turns the Android app into something more useful than a client: a contract test. Any place where the API is only accidentally web-friendly shows up immediately on a device.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [Offline worship playback](/posts/sow-offline-playback). Next: [Ten build phases](/posts/sow-retrospective).

<!-- more -->

## The problem

Four mobile-specific constraints have no analogue in the browser, and each one forces a different decision.

**Cookies without a cookie store.** The API authenticates with a session cookie issued by Better Auth. A browser manages that automatically; OkHttp does not persist cookies unless you supply a `CookieJar`. And the cookie is host-scoped, so a session minted against one base URL is invisible to the same app pointed at a different one — which is exactly what happens when a developer tests on an emulator (`10.0.2.2`) and then on a physical device over the LAN.

**A media stack that has to survive the screen turning off.** Video on a phone with the screen off, audio continuing when the app is backgrounded, a lock screen showing what's playing — those are platform concerns that a web player handles inconsistently and a native player handles with two lines of configuration.

**Downloads that outlive the process.** The browser's Cache Storage path needs the tab to stay open. A phone has to be able to start a 500 MB download and let the user lock the screen, switch apps, or lose signal and resume later. That's a job for the OS, not for a service worker.

**A device clock that lies.** Presigned URLs expire on the server's schedule, and a phone's clock can be minutes off. Treating the TTL as absolute without checking against the device clock produces either premature failures or a request that fails at the server after the UI said it was valid.

## Breaking it down

- **Session.** Persist the cookie across process death, encrypted. Done when relaunching the app doesn't require re-login, and the cookie never sits in plaintext preferences.
- **Expiry handling.** Done when a 401 from any endpoint clears the session exactly once and routes to login, without clobbering an in-flight auth state.
- **Playback.** Done when video renders with the screen as the source of truth, audio survives backgrounding, and the noisy-audio (headphone unplug) case is handled.
- **Chapters and lyrics.** Done when a tap on a lyric line seeks, the current line is highlighted, and scrolling doesn't fight the user.
- **Offline.** Done when a download survives app death and is resumable by the OS, and status is honest per artifact rather than per set.
- **Rotation.** Done when rotating the device mid-playback loses neither the position nor the player.

## What I built

### Auth: cookies in a language that resists them

Better Auth over OkHttp means implementing `CookieJar`. The persistence layer is `EncryptedSharedPreferences` — an AES-256-GCM master key wrapping the entries, AES-256-SIV for keys and AES-256-GCM for values. There's a documented fallback to ordinary preferences if encrypted storage can't be created, because a device with a broken keystore should degrade to "you must log in again", not to a crash loop at startup.

The 401 path is a single interceptor that invokes an `onUnauthorized` callback. That callback goes to `AuthSessionManager.onSessionExpired()`, which flips `Authenticated` to `Unauthenticated` — but only if the state is currently `Authenticated`. The guard matters because the session starts in `Restoring` and can be in `Error`, and a stray 401 during restore shouldn't overwrite a state the app is still resolving.

The host-scoping problem is the top support issue, and it's not a code bug. Cookies minted for one host are not sent to another, so pointing the app at a LAN IP after logging in through a tunnel host means the cookie is silently absent — and Better Auth's trusted origins have to include that origin or the request is rejected before it reaches the session check. The README documents the emulator-versus-device matrix. What it can't do is make the failure self-explanatory when it happens.

### The player arrangement

Playback is an in-process ExoPlayer, with `WAKE_MODE_NETWORK` so the CPU and network stay available while the screen is off, `setHandleAudioBecomingNoisy(true)` so unplugging headphones pauses instead of blasting the room, and a decoder fallback path for when the hardware decoder rejects the stream.

There's also a `MediaSessionService` in the codebase, and the video screen doesn't use it. That's a documented choice: a `MediaController` connected to a media session forwards _commands_ to a player in another component, and a surface for video frames doesn't cross that boundary. The service exists for audio-only playback with lock-screen controls; the video screen drives the player directly. The TODO in the service records both the reason and the fact that the player screen stopped using it after the third iteration, because a second, non-functional playback path is exactly the kind of thing that misleads the next person to read the code.

One rotation detail deserves its own sentence. `bindController()` re-binds the player controller after the activity is recreated, because the surviving `ViewModel` holds a reference to a controller whose player has been released. Commands issued to a released player don't throw — they do nothing — so the symptom is a UI that looks alive and a transport that's dead.

### Chapters and lyrics

The render worker produces a `chapters.json` sidecar, and the client normalizes it defensively before use: non-finite timestamps get filtered out, entries get sorted, and a blank title becomes "Song N". That normalization isn't paranoia about the renderer. It's the only way to stop a malformed sidecar from producing a UI that silently shows the wrong song.

A 500 ms position ticker drives two lookups — `chapterAt()` for the current song and `currentLineAt()` for the current lyric line — and the lyrics panel collapses non-current chapters, highlights the current line, seeks on tap, and auto-scrolls only when the _chapter_ changes. Auto-scrolling on every line change is the obvious implementation and it's unusable: the list crawls under the reader's eyes mid-song.

### Offline, via `DownloadManager`

The browser path caches bytes; the Android path delegates to the system. `DownloadManager`, driven through WorkManager, gives something a service worker can't: a system notification, OS-level retry and resume, and a policy that respects metered and roaming networks.

Status is tracked per artifact, not per set: `Available → Queued → Cached | Failed | Stale`, keyed by `renderJobId:kind`. A set whose MP4 is cached and whose chapters sidecar failed is genuinely in a mixed state, and collapsing that into "downloaded" hides a bug.

The scheduling has one race worth writing down, and it's the reason this excerpt exists:

```kotlin file="delivery/android/app/src/main/java/org/streamofworship/android/core/download/ArtifactDownloadCoordinator.kt:16-38"
    suspend fun enqueue(request: ArtifactDownloadRequest): OfflineArtifactMetadata {
        // Persist the queued metadata BEFORE asking DownloadManager to enqueue the request so
        // the completion receiver can always find the row even if the broadcast arrives before
        // the download id has been recorded (small/fast downloads, retries on already-cached
        // files). The receiver also falls back to the renderJobId+kind encoded in the title.
        val queued =
            cacheRepository.markQueued(
                renderJobId = request.renderJobId,
                kind = request.kind,
                remoteUrl = request.url,
                signedUrlExpiresAt = request.expiresAt,
                downloadId = null,
                nowEpochMillis = clockMillis(),
            )
        return try {
            val downloadId = scheduler.enqueue(request)
            cacheRepository.upsert(
                queued.copy(
                    status = OfflineArtifactStatus.Queued,
                    downloadId = downloadId,
                    updatedAtEpochMillis = clockMillis(),
                ),
            )
        } catch (error: Throwable) {
            cacheRepository.markFailed(
                renderJobId = request.renderJobId,
                kind = request.kind,
                message = error.message ?: "Download could not be queued.",
                nowEpochMillis = clockMillis(),
            )
        }
    }
```

Two things are happening there. **Queued metadata is written before the enqueue**, not after, so a fast download whose completion broadcast arrives before the download ID is recorded still finds its row. And the row is **keyed by `renderJobId` and `kind`**, not by download ID, because the ID doesn't exist yet at that moment — the receiver falls back to the IDs encoded in the download title.

The completion receiver is registered at runtime rather than in the manifest. `targetSdk 35` forbids a manifest-declared receiver for `ACTION_DOWNLOAD_COMPLETE`, so the app registers it in `Application.onCreate` with the `RECEIVER_EXPORTED` flag on Tiramisu and later.

Metadata persistence is a single JSON file, written atomically: serialize to a sibling temp file in the same directory, then `Files.move` with `ATOMIC_MOVE` over the destination, under a `Mutex`. A process kill mid-write therefore leaves either the previous complete file or the new one. Writes are serialized under a mutex because the temp file name is derived from the destination, so two concurrent writers would collide. A corrupted file resets to empty instead of throwing to every caller — losing the index is recoverable, crashing on launch isn't.

### Expiry and rotation

Signed URLs are requested with a 3600-second TTL, and the client pre-checks expiry against the device clock before it starts playback. If that check fails, or if the server answers 403/404 for a URL that has rotated, the UI says "Playback link expired. Retry to refresh it." and offers a path to mint a new one.

The device clock note lives in the README because it's a real support case: a phone whose clock is ten minutes fast will consider a fresh URL expired. Pre-checking is still correct — the alternative is a failed media load with a generic error — but it has to be pre-checking with the caveat written down.

## What broke

**Cookie host mismatch.** The single most common support issue, and the one with the worst error message. The fix is documentation and a host-normalization step in the config, not a clever workaround.

**A released player that answers commands.** After a rotation, the UI showed a play state while nothing played. Re-binding the controller fixed it. The interesting part is that no API told me the player was gone.

**Software decoders.** Some devices fall back to a software H.264 decoder that can't keep up with 1080p at 30 fps. The client detects the software-decoder case by name (`c2.android`, `omx.google`, `ffmpeg` in the decoder name) and warns, instead of showing a stutter with no explanation.

**A half-written metadata file.** Before the atomic write, an interrupted process could leave truncated JSON and the app would fail to launch. Resetting to an empty index on corruption is a worse user experience than a valid index and a much better one than a crash.

**Test infrastructure was the hard part, not the tests.** 29 test classes — Robolectric for JVM-side Android behaviour, MockWebServer for the HTTP contract, Compose UI tests for the panels. The dependency-injection and platform boundaries had to be pulled apart before any of them could run, and the Kover configuration excludes the infrastructure classes that can't be usefully unit-tested. That exclusion list is honest signalling: it names the classes you can't test on the JVM, which is the same list a reviewer needs.

## Evidence

| Concern        | Web app                                               | Android                                                                               |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Session        | Better Auth cookie, managed by the browser            | Better Auth cookie, `CookieJar` over `EncryptedSharedPreferences` (AES-256-GCM / SIV) |
| 401 handling   | Proxy returns JSON 401 for `/api/*`                   | Interceptor → `onSessionExpired()`, guarded to `Authenticated` only                   |
| Signed URL TTL | 3600 s default, 14400 s for cast video                | 3600 s requested, pre-checked against device clock                                    |
| Video playback | `<video>` element, service worker byte ranges         | In-process ExoPlayer, `WAKE_MODE_NETWORK`, decoder fallback                           |
| Offline bytes  | Cache Storage, synthetic keys, 500 MB warn / 1 GB cap | `DownloadManager` + WorkManager, per-artifact status                                  |
| Progress       | Poll every 10 s                                       | Same API, same poll                                                                   |
| Chapters       | Fetched server-side in the share route                | `chapters.json` normalized client-side                                                |
| Distribution   | Vercel, continuous deploy                             | `versionName 0.1.0`; no signing config, not store-distributed                         |

## What I'd do differently

1. **Generate the API client from a schema.** The DTOs are hand-written, which makes every server-side field rename a runtime failure on a device I have to reproduce. An OpenAPI document generated from the route schemas would make those breaks compile-time, and the web app already has the Zod schemas to derive one.

2. **Run the cookie/origin matrix on a physical device first.** The emulator-to-LAN host change is the single most common way to lose an hour, and it can't be discovered from JVM tests. It belongs in the first-day checklist, not the troubleshooting section.

3. **Put release signing in CI before calling it shipped.** The app builds, runs, and passes its tests, but there's no signing configuration, which means it can't be distributed outside local testing. Until that exists, "the Android client ships" overstates it.

4. **Delete the unused service, or finish it.** A `MediaSessionService` no screen uses is a maintenance liability and a misleading claim. Either wire audio-only playback through it or remove it and let the in-process player be the only path.

Source: [ArtifactDownloadCoordinator.kt](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/android/app/src/main/java/org/streamofworship/android/core/download/ArtifactDownloadCoordinator.kt) · [OfflineCacheRepository.kt](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/android/app/src/main/java/org/streamofworship/android/data/offline/OfflineCacheRepository.kt) · [Android README](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/android/README.md)
