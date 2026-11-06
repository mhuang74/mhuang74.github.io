---
title: "The web app: preparing a set on a phone"
author: Michael Huang
pubDatetime: 2026-08-11T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-webapp-architecture
featured: false
draft: false
tags:
  - stream-of-worship
  - nextjs
  - aws
  - web
description: "Separating editing from rendering, polling for completion, and delivering video to a TV."
---

Preparing a set on a phone means picking songs, submitting a render, and getting a video ready for a larger screen. The editor needs to respond quickly. Encoding a whole service can take minutes.

That gave me a useful division: the web app accepts and tracks the work, while a separate worker produces the files. They share a database and object storage, with a queue between submission and rendering.

This is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [The songset constructor](/posts/sow-songset-constructor). Next: [Offline worship playback](/posts/sow-offline-playback).

<!-- more -->

_Updated November 6, 2026: the paths below are from the November 1 revision. They describe the implementation, not a measurement of the deployed service._

## One backend, several clients

The Next.js app serves browser sessions and JSON APIs. Android uses those APIs too. A Cast receiver is different: it needs a playable media URL without having to sign in to the app.

The [auth proxy](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/proxy.ts) redirects unauthenticated page requests to login, but returns JSON with status 401 for protected API requests. API handlers still check authorization and ownership. Public share and projection routes have their own access paths.

This distinction is small but necessary. A native client expecting JSON can't do anything useful with an HTML login page, and a successful redirect isn't a successful API response. The [proxy tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/proxy.test.ts) make that difference explicit.

Catalog metadata, recordings, songsets, and render jobs live in Postgres. Text search uses titles, pinyin, and credits. Similar-song discovery uses stored embeddings. I wouldn't describe those as one general hybrid search system: the retrieval routes serve different requests.

## Submit a job, then read it again

The [render endpoint](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/app/api/render-jobs/route.ts) validates the request, checks access and limits, inserts a job, and dispatches it. If dispatch fails, it marks the job failed. An active-job guard prevents another render from stacking up for the same set, and stale jobs can be reconciled rather than blocking it indefinitely.

The [dispatcher](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/render/dispatcher.ts) supports SQS and a REST mode. SQS is the default. It sends job, songset, and user identifiers rather than a serialized song list.

The [worker pipeline](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/render-worker/src/sow_render_worker/pipeline.py) reads the database, fetches source assets, mixes audio, renders video, uploads the artifacts, and updates the job. Reading the plan at execution time avoids a second serialized copy in the message, but it also means the message isn't an immutable snapshot of the set at submission.

## Polling is enough for this screen

The [submitted screen](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/components/render/RenderSubmitted.tsx) polls every ten seconds. A transient fetch error leaves the job alone and allows another tick. A 401 or 403 stops polling and asks the user to sign in; it doesn't mean the render failed. A 404 or 410 ends the screen's attempt to track that job.

The README still lists an SSE events endpoint, but that route isn't present in this revision. The client implementation and its [tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/components/render/RenderSubmitted.test.tsx) are the useful references here. I would remove the stale documentation rather than make readers work out which transport exists.

## Give the TV a file it can fetch

The logged-in controller mints a presigned storage URL and passes it to the Cast receiver. Lyrics are baked into the MP4, so that receiver doesn't need the catalog or the user's cookie. The controller requests a four-hour URL for Cast playback to allow setup and a service.

Chapters arrive as a JSON sidecar through an app proxy. That keeps the browser from depending on a cross-origin storage fetch for chapter data. Codec support and network access still matter; the code can't establish that every TV or venue network will work.

For a prepared service, the next step is [offline playback](/posts/sow-offline-playback). A URL that lasts four hours is helpful while online. A downloaded copy needs a different boot and delivery path.
