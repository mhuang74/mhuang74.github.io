# Design Document: Lyrics-Based Song Transition Optimization

**Version:** 1.0
**Date:** 2025-11-17
**Status:** Draft

## 1. Overview

### 1.1 Problem Statement

The current song transition system uses spectral clustering of audio properties and note connectivity to identify transition candidates between songs. While this approach works well in most cases, it occasionally produces transitions that occur mid-verse, resulting in jarring musical breaks that interrupt the lyrical flow and diminish the listening experience.

### 1.2 Objectives

- Integrate lyrics analysis into the song transition candidate selection process
- Ensure transitions occur at natural verse boundaries (between verses, choruses, bridges, etc.)
- Maintain the quality of audio-based transitions while adding lyrical awareness
- Provide a scalable solution that works with user-uploaded songs

## 2. Current System

### 2.1 Existing Transition Logic

The current system identifies transition candidates using:
- **Spectral clustering**: Analysis of audio frequency spectrum to find similar acoustic moments
- **Note connectivity**: Harmonic and melodic relationship analysis between song sections

### 2.2 Limitations

- No awareness of lyrical content or structure
- Transitions can occur mid-verse, mid-sentence, or mid-phrase
- No semantic understanding of song structure (verse, chorus, bridge)

## 3. Proposed Solution

### 3.1 High-Level Approach

Enhance the transition candidate selection by:
1. Acquiring synchronized lyrics for uploaded songs
2. Identifying verse boundaries and song structure
3. Constraining transition candidates to verse boundaries
4. Combining audio-based scores with lyrical boundary weights

### 3.2 Architecture Overview

```
┌─────────────────┐
│  Song Upload    │
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
┌────────────┐  ┌──────────────┐  ┌──────────┐
│   Audio    │  │   Lyrics     │  │ Metadata │
│ Processing │  │ Acquisition  │  │Extraction│
└─────┬──────┘  └──────┬───────┘  └────┬─────┘
      │                │                │
      │                ▼                │
      │         ┌──────────────┐        │
      │         │   Lyrics     │        │
      │         │  Processing  │        │
      │         └──────┬───────┘        │
      │                │                │
      │                ▼                │
      │         ┌──────────────┐        │
      │         │   Verse      │        │
      │         │  Boundary    │        │
      │         │  Detection   │        │
      │         └──────┬───────┘        │
      │                │                │
      └────────────────┴────────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Transition         │
            │  Candidate          │
            │  Generation         │
            │  (Audio + Lyrics)   │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Transition         │
            │  Ranking & Filter   │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Final Transition   │
            │  Candidates         │
            └─────────────────────┘
```

## 4. Lyrics Data Acquisition

### 4.1 Data Sources

Multiple approaches for obtaining lyrics:

#### Option A: Third-Party Lyrics APIs
**Pros:**
- Large database coverage
- Professional transcription quality
- Timestamped/synchronized lyrics available
- Minimal processing required

**Cons:**
- API costs and rate limits
- Dependency on external services
- Potential licensing considerations
- May not have all songs

**Recommended Services:**
- Musixmatch API (timestamps, translations)
- Genius API (annotations, less timestamp data)
- LyricFind API (licensed, commercial)

#### Option B: Speech-to-Text (STT)
**Pros:**
- Works with any uploaded audio
- No external dependencies
- Complete control over data

**Cons:**
- Lower accuracy (especially with background music)
- Computationally expensive
- No inherent timestamps
- May struggle with vocal effects, multiple voices

**Recommended Services:**
- OpenAI Whisper (open source, good accuracy)
- Google Cloud Speech-to-Text
- Assembly AI (music-optimized)

#### Option C: Hybrid Approach (Recommended)
1. Attempt API lookup using audio fingerprinting (AcoustID, Chromaprint)
2. Fall back to STT if API fails or no match found
3. Allow manual lyrics upload as override option

### 4.2 Metadata Matching

To match uploaded songs with lyrics databases:

```
Audio File → Audio Fingerprinting → Search Lyrics DB
     ↓                                      ↓
  ID3 Tags  →  Artist/Title Match  → Validate Match
     ↓                                      ↓
  Manual    →    User Input         → Store Association
```

