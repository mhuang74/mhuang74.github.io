---
title: "Ten build phases: what Stream of Worship taught me"
author: Michael Huang
pubDatetime: 2026-09-22T00:00:00Z
slug: sow-retrospective
featured: false
draft: false
tags:
  - stream-of-worship
  - building
  - retrospective
description: "Ten phases and a year of evenings and weekends built Stream of Worship. Here is what worked and what I would do differently."
---

Ten phases, roughly a year of evenings and weekends, and one working system. Stream of Worship holds a catalog of Chinese worship songs, a pipeline that turns audio into tempo, key, structure, and stems, a set constructor that follows a liturgical arc, a serverless renderer, a web app, and two offline clients.

This is not the launch announcement. This is where I tell you which decisions I would make again and which ones cost more than they returned.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Going native: the Android client](/posts/sow-android-client). One more post follows after this: the lyrics-quality work that became Detector 2.0.0.

<!-- more -->

## Ten phases

In order: a CLI scaffold and database schema. Scraping the catalog. Downloading recordings. An analysis service with job queues. Wiring the CLI to the service over HTTP. Lyrics generation. A database migration. The web app. A render worker. Android.

The build order is not the difficulty order. It is not the value order either. The first three phases produced nothing visible. The last three made the product usable by another person. The middle carried the risk.

## What worked

Content addressing went further than any other decision. A recording's primary key is the SHA-256 of its audio bytes. Dedup, storage layout, analysis caching, and the transition matrix all key off content, not identity or time. Add a song twice and nothing happens. Re-analyze and you get the same cache key. A stale row never points at bytes it was not analyzed from.

The transition engine scores the exit of one song against the entry of the next. I got there by listening to a bad transition and realizing the numbers described the wrong thing.

In the songset constructor, the LLM proposes and annotates. Hard constraints and a fixed fitness function decide validity, with no model in that path. Take the API key away and the system still works. That is the real test of the split.

Offline was a launch requirement. "Plays with zero network" stayed an invariant from day one, and it shaped the service worker and the Android download path. Bolt those on later and you rewrite them.

One box runs the GPU work. Only the analysis service imports machine-learning libraries. The CLI and the Android app never touch the database or the queue. They call APIs. That is how a container with a 12 GiB model moved off my machine without touching anything else.

The lyrics-quality work measured every improvement against a frozen validation set, not against the data that inspired the change. That discipline is why those numbers mean anything.

## What I would change

I built two terminal UIs before the web app. The first was a Textual app. The second replaced it. Then the web app replaced both. Two throwaway interfaces is one and a half too many. The TUI was handy for poking at pipeline stages, but a terminal UI for a phone-first workflow was the wrong category. I spent months learning that.

I started on the wrong database. The first data layer was hosted SQLite. Moving to Postgres took one runbook through four versions, three separate client stacks, and a vector-index migration. Postgres was the right call. Picking it on day one deletes an entire phase.

I benchmarked rclone against boto3 before adopting it, and rclone lost every time. The interesting part is why. R2 caps aggregate throughput per account on this workload, so adding workers past eight does nothing. Push the worker count higher and throughput drops, because the fixed cap splits across more streams with more protocol overhead. Measure, then decide. Parallelism is a resource decision, not a dial.

The original design doc dreamed too big. It specified a pile of components: madmom, pyrubberband, Celery, Redis, sub-two-second rendering, nearly automatic everything. What shipped is smaller on every axis, with recommendations a human accepts or overrides. The spec was not wrong about what would be nice. It was wrong about what a solo project can keep alive.

The web app's README documented a server-sent-events progress endpoint. That route does not exist. The client polls every 10 seconds. Cheapest error in the repo, and the most corrosive. You trust the docs, you lose an hour, and then you trust nothing else.

The UI sells knobs the renderer ignores. Key shift and tempo ratio persist, edit, and display in the web app. The render worker applies neither. A saved plan promises a transposition the audio never delivers. Never ship a control whose value cannot change the output.

The Qwen3 tail experiment half-works. Some recordings have a caption track that ends before the vocals do. I tried recovering the missing lyrics with Qwen3's audio mode. It fired on more than half the eligible jobs and got something back on most of those. Yet most of its raw attempts came back junk, and Whisper needed the better part of a minute per recovered line. The honest verdict: keep both paths, and the Qwen3 tail path is the weak one.

## By the numbers

A few numbers stand on their own. The scrape pulled in 685 catalog rows, including 104 duplicates I soft-deleted, leaving 581 active songs. They have 444 recordings attached, and only 74 published. The rest sit in review. The transition engine precomputes compatibility for every ordered pair in the usable pool, so the constructor draws on roughly 438 songs without pausing to measure anything.

## What is next

Timbre. Every measure in the transition engine describes pitch and time. Nothing describes sound. Two songs a fourth apart with different production still clash. Timbre distance is the biggest missing signal.

Chorus-to-chorus joins. The engine assumes transitions land on section boundaries. That holds most of the time. It fails in the case that matters most: the end of one chorus straight into the start of another. Picking the join point inside that overlap is a search problem, not an assumption.

A bad-transition filter that explains itself. "Too close sounds bad" is real, and I still cannot say why. A filter that flags the transition and names the guilty feature turns a hunch into a diagnosis.

Longer sets and other languages. The arc has no template past five songs, so long services stay out of reach. And this whole build, Traditional Chinese canonical with pinyin as the bridge, is a recipe other languages can follow.

## Closing

The system is open source at [mhuang74/stream_of_worship](https://github.com/mhuang74/stream_of_worship). The [user guide](https://streamofworship.com) covers the worship-leader workflow, and the [series introduction](/posts/sow-intro) maps every post.

First lesson: the interesting engineering was never where I expected it. I thought the DSP would be the hard part. Identity was. Stable song IDs, content-hashed recordings, provenance that survives a cache purge, and a system that says "I don't know" instead of guessing. The DSP is librosa and FFmpeg calls. I would write those the same way again.

Second lesson: an honest system costs little to build and plenty to fake. Every failure I fixed cheaply, I fixed by making the system admit something. A warning that names the missing boundary tempo. An index that says "review" instead of "published". A README that needed to say "polling". Where I let the system promise more than it delivered, the cost showed up later, in the next reader's trust.
