---
title: "Going native: an Android client over the same JSON APIs"
author: Michael Huang
pubDatetime: 2026-09-08T00:00:00Z
slug: sow-android-client
featured: false
draft: false
tags:
  - stream-of-worship
  - android
  - kotlin
description: "A native Android client over the webapp APIs, with offline downloads and playback that survives a dead screen."
---

There's a version of this story where the Android app is an afterthought: a WebView pointed at the web app, wrapped in an icon. That version fails in the one place that matters: a phone driving a projector over HDMI, with no browser chrome, no URL bar, and a screen that must not go to sleep mid-song.

So the Android client is native. It's also deliberately not a second backend. Every byte it fetches comes from the same JSON APIs and the same signed URLs the web app uses. That constraint turns the Android app into a contract test. Any place where the API is only accidentally web-friendly shows up immediately on a device.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Offline worship playback](/posts/sow-offline-playback). Next: [Ten build phases](/posts/sow-retrospective).

<!-- more -->

## The problem

Four mobile-specific constraints have no analogue in the browser.

Cookies without a cookie store. The API authenticates with a session cookie, and the browser manages it automatically. OkHttp doesn't, and the cookie is host-scoped, so a session minted against one URL is invisible to the same app pointed at a different one.

A media stack that has to survive the screen turning off. Video with the screen off, audio in the background, and a lock screen showing what is playing are platform concerns a web player handles inconsistently.

Downloads that outlive the process. The browser path needs the tab to stay open. A phone has to start a large download and let you lock the screen, switch apps, or lose signal and resume later.

A device clock that lies. Presigned URLs expire on the server's schedule, and a phone's clock can be minutes off. Trusting the TTL without checking the device clock produces failures at the server after the UI said it was valid.

## What I built

### Auth

The session persists across process death, encrypted. A stray unauthorized response during startup doesn't overwrite a state the app is still resolving.

The host-mismatch problem is the top support issue, and it's not a code bug. Cookies minted for one host aren't sent to another. The app documents the emulator-versus-device matrix, but can't make the failure self-explanatory when it happens.

### Playback

Playback is in-process, with the CPU and network kept alive while the screen is off, and audio pausing when headphones get unplugged. There's a service for audio-only lock-screen controls, and the video screen drives the player directly. A second, non-functional playback path is exactly the kind of thing that misleads the next reader.

Rotation re-binds the player controller after the activity is recreated. The surviving view model holds a reference to a controller whose player has been released, and commands to a released player do nothing, so the UI looks alive and the transport is dead.

### Chapters and lyrics

The render worker produces a chapters sidecar. The client normalizes it defensively before use, because a malformed sidecar produces a UI that shows the wrong song with no error.

A position ticker drives the current song and lyric line lookups. The lyrics panel highlights the current line, seeks on tap, and auto-scrolls only when the chapter changes. Auto-scrolling on every line change makes the list crawl under the reader's eyes mid-song.

### Offline

Downloads go to the system download manager through a worker. That gives a system notification, OS-level retry and resume, and a metered-network policy. Status is tracked per artifact, not per set, because a set whose video is cached and whose chapters sidecar failed is in a mixed state.

The scheduling has one race worth writing down. Queued metadata is written before the enqueue, because a fast download's completion broadcast can arrive before the download ID is recorded. The row is keyed by render job and kind, not by download ID.

Metadata persists as a single file written atomically, so a process kill mid-write leaves a complete previous file or the new one, never a truncated fragment. A corrupted file resets to empty instead of crashing at launch.

### Expiry and rotation

Signed URLs expire. The client pre-checks expiry against the device clock before playback starts. If that fails or the server says the URL is stale, the UI offers a retry that mints a new one.

## What broke

Cookie host mismatch is the single most common support issue, and the one with the worst error message. The fix is documentation and host normalization, not a clever workaround.

A released player answers commands without playing anything. Re-binding the controller fixed it, and the interesting part is that no API told me the player was gone.

Some devices fall back to a software decoder that can't keep up with the stream. The client detects the software-decoder case and warns instead of showing a stutter.

A half-written metadata file used to fail the launch. Atomic writes fixed that.

The test infrastructure was harder than the tests. Platform boundaries had to be pulled apart before any of them could run, and the coverage exclusions name the classes that can't run on the JVM.

## What I would do differently

Generate the API client from a schema. Hand-written transfer objects turn every server-side rename into a device-side runtime failure.

Run the cookie/origin matrix on a physical device first. The emulator-to-LAN host change is the most common way to lose an hour and can't be caught by JVM tests.

Put release signing in CI before calling it shipped. The app builds and runs and passes tests, but there's no signing config, so it can't be distributed outside local testing.

Delete the unused service or finish it. An unused service is a maintenance liability.