**Fingerprinting Libraries:**
- Chromaprint/AcoustID (open source)
- Echoprint (open source)
- ACRCloud (commercial)

### 4.3 Data Storage Schema

```json
{
  "song_id": "unique-song-identifier",
  "audio_file": "path/to/audio.mp3",
  "metadata": {
    "title": "Song Title",
    "artist": "Artist Name",
    "duration": 245.5
  },
  "lyrics": {
    "source": "musixmatch|whisper|manual",
    "language": "en",
    "synchronized": true,
    "lines": [
      {
        "start_time": 12.5,
        "end_time": 15.2,
        "text": "First line of lyrics",
        "section": "verse_1"
      },
      {
        "start_time": 15.3,
        "end_time": 18.1,
        "text": "Second line of lyrics",
        "section": "verse_1"
      }
    ],
    "structure": [
      {
        "type": "intro",
        "start_time": 0.0,
        "end_time": 12.4
      },
      {
        "type": "verse",
        "label": "verse_1",
        "start_time": 12.5,
        "end_time": 32.8
      },
      {
        "type": "chorus",
        "label": "chorus_1",
        "start_time": 32.9,
        "end_time": 52.1
      }
    ]
  }
}
```

## 5. Lyrics Processing and Analysis

### 5.1 Timestamp Alignment

If lyrics lack precise timestamps:

1. **Forced Alignment**: Use audio-to-text alignment tools
   - Montreal Forced Aligner
   - Gentle (Kaldi-based)
   - aeneas (Python library)

2. **Beat-Based Estimation**:
   - Detect beats using audio analysis
   - Estimate line timing based on syllable count and beat positions
   - Refine with onset detection

### 5.2 Song Structure Detection

Identify song sections through multiple approaches:

#### Approach 1: Pattern Recognition
- Detect repeating lyrical patterns (chorus identification)
- Identify section markers ("Verse 2", "[Chorus]") if present
- Analyze rhyme schemes and line structures

#### Approach 2: Audio Segmentation
- Use existing spectral clustering to identify similar sections
- Correlate with lyrical repetition
- Combine audio features with text similarity

#### Approach 3: Machine Learning
- Train classifier on labeled song structures
- Features: lyrical repetition, audio similarity, duration patterns
- Output: verse, chorus, bridge, intro, outro labels

### 5.3 Verse Boundary Identification

**Verse boundaries** are defined as:
- Transitions between major sections (verse → chorus, chorus → verse)
- Instrumental breaks between vocal sections
- Clear lyrical phrase endings

**Boundary markers:**
- Section type changes
- Silent gaps (>500ms)
- Instrumental interludes
- End of repeated patterns

## 6. Integration with Transition System

### 6.1 Enhanced Candidate Selection

Modify the transition candidate algorithm:

```python
# Pseudocode
def generate_transition_candidates(song_a, song_b):
    # Existing: Audio-based candidates
    audio_candidates = spectral_clustering_analysis(song_a, song_b)
    note_candidates = note_connectivity_analysis(song_a, song_b)

    # New: Lyrics-based filtering
    verse_boundaries_a = get_verse_boundaries(song_a.lyrics)
    verse_boundaries_b = get_verse_boundaries(song_b.lyrics)

    # Combine and filter
    candidates = []
    for audio_candidate in audio_candidates:
        # Find nearest verse boundaries
        boundary_a = find_nearest_boundary(
            audio_candidate.time_a,
            verse_boundaries_a,
            max_distance=2.0  # seconds
        )
        boundary_b = find_nearest_boundary(
            audio_candidate.time_b,
            verse_boundaries_b,
            max_distance=2.0
        )

        if boundary_a and boundary_b:
            # Calculate combined score
            score = calculate_combined_score(
                audio_score=audio_candidate.score,
                note_score=note_candidate.score,
                boundary_quality_a=boundary_a.quality,
                boundary_quality_b=boundary_b.quality,
                time_adjustment=abs(audio_candidate.time_a - boundary_a.time)
            )

            candidates.append(TransitionCandidate(
                song_a=song_a,
                song_b=song_b,
                time_a=boundary_a.time,
                time_b=boundary_b.time,
                score=score,
                transition_type=f"{boundary_a.type}_to_{boundary_b.type}"
            ))

    return sorted(candidates, key=lambda x: x.score, reverse=True)
```

