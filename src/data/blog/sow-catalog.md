---
title: "Building the catalog: 685 rows, 104 duplicates, and IDs that survive it"
author: Michael Huang
pubDatetime: 2026-10-24T00:00:00Z
slug: sow-catalog
featured: false
draft: false
tags:
  - stream-of-worship
  - python
  - data-engineering
description: "Scraping one HTML table into a stable catalog, deduplicating audio by content hash, and migrating 685 rows without breaking foreign keys."
---

Every downstream feature in Stream of Worship assumes a song is a stable, addressable thing. The transition engine keys its compatibility matrix on song IDs. The songset constructor partitions the pool by themes attached to song IDs. The render worker embeds song IDs in chapter markers. Offline downloads cache by render job, but the render job points at items, and the items point at songs.

If a song's identity shifts, all of that degrades quietly. Cached analyses key off a hash that no longer matches a row. Favorites vanish. A set built last week references a song that "does not exist."

Identity is the load-bearing wall, and I built it third, after the schema and after the scraper. That ordering cost me a migration.

This post is part of [Stream of Worship — a series](/posts/sow-intro). Previous: [Why seamless worship transitions are hard](/posts/sow-why-transitions-are-hard). Next: [The analysis pipeline](/posts/sow-analysis-pipeline).

<!-- more -->

## The problem

There is no Chinese worship music API. There is a website — Stream of Praise (讚美之泉), the largest Chinese-language worship publisher — with a songs page that renders a single WordPress TablePress table. Columns for title (曲名), composer (作曲), lyricist (作詞), album (專輯名稱), album series (專輯系列), musical key (調性), and lyrics (歌詞). That table is the entire upstream catalog surface.

Which gives me four problems, and they compound.

**It is HTML, not a contract.** Column order, header text, and the table's DOM id all sit under someone else's control and can change without notice. A scraper written against it is a scraper that will break.

**There are no timings.** The lyrics column is plain text. Nothing upstream is synchronized to audio, which is why the lyrics pipeline exists at all.

**There are no theme tags.** Worship sets need thematic structure — a praise opener, a worship middle, a commissioning close — and the catalog says nothing about which song fits where. I had to invent that vocabulary and then infer it.

**Traditional and Simplified Chinese both appear** across sources and downstream tools, and the honorific 祢 (the second-person divine "you") is a character that naive conversion and romanization both mangle.

## Breaking it down

- **Extraction.** Fetch the songs page, find `tablepress-3`, map header cells to fields by Chinese keyword, and fail loudly if the table is missing. Done when a site restructure produces an exception instead of an empty catalog.
- **Identity.** Derive a stable ID from song content so a re-scrape is idempotent. Done when scraping the same page twice changes zero IDs, and renaming an album changes zero IDs.
- **Audio provenance.** Find the right recording for a song, and deduplicate identical audio across songs. Done when the same bytes never produce two recordings.
- **Migration.** Move from unstable IDs to stable ones without orphaning any recording. Done when every recording that had a song still has one.
- **Text normalization.** One canonical script, one canonical romanization, no lost honorifics. Done when conversion is idempotent.

## What I built

### Scraping a page, not an API

The scraper fetches the songs page, finds the table by DOM id, and raises if it is absent:

```python file="ops/admin-cli/src/stream_of_worship/admin/services/scraper.py:80-82"
        table = soup.find("table", id="tablepress-3")
        if not table:
            raise ValueError("Table 'tablepress-3' not found - site structure may have changed")
```

Header cells are matched by Chinese keyword lists rather than by column position — `曲名` or `title`, `作詞` or `lyricist`, `專輯系列` or `series`, `調性` or `key` — so a column reorder is survivable and a column rename is not. That asymmetry is on purpose. I'd rather the scraper stop than have it guess which column is the key signature.

Cell text needs one specific fix. Lyrics arrive with `<br>` tags as line separators, and the markup is not always well-formed: some cells contain `<br>…</br>`, a self-closing-ish tag with an explicit closing tag and nothing in between. Naive text extraction drops that line break entirely and silently glues two lyric lines together, which later produces an LRC file with one cue covering two lines. So the parser normalizes `<br>` and the malformed `<br>…</br>` form to a newline before extracting text.

### Identity that survives a re-scrape

My first ID scheme was `<pinyin>_<table_row_number>`. Cheap, and wrong. Row numbers shift when songs are inserted, so a re-scrape after any upstream addition reassigned IDs for a large fraction of the catalog, and every foreign key that used those IDs pointed somewhere new.

The replacement derives the ID from the song's own bibliographic data — pinyin slug, plus the first 8 hex characters of a SHA-256 over the normalized title, composer, and lyricist:

```python file="ops/admin-cli/src/stream_of_worship/admin/services/catalog_edit.py:80-92"
def compute_song_id(title: str, composer: str | None, lyricist: str | None) -> str:
    """Compute the stable content-derived song ID used by the catalog scraper."""

    def _norm(value: str | None) -> str:
        return unicodedata.normalize("NFKC", (value or "").strip())

    slug = re.sub(r"[^a-z0-9_]", "", title_to_pinyin(_norm(title)).lower())
    payload = f"{_norm(title)}|{_norm(composer)}|{_norm(lyricist)}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8]
    song_id = f"{slug}_{digest}"
    if len(song_id) > 100:
        song_id = f"{slug[:91]}_{digest}"
    return song_id
```

There are four decisions packed into those thirteen lines.

**NFKC normalization before hashing**, so a full-width parenthesis or a compatibility ideograph does not produce a different ID for the same title.

**Album is excluded from the hash.** A song can appear on a compilation and on its original album, and the ID should not change when the catalog is re-scraped from a different page. Title, composer, and lyricist are the attributes that actually identify a work.

**The slug is for humans, the digest is for uniqueness.** The slug makes IDs greppable and readable in logs. The digest makes collisions from pinyin homophones impossible. Two songs with the same title and different composers get different IDs; two songs with the same everything share an ID, which is correct, because they are the same song.

**A 100-character cap, with the slug truncated to 91**, so the digest always survives intact. Without the cap, a long Chinese title expands into an unwieldy pinyin slug that breaks URL ergonomics and, in at least one case, a column width assumption.

The pinyin step has one essential pre-processing rule: 祢 and 禰 are rewritten to 你 before romanization. `pypinyin` reads 祢 as "mi", which is a defensible reading in classical contexts and simply wrong here, so every title containing the honorific would otherwise produce a slug nobody could search for. 你 romanizes predictably to "ni", which is what a worship leader actually types.

### Audio: content hash as the primary key

A song is a work; a recording is a set of bytes. The schema separates them, and the recording table's primary key is the SHA-256 of the audio file itself, streamed in 8 KiB chunks so a 40 MB download never has to sit in memory all at once.

Finding the audio is the fuzzy part. The downloader searches YouTube with a suffix constant that encodes the publisher's own naming convention — the official lyrics-video title pattern — scans the top 5 results, and picks the one whose title matches the song after bracket-aware normalization. Brackets matter, because the official titles carry parenthetical annotations and a naive substring match fails on them.

Two guards prevent the obvious mis-downloads:

- A **1.5× length heuristic**. A "song" that runs 1.5 times the length of a comparable track is probably a medley or a full-album upload, and a medley is worse than no audio at all, since its structure is not the song's structure.
- A **420-second duration warning**, above which the operator is told the track is unusually long for the format.

The order of operations is a cost call. Download, hash, deduplicate, upload, then fetch structured lyrics. Hashing before upload means a duplicate never costs a PUT. Deduplicating before the structured-lyrics step means a duplicate never costs an LLM extraction. The duplicate branch deletes the downloaded file and returns a failure that names the collision:

```python
            audio_path.unlink(missing_ok=True)
            return None, f"duplicate hash: shares audio with song '{existing_song_title}'"
```

That message is a design choice of its own. Content-hash duplication usually means the _wrong video was downloaded_ — two different songs resolving to the same YouTube result — so the operator needs to know which song currently owns those bytes in order to fix the search. I made it a hard failure rather than an automatic merge so a human sees it.

Storage layout follows the same hash: a 12-hex-character `hash_prefix` derived from the content hash becomes the object directory, holding `audio.mp3`, `lyrics.lrc`, `stems/*.flac`, and a `{hash_prefix}.json` analysis manifest. LRC backups are capped at 5 per prefix, which is enough to recover from a bad regeneration and not enough to accumulate forever.

### The migration that failed on a foreign key

The stable-ID cutover ran against 685 scraped songs. 581 were active and 104 were duplicate rows — roughly 15.2% of the catalog, a symptom of the same song turning up under multiple albums or with slightly different composer spellings. I soft-deleted the 104 rather than removing them, keeping the earliest-scraped instance as canonical.

The first attempt died with `FOREIGN KEY constraint failed`. The cause was structural, not data: the rename was a single UPDATE, and since two old IDs could legitimately map to the same new ID, the update could transiently create a UNIQUE collision that FK enforcement then blew up on.

The fix was two mechanisms at once.

**Foreign key enforcement was disabled inside the migration transaction**, so the intermediate state — a recording pointing at an ID that no longer existed — was legal for the duration.

