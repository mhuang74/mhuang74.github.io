---
title: "The web app: phone-first worship on Vercel and Lambda"
author: Michael Huang
pubDatetime: 2026-10-29T00:00:00Z
slug: sow-webapp-architecture
featured: false
draft: false
tags:
  - stream-of-worship
  - nextjs
  - aws
  - web
description: "A Next.js 16 editor, Neon + Drizzle, Better Auth, SQS/Lambda renders, polling progress, and cast-based projection."
---

The person using Stream of Worship is standing in a sanctuary on a Saturday night with a phone. They pick four songs, set a couple of transition parameters, hit render, and want an MP4 that plays on the projector TV in the morning. Nothing about that workflow involves a laptop, a terminal, or a server they administer. That one sentence of user intent dictated the whole web architecture, and most of the painful decisions in it.

The render is where the intent meets physics. A ten-minute lyrics video means downloading several hundred megabytes of stems and audio, running FFmpeg for minutes of wall time, burning subtitles, and encoding H.264. A Vercel serverless function can't do that inside its invocation budget, and it shouldn't try. So the app splits in two: a request plane that's small, fast, and authenticated, and a render plane that's large, slow, and disposable. A queue connects them.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [The songset constructor](/posts/sow-songset-constructor). Next: [Offline worship playback](/posts/sow-offline-playback).

<!-- more -->

## The problem

Four very different clients talk to this system, and they have almost nothing in common. A phone browser with a session cookie. A projector TV running a Chromecast receiver with no session and no way to log in. A native Android app that needs cookie-based auth over OkHttp. A Lambda worker that has to write results back to the database without being trusted to serve users.

Each one needs a different auth answer, and getting that wrong produces failures that look like product bugs. A receiver that gets an HTML login page instead of a video shows a black screen. An Android client that gets a 307 to `/login` tries to deserialize the HTML body and reports `invalid token '<'` — an error message pointing at a JSON parser three layers away from the actual cause.

Then there's the artifact problem. Rendered videos are hundreds of megabytes and they get delivered to devices that aren't always on the same network as the person who made them. The TV has to fetch a video for an hour-long service without credentials, without a session, and ideally without touching the webapp at all.

## Breaking it down

- **Identity across four clients.** Done when every API distinguishes "no session" from "wrong user" with a machine-readable response, and no client ever gets an HTML body where it expected JSON.
- **A render pipeline that outlives a request.** Done when a closed browser tab doesn't lose a render, because the job's state lives in the database instead of in memory.
- **Storage and time-limited access.** Done when an unauthenticated device can fetch exactly one artifact, for a bounded window, and nothing else.
- **Progress that costs nothing.** Done when the composer screen can tell "still rendering" from "done" without a persistent connection and without hammering the database.
- **A catalog that is searchable in two scripts.** Done when a leader can type pinyin or Chinese characters and find a song, ranked sensibly.

## What I built

### The request plane

Next.js 16.2.6 with the App Router, React 19.2.4, Drizzle ORM 0.45.2 over the Neon serverless Postgres driver, and Better Auth 1.6.11 for email/password sessions. Deployed on Vercel. Sessions last 7 days with a 24-hour update age, chosen on purpose for a tool used once or twice a week.

Auth is enforced in a single proxy layer instead of per route. The subtlety is that the same middleware serves browsers and machines, and they need different refusal shapes: a browser should get redirected to a login page, while an API caller has to get a status code it can branch on. The comment in `src/proxy.ts` records why:

```ts file="delivery/webapp/src/proxy.ts:99-108"
  if (!session) {
    // API routes should return a JSON 401, not an HTML redirect. Non-browser
    // clients (Cast receivers, Android app, curl) cannot follow or parse the
    // /login HTML redirect and fail with JSON parse errors like
    // "invalid token '<'". Browser requests still get the redirect for UX.
    if (pathname.startsWith("/api/")) {
      return withAutoLocaleCookie(
        request,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
```

That comment is a scar. Before it existed, the Android client's error boundary reported a serialization failure on every cold start with an expired cookie, and the stack trace pointed into the JSON decoder instead of at the auth layer.

### The data model

