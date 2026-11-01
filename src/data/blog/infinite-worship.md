---
title: "Infinite Worship: endless playback after the analysis API disappeared"
author: Michael Huang
pubDatetime: 2026-11-02T00:00:00+08:00
featured: false
draft: false
tags:
  - building
  - infinite-worship
  - music
description: "How I rebuilt the Infinite Jukebox for worship music after the analysis API disappeared — spectral beat clustering, probabilistic jumps, and what still breaks."
---

A worship set has a shape: a list of songs, a start time, and an end. The end is the part nobody designs. The last chorus fades, someone prays, the room moves on. Which is why the interesting question about worship music is not how to make a song longer. It is what happens if a single song never has to end at all.

Infinite Worship is a web app that plays a song as an endless remix by jumping between acoustically similar beats. Upload a track or import one from the Stream of Worship catalog, and it analyzes the audio once, then walks a graph of interchangeable moments for as long as you leave it running. A jump is not a crossfade or a repeated chorus; it is a hard cut to a beat that already sounds like the beat that was about to arrive. The [live app](https://infinite-worship.vercel.app) and the [source](https://github.com/mhuang74/infinite-worship) are both open.

<!-- more -->

## The five rules of infinite playback

An infinite remix is not a longer song, it is a graph walk that stays inside the song's own vocabulary. Almost everything the player does follows from five constraints, plus one optional filter for lyrics:

| Rule                                     | What it prevents                                    | Concrete choice                                                                        |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Beats are the atomic unit                | Cuts mid-word or mid-phrase; time-stretch artifacts | Every jump replaces the next beat; audio is never stretched                            |
| Match the beat you were about to play    | Audible seams                                       | Candidate must match the _next_ beat's cluster, segment position, and measure position |
| Analyze once, jump forever               | Per-listen cost and nondeterminism                  | Analysis cached by SHA-256 of the audio                                                |
| Randomize the path, bound the randomness | Fixed loops and jump spam                           | 15% per beat, ≥8 beats apart, ≥16 beats away                                           |
| Own the edges                            | A song that stops, or lyrics that cut mid-line      | 16-beat fade-out / 8-beat fade-in wrap; 500 ms lyric windows                           |

**Beats are the atomic unit.** The worker hands the player a flat array of beats, one entry each with `start`, `duration`, `cluster`, `segment`, and `jump_candidates`. A jump replaces the beat that was about to play; nothing is stretched, shifted, or layered. The player schedules one beat at a time against the Web Audio clock with a 25 ms timer that keeps 2 seconds queued ahead. A jump is a hard cut into the landing beat. The 2-second lookahead absorbs main-thread stalls; a longer stall makes the player skip forward on the beat grid instead of scheduling audio in the past.

**Match the beat you were about to play.** For beat _i_, the candidate set is built from beats that share the cluster of beat _i+1_, sit at the same position inside their segment (`is`), sit at the same place in the measure (`id % 4`), belong to a different segment, and are not _i+1_. Matching the _next_ beat rather than the current one is the trick: the landing has to be what the ear was already being led into. The client then discards candidates fewer than 16 beats away.

**Analyze once, jump forever.** Analysis takes minutes, so it does not run inside an HTTP request. A job goes to SQS, a container-image Lambda runs librosa and madmom in the background, and the result is cached. Audio and Analysis JSON live in a public-read Cloudflare R2 bucket, metadata lives in Neon Postgres, and the Analysis key is `analysis/<sha256>.json` — so identical audio uploaded by two different people resolves to a single analysis. The browser fetches audio and JSON directly from R2; the backend never proxies those bytes.

**Randomize the path, bound the randomness.** The default jump probability is `0.15` per beat, gated by `beatsSinceLastJump >= 8`, and candidates are weighted toward earlier beats (weight `beats.length - candidateIndex`), with one weighted draw per attempt. A suppressed attempt consumes no draw and leaves the counter running, so unlucky tries cannot starve a song.

**Own the edges.** At the last 16 beats the engine stops advancing and schedules the final 16 beats fading exponentially from 1.0 to 0.0001 while the first 16 beats fade in from 0.0001. The fade-in ramp completes over the first 8 beats, and normal playback resumes at beat 16. The analysis also truncates the beat list at the last beat whose amplitude is at least 75% of the mean beat amplitude, so a long, quiet outro never enters the loop.

That leaves lyrics. For songs with a valid LRC of at least two timestamped lines, an automatic jump must exit and enter near a line boundary: a 500 ms exit window, and an entry window of `max(500 ms, median beat duration)`, where landing is allowed only at or just before a boundary. Instrumental stretches — the intro, a mid-song break, the outro — are exempt and jump freely. The worker trims leading silence before analysis, so beat times sit on a trimmed timeline while LRC timestamps sit on the original recording; the client therefore estimates the offset δ from the decoded buffer (1024-sample frames, 512-sample hop, threshold at global peak minus 60 dB, roughly 23 ms frame accuracy) and compares `beat.start + δ` against the LRC times. The catalog result below exists because of that filter.

## The API that made this possible — and then didn't

The original Infinite Jukebox was a weekend hack. Paul Lamere built it at the 2012 Boston Music Hack Day by uploading a track to The Echo Nest, which returned `beats`, `bars`, `tatums`, `sections`, and `segments`; the app matched each beat to similar-sounding beats and built a graph of paths through the song ([writeup](https://musicmachinery.com/2012/11/12/the-infinite-jukebox/)).

The API underneath it is gone. Spotify [acquired The Echo Nest](https://en.wikipedia.org/wiki/The_Echo_Nest) on 6 March 2014, and the Echo Nest API shut down on 31 May 2016, with developers pointed at the Spotify API. Spotify's Audio Analysis endpoint inherited the same shape of data for existing applications — and then, on [27 November 2024](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api), Spotify stopped new Web API applications from using Audio Analysis and Audio Features at all. Extended-mode apps kept their access. Everyone else was out.

The consequence: the analysis that made the original jukebox a weekend project is now the hard part. You can buy a licensed MIR vendor, you can hope for a gated endpoint, or you can run the DSP yourself. Aggregate Audio Features are not a substitute: "just use tempo and key" answers questions about the whole track, while infinite playback needs a per-beat grid plus a per-beat similarity structure. One off-by-one beat breaks both the schedule and the graph.

I chose to run it in-house: librosa, madmom, and scikit-learn, with Dave Rensin's [Remixatron](https://github.com/drensin/Remixatron) as the reference implementation of Laplacian segmentation, ported into `worker/jukebox` and kept off the request path. That means SQS in front of a container-image Lambda — 10-minute song cap, 3,008 MB, 840 s timeout, maximum concurrency 2, batch size 1 — because librosa's CQT and madmom's RNN are both hungry. A 245 s track measured 114 s of wall time end to end and produced 41 clusters across 576 segments. Failures split into deterministic ones (marked `failed` with a human-readable reason) and transient ones (retry, then dead-letter queue, then an alarm).

## Turning audio into a jump graph

The pipeline is a straight shot from waveform to labeled graph. In order:

1. Load the file as stereo at 44.1 kHz and trim silence from both ends. Analysis then works on a mono copy; the raw stereo samples are kept for playback.
2. Compute a constant-Q transform: 36 bins per octave across 7 octaves, 252 bins total, converted to dB relative to the maximum. Unlike a fixed-width STFT, CQT bins are log-spaced, so the same pitch class lands in the same relative bin in every octave.
3. Detect downbeats with madmom's RNN plus DBN tracker (`beats_per_bar=[3, 4]`, `fps=100`), then beat-synchronize the CQT by taking the median across each beat. Thousands of frames collapse into one 252-dimensional vector per beat.
4. Build the beat-similarity graph with `recurrence_matrix(Csync, width=3, mode="affinity", sym=True)`, which links beats with similar spectra while excluding neighbours inside the same bar. A time-lag median filter of size `(1, 7)` smooths the diagonals, and the matrix is symmetrized.
5. Add a local-sequence term from MFCCs so the graph prefers the actual order of beats, not just spectral coincidence.
6. Combine repetition and sequence into one affinity matrix with a single μ, derived from the two degree vectors so the terms are comparably scaled.
7. Take the normalized graph Laplacian and its eigenvectors. This is the spectral step: beats in the same repetition structure get similar coordinates in the low-frequency eigenvectors. Median-filter the eigenvectors with size `(9, 1)` and cumulative-normalize them.
8. Cluster the normalized eigenvectors with KMeans. The default path tries 48 clusters down to 3 and scores each candidate.
9. A segment is a contiguous run of same-cluster beats, and `is` is a beat's position inside its run. Jump candidates follow the matching rule from the first section. The serialized Analysis is `{filename, segments, duration, tempo, sample_rate}` with per-beat `{start, duration, cluster, segment, jump_candidates}`.

The first half of that pipeline, in code:

```python
# 252-bin constant-Q chromagram: 36 bins/octave × 7 octaves
cqt = librosa.cqt(y=y, sr=sr, bins_per_octave=36, n_bins=7 * 36)
C = librosa.amplitude_to_db(np.abs(cqt), ref=np.max)

# One vector per downbeat: median aggregation, not mean
Csync = librosa.util.sync(C, btz, aggregate=np.median)

# Beat self-similarity; width=3 excludes neighbours in the same bar
R = librosa.segment.recurrence_matrix(
    Csync, width=3, mode="affinity", sym=True
)
R_smoothed = librosa.segment.timelag_filter(
    scipy.ndimage.median_filter
)(R, size=(1, 7))
```

Then the spectral split ([McFee's 2014 paper](http://bmcfee.github.io/papers/ismir2014_spectral.pdf)):

```python
L = scipy.sparse.csgraph.laplacian(A, normed=True)
_, evecs = scipy.linalg.eigh(L)

X = evecs[:, :k] / Cnorm[:, k - 1:k]
labels = sklearn.cluster.KMeans(
    n_clusters=k, max_iter=1000, random_state=0, n_init=1000
).fit_predict(X)
```

The two combination terms and the cluster fitness, as plain text since the site has no math renderer:

```text
A = μ · R_smoothed + (1 − μ) · R_path

R_path[i, i±1] = exp(−‖C_i − C_{i±1}‖² / σ²),  σ = median adjacent-beat distance

cluster_score = n_clusters · silhouette · (segments / clusters) · orphan_scaler
```

The fitness function is the arguable part. Picking the cluster count by silhouette alone does not work: a high cluster count can give every beat an excellent silhouette while leaving no other segment to jump into, which produces a technically clean and deeply boring remix. Too few clusters produce the opposite failure, promiscuous jumps between beats that only vaguely resemble each other. Multiplying by the segments-per-cluster ratio rewards a segmentation that actually has somewhere to go. The orphan scaler multiplies the score by 0.8 when the smallest segment is a single beat, because one-beat segments are a symptom of overfitting rather than precision.

## What the catalog taught me

Then I pointed it at the Stream of Worship catalog. Those recordings arrive with time-synced LRC, so playback could be exercised across a large set of real Chinese worship songs instead of a handful of samples I had picked myself.

The obvious flaw showed up immediately: a jump could leave mid-sentence or land mid-sentence. Even when the audio seam was invisible, the lyric became a fragment, and the remix broke exactly where the words said a thought was still in progress. The lyric-alignment filter fixed that mechanically — jumps now only leave and land near line boundaries, with the 500 ms exit window and the beat-scaled entry window doing the work.

Here is what I did not expect. Transitions decreased significantly. The filter was working exactly as designed: it suppresses attempts whose exit or landing is not clean, so the jump counter drops. But the overall experience did not improve to the level I wanted. Fewer, cleaner transitions still did not make a jump feel musically inevitable. The seam moved from "obviously wrong" to "hard to explain", which is a real improvement in correctness and not much of one in feel.

The problem is worst on slower, deeper worship songs. Sparse arrangements, sustained pads, long lyrical lines, and a narrow beat vocabulary give the graph very few interchangeable beats, so each surviving jump is more exposed — and a hard cut between two spectrally similar but musically different moments is still audible, even when it is lyrically clean.

So infinite playback is partly a fit problem, not only an algorithm problem. It seems to make sense for a subset of the catalog: faster BPM, simpler and more repetitive song structure, a strong groove to hide the cut. On slow ballads and through-composed arrangements it fights the material. Tuning jump probability harder on those songs just produces more bad jumps, slower.

The next step is not a better jump; it is a gate. I want an LLM to read catalog metadata plus the analysis statistics — tempo, duration, cluster and segment counts, the share of beats that have jump candidates, lyric density — and decide whether a song belongs in the infinite-playback set at all. The goal is to stop offering a weak experience on material this method cannot serve, rather than to keep tuning the probability for songs that will never work.

## What still breaks

### Musical

- **The measure assumption.** Jump placement and sequence lengths use `id % 4`. madmom's tracker accepts `beats_per_bar=[3, 4]`, but the jump graph still assumes four beats to the bar, so 3/4 and 6/8 material gets weaker candidates.
- **No key or tempo normalization.** Clusters capture spectral and timbral similarity, not harmonic compatibility. A jump can land in a different key or a different energy level, and because jumps are hard cuts with no crossfade, a bad match is plainly audible. There is no transposition and no tempo matching.
- **Self-similarity is a prerequisite, and it narrows the fit.** Through-composed music with few repeated sections yields few or no jump candidates; playback degenerates into a sequential loop plus the 16-beat wrap. The same limitation hits slow, sparse worship ballads: fewer interchangeable beats, longer lines, sustained textures, every surviving jump more exposed. Infinite playback looks strongest on faster, simpler, more repetitive material.
- **Cluster count is a trade-off, not a solved problem.** Too few clusters produce promiscuous jumps; too many produce high-quality matches with nowhere to jump. The orphan penalty mitigates overfitting without eliminating it.
- **Lyric alignment bought correctness, not enough quality.** On catalog songs, restricting jumps to line boundaries significantly reduced how often transitions happen, but the experience did not improve to the level I wanted, especially on slower, deeper worship songs. A clean cut can still land on a musically unconvincing moment, and the filter only applies when a valid LRC with at least two timestamped lines exists.

### Engineering

- **Analysis is minutes, not milliseconds.** The 10-minute cap, 3,008 MB, 840 s timeout, and 2-concurrent scaling are sized for librosa's CQT plus madmom; the madmom step alone can take up to about two minutes. Cold starts and container size are part of the real cost.
- **The dependency matrix is fragile.** madmom's git HEAD declares `scipy>=1.13` and numpy 2.x, which breaks the pinned `numpy==1.24.3` / `scipy==1.11.3` stack that `librosa==0.10.1` needs. The image installs madmom with `--no-deps` and keeps `setuptools<81` because librosa 0.10.1 still imports `pkg_resources`.
- **Browser scheduling has a floor.** A 2-second lookahead hides main-thread stalls up to 2 seconds; longer stalls skip beats on the grid. Background tabs throttle timers. A per-generation gain node ("epoch") kills already-scheduled audio when the user pauses, seeks, or jumps.
- **Content addressing is not access control.** Audio objects sit at unguessable SHA-256 keys in a public-read bucket. Anyone holding the key can read the object, and identical audio shares one Analysis across users.
- **Analyses are cached by content hash, not by algorithm version.** Changing a DSP parameter does not invalidate existing JSON. To see a change on a song, you have to re-run its analysis.

The project is open source, the [live app](https://infinite-worship.vercel.app) is running, and the next milestone is the song-suitability classifier: an LLM over catalog metadata and analysis statistics that decides which songs belong in the infinite-playback set, instead of tuning jump probability for material the method cannot serve. Better candidate scoring and timbre-aware matching remain open, and I would rather ship the gate than promise the scoring.