### 6.2 Scoring Model

**Combined score calculation:**

```
final_score = (w1 × audio_score) +
              (w2 × note_score) +
              (w3 × boundary_score) -
              (w4 × time_penalty)

where:
  audio_score: Spectral similarity (0-1)
  note_score: Note connectivity quality (0-1)
  boundary_score: Verse boundary quality (0-1)
  time_penalty: Distance from ideal audio transition point

  w1, w2, w3, w4: Tunable weights (sum to 1.0)
```

**Boundary quality factors:**
- Section type compatibility (verse→verse: high, verse→middle of chorus: low)
- Lyrical phrase completion
- Silence/instrumental gap presence
- Energy level matching

### 6.3 Fallback Behavior

When lyrics are unavailable:
1. Continue using audio-based transition selection
2. Apply conservative filtering (prefer transitions at detected silent moments)
3. Flag transition as "unverified" for potential manual review

## 7. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Design and implement lyrics data schema
- [ ] Set up lyrics storage (database/file system)
- [ ] Integrate one lyrics API (recommend Musixmatch)
- [ ] Implement basic metadata matching

### Phase 2: Processing Pipeline (Weeks 3-4)
- [ ] Implement timestamp alignment (if needed)
- [ ] Build basic verse boundary detection
- [ ] Create song structure analyzer
- [ ] Test with sample song collection

### Phase 3: Integration (Weeks 5-6)
- [ ] Modify transition candidate generation
- [ ] Implement combined scoring model
- [ ] Add lyrics-based filtering logic
- [ ] Tune weights and parameters

### Phase 4: Enhancement (Weeks 7-8)
- [ ] Add STT fallback for unmatched songs
- [ ] Implement ML-based structure detection
- [ ] Build manual lyrics upload interface
- [ ] Add caching and optimization

### Phase 5: Testing & Refinement (Weeks 9-10)
- [ ] A/B testing with and without lyrics
- [ ] User feedback collection
- [ ] Parameter tuning
- [ ] Performance optimization

## 8. Technical Considerations

### 8.1 Performance

- **Caching**: Store processed lyrics and verse boundaries
- **Async processing**: Process lyrics in background during upload
- **Lazy loading**: Only process when transition generation is needed
- **Indexing**: Index verse boundaries for fast lookup

### 8.2 Accuracy Challenges

- **Multi-language songs**: May need language detection and specialized processing
- **Instrumental sections**: Handle songs with extended instrumental breaks
- **Live recordings**: May have variations from studio lyrics
- **Covers and remixes**: Different arrangements of same lyrics
- **Ad-libs and variations**: Performed lyrics may differ from written lyrics

### 8.3 Privacy and Licensing

- **API licensing**: Ensure compliance with lyrics API terms of service
- **User data**: Don't store or share copyrighted lyrics beyond internal use
- **Attribution**: Properly attribute lyrics sources
- **Fair use**: Processing for transition analysis likely qualifies as transformative use

### 8.4 Scalability

- **API rate limits**: Implement queuing and retry logic
- **Storage**: Plan for lyrics storage scaling (compressed text, deduplication)
- **Processing time**: Balance accuracy vs. speed for user experience
- **Cost**: Monitor API costs, consider tiered approach based on usage

## 9. Success Metrics

### 9.1 Quantitative Metrics
- **Mid-verse transition rate**: % of transitions occurring mid-verse (target: <5%)
- **Boundary alignment accuracy**: % of transitions within 1s of verse boundary (target: >90%)
- **Lyrics match rate**: % of songs with successfully acquired lyrics (target: >80%)
- **Processing time**: Time to process lyrics per song (target: <30s)

### 9.2 Qualitative Metrics
- User satisfaction with transition quality
- A/B test preference (lyrics-aware vs. audio-only)
- Manual override frequency
- Bug reports related to awkward transitions

## 10. Future Enhancements

