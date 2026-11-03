---
title: "The web app: phone-first worship on Vercel and Lambda"
author: Michael Huang
pubDatetime: 2026-08-11T00:00:00Z
slug: sow-webapp-architecture
featured: false
draft: false
tags:
  - stream-of-worship
  - nextjs
  - aws
  - web
description: "A phone-first web app on serverless components, with a render plane, presigned delivery, and polling progress."
---

The person using Stream of Worship is standing in a sanctuary on a Saturday night with a phone. They pick four songs, set a couple of transition parameters, hit render, and want an MP4 that plays on the projector TV in the morning. Nothing about that workflow involves a laptop.

That one sentence of intent dictated the architecture. The app splits in two. A request plane that's small, fast, and authenticated. A render plane that's large, slow, and disposable. A queue connects them.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The songset constructor](/posts/sow-songset-constructor). Next: [Offline worship playback](/posts/sow-offline-playback).

<!-- more -->

## The problem

Four very different clients talk to this system. A phone browser with a session cookie. A projector TV running a Chromecast receiver with no session. A native Android app that needs cookie-based auth. A Lambda worker that has to write results back to the database.

Each one needs a different auth answer, and getting it wrong produces failures that look like product bugs. A receiver that gets an HTML login page shows a black screen. An Android client that gets a redirect tries to parse the HTML body and reports an impossible JSON error.

Then there's the artifact problem. Rendered videos are hundreds of megabytes and need to reach devices that aren't always on the same network.

## What I built

### The request plane

The web app runs on serverless components with a session cookie that persists for days. Auth is enforced in one proxy layer instead of per route, because the same middleware serves browsers and machines and they need different refusal shapes. Browsers get redirected. API clients get a status code they can branch on.

### The data model

The catalog, recordings, songsets, render jobs, embeddings, and share tables all live in one database. Search is a weighted text index for titles, pinyin, composer, lyricist, and album. Semantic search is a separate vector index. The two results get combined at the application layer so each retrieval path stays explainable.

### The render plane

The render endpoint does five things: validate the session, parse the config, enforce limits, insert the job row, and enqueue. If the enqueue fails, the job gets marked failed immediately instead of stranded. An already-active job returns conflict rather than stacking.

The dispatch is boring on purpose. One function, one transport, no retry logic, because the worker owns its retries. The payload contains identifiers only, never a serialized songset. The worker re-reads the plan from the database, so a job message can never carry stale data.

The worker is a container that pulls the job, renders audio and video, writes to storage, and updates the row. One job saturates the container, so it's not batchable.

### Progress without a socket

The client polls the render status every ten seconds. That's the shipped mechanism, and the error handling is the interesting part. A failed request changes nothing about the job, so transient errors resume on the next tick. Unauthorized and forbidden stop polling and surface session expired. Not found and gone stop polling and mark the render failed.

I mention this because the README advertises a streaming endpoint that doesn't exist. Polling is what ships.

### Delivery to a device that can't log in

Artifacts live in object storage. Access is through presigned URLs minted server-side and scoped to the session that owns the render job. Time limits are sized to a service plus margin.

The projector path uses Chromecast with the lyrics baked into the MP4. The receiver gets a URL to storage and never contacts the web app or needs a catalog. Chapters are a sidecar JSON that the app fetches server-side, because the storage bucket isn't configured to let a browser fetch it directly.

## What broke

The black screen on the TV had two causes, and neither was in the code I was looking at. One venue had client isolation on the guest network. The other was a codec mismatch where the file's index was at the end instead of the beginning, so the receiver had nothing to start on.

Share-page chapters failed in the browser because cross-origin access to storage wasn't configured. Moving the fetch server-side removed the need for it.

A Cast receiver can report a stale position. Now anything over a minute prompts the operator to resume instead of auto-resuming from a wedged position.

Cold starts on the worker are accepted rather than engineered away. The operator is already waiting minutes for the encode, so a couple of extra seconds don't change the experience.

Orphaned jobs stuck in running get reconciled after a timeout. Without that sweep, an active-job guard would permanently block a songset.

The web app and the worker run in different regions. The enqueue cost is invisible, but every synchronous database round trip pays for the distance.

## What I would do differently

Ship the mechanism the docs promise, or delete the promise in the same commit. Two artifacts disagreeing about the transport costs a reader an hour.

Make region co-location and queue depth observable instead of remembered. Nothing in the repo would catch a worker in the wrong region.

Make the network preflight part of the cast flow. The README troubleshooting is useless at 7 a.m. on a Sunday. It belongs in the cast button's failure path.

Treat the four-client auth matrix as a test surface. The redirect-to-login bug is only discoverable from a non-browser client.
