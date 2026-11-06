---
title: "Building the catalog: song IDs that survive another scrape"
author: Michael Huang
pubDatetime: 2026-06-02T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-catalog
featured: false
draft: false
tags:
  - stream-of-worship
  - python
  - data-engineering
description: "Scraping the song table, separating songs from recordings, and fixing the first ID migration."
---

I needed a catalog before I could experiment with worship sets. [Stream of Praise’s songs page](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/scraper.py) had most of the text I needed in one table. The harder question was how to identify a song when the table changed.

The first IDs included row numbers. Inserting a row upstream could change IDs on the next scrape, so those numbers weren't suitable for references from recordings and songsets.

This post is part of [Stream of Worship, a series](/posts/sow-intro). Previous: [Why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard). Next: [The analysis pipeline](/posts/sow-analysis-pipeline).

<!-- more -->

_Updated November 6, 2026: implementation details below refer to the November 1 source snapshot. Later changes are dated where they matter._

## Scraping the table

The scraper looks for `tablepress-3`, then matches headers by Chinese or English keywords. That tolerates a column reorder. A missing table or lyrics column raises an error; other absent fields may be empty, and individual row failures are logged and skipped. It isn't a complete check that the upstream page still means what I think it means.

Lyrics needed some care. Both normal line-break tags and malformed tags with nested text appear in the parser's handling. Simply extracting cell text can join lines together. The scraper replaces or unwraps the tags first, then splits the text into lines. Its section output is still one `unknown` section; musical structure comes later from analysis.

The [scraper tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/tests/admin/test_scraper.py) cover parsing, and [ID stability tests](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/tests/admin/services/test_scraper_id_stability.py) cover reorder and duplicate cases. They check saved HTML examples, so a live page change still needs investigation.

## Two kinds of identity

A song's ID now comes from its title, composer, and lyricist. The [ID helper](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/catalog_edit.py) trims and NFKC-normalizes those fields, hashes the combined text, and appends eight hex characters to a pinyin slug. The whole ID is capped at 100 characters.

This keeps IDs stable across row reordering. It doesn't make them independent of metadata corrections, or prove that two differently credited entries are different works. The digest is short, so I also shouldn't describe uniqueness as a mathematical guarantee.

For pinyin, 祢 and 禰 are replaced with 你 before romanization so the title uses `ni` rather than the library's `mi`. The original title stays intact.

A recording has a separate identity: SHA-256 of the downloaded audio bytes. The [downloader](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/youtube.py) searches YouTube, normalizes candidate titles, and checks duration to avoid some medleys and unusually long results. A matching hash can catch a duplicate before upload. It can't prove the search found the right performance.

## The first migration

The [April 28 migration handover](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/handover_db_migration_song_ids.md) records 685 songs, of which 104 mapped to duplicate IDs. The repair kept the earliest old entry as canonical and soft-deleted the duplicates, leaving 581 active songs. All 21 recordings had valid song references afterward. These are counts from that migration, not today's catalog size.

The failed command had updated `recordings.song_id` before updating the parent `songs.id`. With foreign keys enabled, the new parent didn't exist yet. Duplicate target IDs were an additional problem.

The repair used a one-off script with foreign-key enforcement disabled for the operation and two rename passes through temporary IDs. The handover records the result; the repair script itself wasn't committed. That limits how much of the operation can be reproduced from source.

## Catalog keys are reference data

A [July 3 audit](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/key_detection_algorithm_review.md) compared detected roots with catalog roots: 75 matches out of 98 comparable recordings, or 76.5%. It ignored major/minor mode, excluded two rows with missing data, and treated enharmonic spellings as equal. The catalog key wasn't guaranteed ground truth either.

That was useful evidence for improving the detector, but it wasn't a general key-detection accuracy score. Keeping catalog metadata and recording analysis separate lets me revisit disagreements without losing either source.

For this project, row order was easy to use and expensive to depend on. I'd choose the identity fields before the first import next time.