Nineteen tables in one Drizzle schema, but only a handful carry product weight: `songs` (the catalog entity), `recordings` (the audio renditions of a song, keyed by content hash), `songsets` and `songset_items` (the plan, with per-item transition parameters), `render_jobs` (the async work), plus embedding and share tables.

Search is a generated `tsvector` column with weighted fields, joined by a GIN index. Traditional Chinese titles and pinyin both weigh `A`; composer, lyricist, and album weigh `B`:

```sql
setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
setweight(to_tsvector('simple', coalesce("title_pinyin", '')), 'A') ||
setweight(to_tsvector('simple', coalesce("composer", '')), 'B')
```

Semantic search is a separate 1536-dimension pgvector column populated with `text-embedding-3-small` embeddings and a cosine index. Lexical and vector results get combined at the application layer rather than in one SQL statement, which keeps each retrieval path independently explainable.

### The render plane

`POST /api/render-jobs` does five things and nothing else: validate the session, Zod-parse the render config, enforce song-count and duration limits, insert a `render_jobs` row, and enqueue. If the enqueue throws, the job gets marked failed synchronously instead of being left in a state nobody will ever advance. An already-active job for the same songset returns 409 rather than stacking a second expensive render on top of the first.

The dispatch itself is boring on purpose — one function, two transports, no retry logic, because the worker owns its retries:

```ts file="delivery/webapp/src/lib/render/dispatcher.ts:25-39"
export async function dispatchToRenderWorker(
  message: DispatchMessage
): Promise<void> {
  const mode = getRenderWorkerMode();

  if (mode === "rest") {
    if (!cachedRestClient) {
      cachedRestClient = createRestClientFromEnv();
    }
    await cachedRestClient.invoke(message as RenderWorkerMessage);
  } else {
    if (!cachedSqsClient) {
      cachedSqsClient = createSQSClientFromEnv();
    }
    await cachedSqsClient.sendMessage(message as SQSMessage);
  }
}
```

The payload is `{jobId, songsetId, userId}` — identifiers only, never a serialized songset. The worker re-reads the plan from Postgres, so a job message can never carry stale song data or, worse, an injection surface. The `rest` transport exists purely for local development, where standing up SQS is more friction than the feature is worth. Production defaults to the queue.

The worker is a container image on Lambda that pulls the job, renders MP3 and MP4 (with a chapters sidecar), writes to R2, and updates the row. AWS-side configuration: SQS visibility timeout 900 s, a dead-letter queue after 3 receives, batch size 1. Rendering isn't batchable — one job saturates the container.

### Progress without a socket

The client polls `GET /api/render-jobs/[id]` every 10 seconds (`RENDER_JOB_POLL_INTERVAL_MS = 10_000`). That's the shipped mechanism, and the polling loop's error handling is the interesting part. A failed request changes nothing about the job, so transient errors resume on the next tick; 401/403 stop polling and surface "session expired"; 404/410 stop polling and mark the render failed. Visibility into the job is independent of the job's existence, and the client is written to respect that.

I want to be precise here because the repo's own README is not. It advertises `GET /api/render-jobs/[id]/events` and "SSE progress streaming". That route does not exist. There's no `EventSource` anywhere in `src`. The documented streaming endpoint was never built; polling is what ships. That's a documentation-drift failure I'll come back to.

### Delivery to a device that can't log in

Artifacts live in R2. Access is through presigned URLs minted server-side, scoped to the session that owns the render job — the lookup joins on `render_jobs.userId`, so a valid session for user A can't mint a URL for user B's render.

TTLs: 3600 s by default, 14400 s for the cast/share video path, with an explicit override clamped by Zod to the 60–86400 s range. The 14400 s value is sized to "a service plus margin", which is why a service running past roughly 3 h 40 m needs a deliberate stop-and-re-cast instead of failing mid-song.

The projector path is Google Cast with the Default Media Receiver, and the lyrics are baked into the MP4. The receiver gets a URL to R2 and never contacts the webapp, never authenticates, never needs the catalog. The Media Receiver's chrome is cosmetic, not functional. Chapters are a sidecar JSON that the app fetches server-side on the share path, because R2 isn't configured to let the browser fetch that object directly.

## What broke