### 10.1 Advanced Features
- **Semantic matching**: Transition between songs with thematically similar lyrics
- **Mood analysis**: Match emotional tone between transition points
- **Language mixing**: Intelligent transitions for multi-language playlists
- **Dynamic adjustment**: Learn from user skip/replay behavior

### 10.2 User Features
- **Transition preview**: Let users preview transitions before committing
- **Manual boundary marking**: Allow users to mark preferred transition points
- **Lyrics display**: Show synchronized lyrics during playback
- **Structure visualization**: Display song structure graphically

## 11. Alternative Approaches Considered

### 11.1 Audio-Only Enhancement
**Approach**: Improve audio analysis to detect vocal vs. instrumental sections
**Pros**: No external dependencies, works for all audio
**Cons**: Can't prevent mid-sentence transitions, lower accuracy
**Decision**: Rejected - doesn't solve the core problem

### 11.2 Beat-Only Boundaries
**Approach**: Constrain transitions to strong beat positions only
**Pros**: Simple, works without lyrics
**Cons**: Beats don't align with lyrical phrases, still allows mid-verse transitions
**Decision**: Could be used as additional constraint, not primary solution

### 11.3 Manual Boundary Marking
**Approach**: Require users to manually mark transition points
**Pros**: Perfect accuracy when done correctly
**Cons**: Poor user experience, doesn't scale, many users won't do it
**Decision**: Offer as optional enhancement, not primary solution

## 12. Open Questions

1. **Weight tuning**: What's the optimal balance between audio quality and boundary alignment?
2. **Boundary tolerance**: How far can we drift from ideal audio transition for better lyrical alignment?
3. **Section preferences**: Are some transitions better than others (e.g., chorus→verse vs. verse→chorus)?
4. **Instrumental handling**: How to handle songs with extensive instrumental sections?
5. **Real-time requirements**: Can lyrics processing happen in real-time or must it be pre-processed?

## 13. References and Resources

### APIs and Services
- Musixmatch API: https://developer.musixmatch.com/
- Genius API: https://docs.genius.com/
- AcoustID: https://acoustid.org/
- OpenAI Whisper: https://github.com/openai/whisper

### Libraries and Tools
- librosa: Audio analysis (Python)
- pydub: Audio manipulation (Python)
- Montreal Forced Aligner: https://montreal-forced-aligner.readthedocs.io/
- aeneas: Audio/text alignment (Python)

### Research Papers
- "Audio-to-Score Alignment using Spectral Clustering"
- "Automatic Song Structure Analysis"
- "Lyrics-Informed Music Recommendation"

---

## Appendix A: Example Workflow

```
User uploads "song.mp3"
    ↓
Extract metadata (title, artist) from ID3 tags
    ↓
Generate audio fingerprint (Chromaprint)
    ↓
Query Musixmatch API with fingerprint + metadata
    ↓
If match found:
    - Download synchronized lyrics
    - Parse into lines with timestamps
    Else:
    - Run Whisper STT on audio
    - Estimate line boundaries
    ↓
Analyze song structure:
    - Detect repeating sections (chorus)
    - Identify verse patterns
    - Mark transitions between sections
    ↓
Generate verse boundary list with timestamps
    ↓
Store in database linked to song_id
    ↓
When generating transitions:
    - Run existing audio analysis
    - Filter candidates to verse boundaries
    - Rank by combined score
    - Return top N candidates
```

## Appendix B: Configuration Parameters

```yaml
lyrics_config:
  # Data acquisition
  primary_source: "musixmatch"  # musixmatch, genius, whisper
  fallback_source: "whisper"
  enable_manual_upload: true

  # Processing
  forced_alignment_enabled: true
  structure_detection_method: "hybrid"  # pattern, audio, ml, hybrid

  # Transition generation
  max_boundary_distance: 2.0  # seconds
  weights:
    audio_score: 0.40
    note_score: 0.30
    boundary_score: 0.25
    time_penalty: 0.05

  # Performance
  cache_enabled: true
  cache_ttl: 86400  # 24 hours
  async_processing: true

  # Quality
  min_lyrics_confidence: 0.7
  prefer_synchronized_lyrics: true
```
