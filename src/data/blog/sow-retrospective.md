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

Ten build phases, about a year of evenings and weekends, and one working system. Stream of Worship now holds a catalog of Chinese worship songs, a pipeline that turns audio into tempo, key, structure, and stems, a set constructor that follows a liturgical arc, a serverless renderer, a web app, and two offline clients.

Now that it works, I wanted to write down which decisions I would make again and which ones I would skip. Mostly so I don't repeat the expensive mistakes.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Going native: the Android client](/posts/sow-android-client). One more post follows after this: the lyrics-quality work that became Detector 2.0.0.

<!-- more -->

## Ten phases

Here are the phases in order: a CLI scaffold and database schema. Scraping the catalog. Downloading recordings. An analysis service with job queues. Wiring the CLI to the service over HTTP. Lyrics generation. A database migration. The web app. A render worker. Android.

The build order wasn't the difficulty order, or the value order either. The first three phases produced nothing visible. The last three made the product usable by another person. The middle ones carried most of the risk.

## What worked

Content addressing turned out to be my best decision. A recording's primary key is the SHA-256 of its audio bytes. Dedup, storage layout, analysis caching, and the transition matrix all key off content, not identity or time. Add a song twice and nothing happens. Re-analyze and you get the same cache key. A stale row never points at bytes it was not analyzed from.

The transition engine scores the exit of one song against the entry of the next. I only got there after listening to one bad transition and realizing the numbers were describing the wrong thing.

In the songset constructor, the LLM proposes and annotates. Hard constraints and a fixed fitness function decide validity, with no model in that path. Take the API key away and it all still works, which I think is the real test of this split.

Offline was a launch requirement from day one. "Plays with zero network" stayed an invariant the whole time, and it shaped the service worker and the Android download path. Bolt those on later and you end up rewriting them.

Only one box runs the GPU work. The analysis service is the only piece that imports machine-learning libraries. The CLI and the Android app never touch the database or the queue; they just call APIs. That's how a container with a 12 GiB model moved off my machine without me touching anything else.

The lyrics-quality work measured every improvement against a frozen validation set, not against the data that inspired the change. That's the only reason I trust those numbers.

## What I would change

I built two terminal UIs before the web app. The first was a Textual app, the second replaced it, and then the web app replaced both. Two throwaway UIs is at least one too many. The TUI was handy for poking at pipeline stages, but a terminal UI for a phone-first workflow was just the wrong category to build. It took me months to figure that out.

I started on the wrong database. The first data layer was hosted SQLite. Moving to Postgres took one runbook through four versions, three separate client stacks, and a vector-index migration. Postgres was the right call; I just should have picked it on day one and skipped the whole migration phase.

I benchmarked rclone against boto3 before adopting it, and rclone lost every time. The interesting part is why. R2 caps aggregate throughput per account on this workload, so adding workers past eight does nothing. Push higher and throughput actually drops, because the fixed cap gets split across more streams with more protocol overhead. So: measure first, then decide. Parallelism is a resource decision, not a dial.

The original design doc dreamed too big. It specified a pile of components: madmom, pyrubberband, Celery, Redis, sub-two-second rendering, nearly automatic everything. What shipped is smaller on every axis, with recommendations a human accepts or overrides. The ideas weren't wrong about what would be nice. They were just more than one person can keep alive.

The web app's README documented a server-sent-events progress endpoint. That route doesn't exist. The client polls every 10 seconds. It's the cheapest mistake in the repo and the one that bothered me the most. You trust the docs, lose an hour, and after that you don't trust any of them.

The UI sells knobs the renderer ignores. Key shift and tempo ratio persist, edit, and display in the web app, but the render worker applies neither. So a saved plan can promise a transposition the audio never delivers. Don't ship a control whose value can't change the output.

The Qwen3 tail experiment half-works. Some recordings have a caption track that ends before the vocals do, so I tried recovering the missing lyrics with Qwen3's audio mode. It fired on more than half the eligible jobs and got something back on most of those. But most of its raw attempts came back as junk, and Whisper still needed the better part of a minute per recovered line. I'll keep both paths, but the Qwen3 tail is definitely the weak one.

## By the numbers

A few numbers stand on their own. The scrape pulled in 685 catalog rows, including 104 duplicates I soft-deleted, leaving 581 active songs. They have 444 recordings attached, and only 74 published. The rest sit in review. The transition engine precomputes compatibility for every ordered pair in the usable pool, so the constructor draws on roughly 438 songs without pausing to measure anything.

## What is next

Timbre. Every measure in the transition engine describes pitch and time. Nothing describes sound. Two songs a fourth apart with different production still clash. Timbre distance feels like the biggest missing signal.

Chorus-to-chorus joins. The engine assumes transitions land on section boundaries. That holds most of the time, but it fails in the case that matters most: the end of one chorus straight into the start of another. Picking the join point inside that overlap is a search problem, and the current version just pretends it doesn't exist.

A bad-transition filter that explains itself. "Too close sounds bad" is real, and I still can't say why. A filter that flags the transition and names the guilty feature would turn a hunch into something I can actually debug.

Longer sets and other languages. The arc has no template past five songs, so long services stay out of reach. And this whole build, Traditional Chinese canonical with pinyin as the bridge, is a recipe other languages can follow.

## Closing

The system is open source at [mhuang74/stream_of_worship](https://github.com/mhuang74/stream_of_worship). The [user guide](https://streamofworship.com) covers the worship-leader workflow, and the [series introduction](/posts/sow-intro) maps every post.

Two things surprised me looking back at the whole build.

The hard problems were never where I expected them. I thought the DSP would be the hard part. It wasn't; identity was. Stable song IDs, content-hashed recordings, provenance that survives a cache purge, a system that says "I don't know" instead of guessing. The DSP turned out to be mostly librosa and FFmpeg calls, and I would write those the same way again.

The second surprise: it's cheap to make a system honest while you're building it, and painful to fake it later. Every failure I fixed cheaply, I fixed by making the system admit something. A warning that names the missing boundary tempo. An index that says "review" instead of "published". A README that says "polling". The places where I let the system promise more than it delivered were the ones I paid for later.