**The black screen on the TV** had two causes, and neither was in the code I was looking at. One venue had client isolation on the guest VLAN, so the TV could reach the internet but not the R2 endpoint resolution path the laptop used. The other was a codec mismatch: the receiver advertises H.264/AAC support, and an encode ffprobe accepted still produced a black frame because the `moov` atom trailed the `mdat`, so the receiver had nothing to start on. The fix was a pipeline assertion, not a player setting.

**Chapters CORS.** The share page fetched the chapters JSON straight from the presigned R2 URL and failed in the browser. Moving the fetch server-side inside the share route removed the CORS dependency entirely, which is cheaper than configuring bucket CORS policies across environments.

**Stale receiver state.** A Cast receiver can report a position that hasn't changed in a while — paused, buffering, or just wedged. Anything over 60 seconds (`STALE_THRESHOLD_SECONDS = 60`) now prompts the operator to resume, instead of silently auto-resuming at a position the receiver might not honour.

**Cold starts.** One to three seconds on a cold Lambda, accepted rather than engineered away. The first render after a quiet week is slower, but the operator is already waiting minutes for the encode, so the extra second doesn't change the experience.

**Orphaned jobs.** Rows stuck in `running` because the container was killed mid-render get reconciled and marked failed after 30 minutes. Without that sweep, the 409 "already active" guard would permanently block a songset.

**A region split I wouldn't repeat by accident.** Vercel serves from `us-east-1`; the queue, worker, and database sit in `us-west-2`. Enqueue costs roughly 70 ms of cross-region latency, which is invisible because everything downstream is async — but it does mean every synchronous database round trip from a page render pays that distance too.

## Evidence

| Layer                   | Responsibility                       | Why it is there                                                       | Measured                                                                           |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Vercel / Next.js 16.2.6 | Request plane, auth proxy, editor UI | Instant deploys, edge-cached pages, no server to patch                | Session 7 d; JSON 401 on `/api/*`                                                  |
| SQS                     | Durable handoff to the render plane  | Decouples a 10-minute encode from a 10-second request                 | Visibility 900 s; DLQ at 3 receives; batch 1                                       |
| Lambda container        | MP3/MP4 render, FFmpeg, chapters     | Pay-per-render, disposable, no idle cost                              | Plan: 4 GB (720p, 3–5 min), 10 GB (1080p, 5–10 min); 15 min ceiling; image <500 MB |
| R2                      | Artifacts: audio, video, chapters    | Presigned GET, no egress bill, TV never needs the app                 | TTL 3600 s; 14400 s cast; clamp 60–86400 s                                         |
| Neon Postgres           | Catalog, plans, jobs, embeddings     | Serverless branching for migrations; pgvector + tsvector in one place | 1536-dim cosine index; GIN on weighted tsvector                                    |
| Client poller           | Progress                             | No socket, no server state, survives tab throttling                   | Every 10 s; 401/403 and 404/410 stop                                               |

The sizing figures above are the deployment plan's targets. The provisioned Lambda memory in the deploy scripts is lower (3 GB, with a comment that 3 GB is the floor for 1080p). I'm quoting both because the gap is the honest state of the repo.

## What I'd do differently

1. **Ship the mechanism the docs promise, or delete the promise in the same commit.** The README has claimed SSE progress for the entire life of the polling implementation. Two artifacts disagreeing about the transport is worse than either choice on its own, because it costs a reader an hour before they conclude the docs are wrong.

2. **Make region co-location and queue depth observable, not remembered.** Nothing in the repo would have caught a worker in the wrong region, and an operator who submits during a burst sees "queued" with no idea whether that means five seconds or five minutes. A startup self-check plus one depth query turns both into facts.

3. **Make the network preflight part of the cast flow.** The VLAN and codec checks live in a README that nobody reads at 7 a.m. on a Sunday. They belong in the cast button's failure path, where the operator actually is.

4. **Treat the four-client auth matrix as a test surface.** The `invalid token '<'` class of bug is only discoverable from a non-browser client. One test per client against the same middleware would have caught it before Android did.

Source: [proxy.ts](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/src/proxy.ts) · [dispatcher.ts](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/src/lib/render/dispatcher.ts) · [schema.ts](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/src/db/schema.ts) · [render job route](https://github.com/mhuang74/stream_of_worship/blob/main/delivery/webapp/src/app/api/render-jobs/route.ts)