**The rename ran in two passes**, routing every old ID through a temporary namespace before landing on the final value: old → `__tmp__<new>` → new. No intermediate state ever collides with an existing row that way, because the temporary namespace is disjoint from both the old and new spaces.

After the migration, 21 recordings had valid song references. The small number is itself informative: audio ingestion had barely started when the ID scheme changed. Had it been 500, the same migration would have been far more dangerous, and I would have needed a verification pass rather than a count.

### Two more normalizations

**Script conversion.** One audio source (zanmei.ai) publishes lyrics in Simplified Chinese; the catalog is Traditional. Conversion runs OpenCC `s2t`, and it needs a sentinel: 祢 converts to 禰 under generic Traditional conversion, which is not the character the catalog uses. A private-use placeholder protects 祢 across the conversion, gets substituted back afterward, and makes the operation idempotent. Conversion is non-blocking, so a song with unconvertible text still ingests, with a warning.

**Key disagreement.** The catalog carries a musical key per song, and the analysis pipeline detects one from audio. They agreed on 75 of 98 recordings — 76.5% — and the disagreements clustered in a non-random way around dominant and subdominant relations, which is the classic failure mode of profile-based key detection on pop-adjacent harmony. Catalog key won for display; detector output is kept as diagnostics. I chose to trust the publisher's metadata over my own model, and at 76.5% agreement that was the right call.

## What broke

**The site structure changed once** and the scraper threw. That's the behaviour I asked for, and it still cost me an afternoon, because "table not found" is indistinguishable from "the page did not load" until you look at the HTML.

**No match in the top 5.** For a handful of songs the official video simply isn't in the first five search results — live versions, lyric-video reuploads, and regional channel variants all compete. The error path wants the operator to supply a URL explicitly, which is the correct escape hatch but a manual step.

**The wrong video caught as a duplicate hash.** A search returned a different song's video for two catalog entries, so the second download hashed to the first one's bytes and failed as a duplicate. Correct failure. The diagnosis needed the error message that names the owning song.

**Simplified/Traditional drift** silently produced lyric text that did not match the audio, which only surfaced when the LRC alignment scored poorly. The sentinel fix came after.

## Evidence

| Measure                                         | Value                            | Where                     |
| ----------------------------------------------- | -------------------------------- | ------------------------- |
| Scraped song rows                               | 685                              | migration handover report |
| Active after dedup                              | 581                              | same                      |
| Soft-deleted duplicate rows                     | 104 (~15.2%)                     | same                      |
| Recordings with a valid song FK after migration | 21                               | same                      |
| Song ID digest                                  | 8 hex chars of SHA-256           | `catalog_edit.py`         |
| Song ID length cap                              | 100 chars (slug truncated to 91) | same                      |
| Audio hash prefix                               | 12 hex chars                     | `hasher.py`               |
| Hash streaming chunk                            | 8 KiB                            | same                      |
| YouTube results scanned                         | top 5                            | `youtube.py`              |
| Medley length heuristic                         | 1.5×                             | same                      |
| Duration warning threshold                      | 420 s                            | same                      |
| LRC backups per prefix                          | 5                                | `r2.py`                   |
| Detector vs catalog key agreement               | 75 / 98 (76.5%)                  | key-accuracy spec         |

## What I'd do differently

1. **Define ID stability before the first scrape.** The pinyin-plus-row-number scheme was one afternoon's work and cost a full migration, a handover report, and a stretch where cached analyses keyed off IDs that no longer resolved. Identity should be the first table design decision, not the third.

2. **Add a scrape-contract test.** A test asserting the header keywords, the table id, and the shape of one parsed row would fail in CI when the upstream page changes, instead of at the start of a batch run. The scraper already fails loudly. It should fail _early_.

3. **Make duplicate audio a review queue, not a command failure.** A duplicate hash is genuinely ambiguous. It means either "you already have this" or "you downloaded the wrong video", and the system can't tell which. Right now it guesses by refusing. A queue with both candidate songs side by side is the honest interface.

4. **Reconcile the two key sources instead of picking one.** A 76.5% agreement rate is not a reason to throw the detector out. A dominant/subdominant disagreement is a _signal_ that the song modulates, or that the section-weighted vote was unstable, and it should surface as a per-song flag instead of vanishing into a diagnostics column.

Source: [scraper.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/services/scraper.py) · [catalog_edit.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/services/catalog_edit.py) · [hasher.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/services/hasher.py) · [youtube.py](https://github.com/mhuang74/stream_of_worship/blob/main/ops/admin-cli/src/stream_of_worship/admin/services/youtube.py)
