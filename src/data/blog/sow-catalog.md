---
title: "Building the catalog: 685 rows, 104 duplicates, and IDs that survive it"
author: Michael Huang
pubDatetime: 2026-06-02T00:00:00Z
slug: sow-catalog
featured: false
draft: false
tags:
  - stream-of-worship
  - python
  - data-engineering
description: "Scraping one HTML table into a stable catalog, deduplicating audio by content hash, and migrating 685 rows without breaking anything."
---

Every downstream feature in Stream of Worship assumes a song is a stable, addressable thing. The transition engine keys its matrix on song IDs. The set constructor partitions the pool by themes attached to song IDs. The render worker embeds song IDs in chapter markers. Offline downloads cache by render job, and the render job points at songs.

If a song's identity shifts, all of that degrades quietly. Cached analyses key off a hash that no longer matches a row. A set built last week references a song that "does not exist". So identity has to be stable above everything else, and I built it third, after the schema and the scraper. That ordering cost me a migration.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard). Next: [The analysis pipeline](/posts/sow-analysis-pipeline).

<!-- more -->

## The problem

There's no Chinese worship music API. There's a website, Stream of Praise, with a single WordPress TablePress table of songs. Columns for title, composer, lyricist, album, musical key, and lyrics. That table is the entire upstream surface.

That gives me four problems, and they compound.

First, it's HTML, not a contract. Column order and header text sit under someone else's control. A scraper written against it will eventually break.

Second, no timings. The lyrics are plain text. Nothing upstream is synchronized to audio, which is why the lyrics pipeline exists at all.

Third, no theme tags. A worship set needs thematic structure, and the catalog says nothing about which song fits where.

Fourth, Traditional and Simplified Chinese both appear across sources, and the honorific gets mangled by naive conversion and romanization.

## What I built

### Scraping a page, not an API

The scraper fetches the songs page, finds the table by DOM id, and raises if it's absent. Header cells get matched by Chinese keyword lists rather than by column position, so a column reorder is survivable and a column rename is not. I'd rather the scraper stop than guess which column is the key signature.

Cell text needs one specific fix. Lyrics arrive with line breaks in markup that isn't always well-formed. Some forms simply vanish under naive extraction and silently glue two lyric lines together. The parser normalizes every line-break variant before extracting text.

### Identity that survives a re-scrape

My first ID scheme was pinyin plus table row number. Cheap, and wrong. Row numbers shift when songs are inserted, so a re-scrape after any upstream addition reassigned IDs for a large fraction of the catalog and broke every foreign key along the way.

The replacement derives the ID from the song's own bibliographic data. Take the title, composer, and lyricist, normalize the text, hash it, and put a short digest after a readable pinyin slug. Same song, same ID. Different song, different ID. Two songs with the same title and different composers still separate cleanly.

The slug is for humans. The digest is for uniqueness. There's also a hard length cap so long Chinese titles don't turn into unwieldy pinyin slugs. The honorific gets rewritten to its common form before romanization, because the library's default reading for that character would make the title unsearchable for the people who actually type it.

### Audio: content hash as the primary key

A song is a work. A recording is a set of bytes. The schema separates them, and the recording table's primary key is the hash of the audio file itself.

Finding the audio is the fuzzy part. The downloader searches YouTube against the publisher's own naming convention, scans the top results, and picks the one whose title matches the song after bracket-aware normalization. Brackets matter, because official titles carry annotations that break naive matching.

Two guards prevent the obvious mis-downloads. Anything far longer than a comparable track is probably a medley, and a medley is worse than no audio at all. Anything unusually long gets flagged for the operator. Hashing before upload means a duplicate never costs a PUT. A duplicate stops the job and names the song that already owns those bytes, because content-hash duplication usually means you downloaded the wrong video.

Storage layout follows the same hash. Audio, lyrics, stems, and the analysis manifest all live under one content hash.

### The migration that failed on a foreign key

The stable-ID cutover ran against 685 scraped songs. 581 were active. 104 were duplicate rows, a symptom of the same song showing up under multiple albums or with slightly different composer spellings. I soft-deleted the 104 and kept the earliest-scraped instance as canonical.

The first attempt died on a foreign-key constraint. The cause was structural, not data: the rename ran as one update, and two old IDs could legitimately map to the same new ID, so the update transiently created a collision that the constraint blew up on.

The fix was two mechanisms at once. Foreign-key enforcement came off inside the migration transaction so the intermediate state was legal. And the rename ran in two passes through a temporary namespace, routing every old ID to a disjoint scratch value before landing on the final one. No intermediate state ever collided with an existing row.

Twenty-one recordings had valid song references after the migration. The small number is itself informative: audio ingestion had barely started when the ID scheme changed. Had it been hundreds, the same migration would have needed an actual verification pass.

### Two more normalizations

Script conversion. One audio source publishes lyrics in Simplified Chinese and the catalog is Traditional. The conversion protects the honorific with a placeholder so it survives the round trip unchanged, and it's idempotent on a second pass.

Key disagreement. The catalog gives a key per song. The analysis pipeline detects one from audio. They agreed on roughly three out of four songs, and the disagreements clustered around dominant and subdominant relations, which is a classic failure mode for profile-based key detection. The catalog key wins for display. The detector output stays as diagnostics.

## What broke

The site structure changed once and the scraper threw. That's what I asked for, and it still cost me an afternoon, because "table not found" looks identical to "page did not load" until you read the HTML.

For a handful of songs the official video simply isn't in the first few search results. The error path wants the operator to supply a URL explicitly, which is the right escape hatch but still a manual step.

The wrong video got caught as a duplicate hash. A search returned a different song's video for two catalog entries, and the second download failed on the same bytes. Correct failure, and the message naming the owning song is what made the diagnosis quick.

Simplified and Traditional drift silently produced lyric text that didn't match the audio. It only surfaced when alignment scored poorly. The placeholder fix came after.

## What I would do differently

Define ID stability before the first scrape. My row-number scheme was one afternoon's work and cost a full migration. Identity should be the first table design decision, not the third.

Add a scrape-contract test. A test that asserts the header keywords, the table id, and the shape of one parsed row would fail in CI when the page changes, instead of at the start of a batch run.

Make duplicate audio a review queue, not a command failure. A duplicate hash means either "you already have this" or "you downloaded the wrong video", and the system can't tell which. Right now it guesses by refusing. A queue with both candidates side by side is the honest interface.

Reconcile the two key sources instead of picking one. A disagreement that's mostly dominant or subdominant is signal, not noise. It should surface as a per-song flag instead of vanishing into diagnostics.
