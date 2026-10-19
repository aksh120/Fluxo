# Fluxo Architecture & Technical Specification

This document provides a comprehensive technical breakdown of the architecture, process topology, audio digital signal processing (DSP) pipeline, worker execution pool, and storage design of **Fluxo**.

---

## 1. High-Level System Architecture

Fluxo is architected around a multi-tier, local-first paradigm. It separates low-latency real-time audio playback, heavy computational analysis, persistent database operations, and user interface rendering into dedicated execution contexts to guarantee zero UI thread blocking and sub-millisecond audio clock jitter.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Operating System (Windows)                      │
│     WASAPI Audio Device  │  Local File System  │  Network / YouTube    │
└──────────────▲───────────────────────▲─────────────────────▲───────────┘
               │                       │                     │
               │ Low-Latency Stream    │ ID3 / Binary I/O    │ Progressive Cache
               │                       │                     │
┌──────────────▼───────────────────────▼─────────────────────▼───────────┐
│                          ELECTRON MAIN PROCESS                         │
│  • App Lifecycle, Window Management (Borderless Sleek Glassmorphic)   │
│  • Native Node.js & Better-SQLite3 Database Engine (WAL Mode)          │
│  • File Scanner, Watcher, and Metadata Extractor                       │
│  • Subprocess Execution Controller (Local yt-dlp & Bundled FFmpeg)     │
│  • IPC Hub (Typed Inter-Process Communication Gateway)                 │
└──────────────────────────────────▲─────────────────────────────────────┘
                                   │
              Bidirectional IPC Bridge (Context Isolation Enabled)
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                        ELECTRON RENDERER PROCESS                       │
│  • Modern React 19 Single Page Application                             │
│  • View Routing: Automix, DJ Studio, Party DJ, Mix Creator, YouTube    │
│  • State Architecture: React Hooks & Persistent Preferences            │
│  • Keyboard Shortcuts & Accessibility Focus Manager                    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     WEB AUDIO API GRAPH (32-BIT FLOAT)           │  │
│  │  • AudioContextManager (WASAPI Device & Buffer Size Handler)     │  │
│  │  • DeckEngine A & DeckEngine B (Dual Web Audio Playback Decks)    │  │
│  │  • 3-Band Linkwitz-Riley LR4 Isolators (24 dB/oct Crossovers)    │  │
│  │  • Multi-Style Crossfade Curve Generator & Phase Alignment       │  │
│  │  • 4-Stem Deck Fader Mixer (Vocals, Drums, Bass, Other)          │  │
│  │  • Master Peak Limiter (-0.5 dBFS Ceiling with Lookahead)        │  │
│  │  • Isolated Headphone Audition Preview Deck                      │  │
│  └──────────────────────────────────▲───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
              MessageChannel / Shared Typed Arrays
                                      │
┌─────────────────────────────────────▼──────────────────────────────────┐
│                      MULTI-THREADED WORKER POOL                        │
│  • Worker 1 (Fast Tier): Binary Peak Extraction (.peaks) & Fast RMS   │
│  • Worker 2 (Deep Tier): STFT Spectral Flux, BPM & Downbeat Anchors    │
│  • Worker 3 (Musical Key): 12-Bin HPCP & Camelot Notation Classifier   │
│  • Worker 4 (Stem Separation): Spleeter/Demucs Model Demuxing Engine   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Process Topology & Responsibilities

### 2.1 Electron Main Process (`src/main/`)
The Main Process executes in a native Node.js runtime and serves as the privileged backend:
- **`index.ts`**: Initializes BrowserWindow with frameless styling, registers IPC handlers, monitors system dependencies, and manages application teardown.
- **`db/database.ts`**: Manages an embedded `better-sqlite3` database configured in Write-Ahead Logging (`WAL`) mode with memory-mapped I/O (`mmap_size = 256MB`) and multi-column indexes.
- **`library/`**: Implements recursive filesystem traversal (`DirectoryScanner.ts`) and asynchronous ID3 tag extraction (`MetadataExtractor.ts`).
- **`export/FFmpegEncoder.ts`**: Spawns bundled FFmpeg child processes to encode Float32 PCM audio buffers to 320 kbps MP3, FLAC, or uncompressed WAV.
- **`sources/YouTubeAudioExtractorProvider.ts`**: Subprocess pipeline executing `yt-dlp` and `ffmpeg` for local stream extraction and caching to `%APPDATA%\Fluxo\cache\youtube\`.

### 2.2 Electron Preload Script (`src/preload/index.ts`)
Exposes a strongly typed `window.electronAPI` bridge via `contextBridge.exposeInMainWorld()`. Node integration is disabled in the renderer, and context isolation is strictly enforced.

### 2.3 Electron Renderer Process (`src/renderer/`)
Houses the React 19 presentation layer and the Web Audio real-time DSP graph.
- **`views/`**: Five specialized primary workflows:
  - `AutomixView.tsx`: Clean, intuitive automixing for casual playback.
  - `StudioView.tsx`: Full dual-deck DJ mixing interface with manual pitch bend, cue points, and loop controls.
  - `PartyModeView.tsx`: Fullscreen high-energy DJ mode with dynamic vibe profiles and countdowns.
  - `MixCreatorView.tsx`: Multi-track linear timeline sequencer for creating and editing non-realtime mashups.
  - `YouTubeView.tsx`: Integrated search and offline streaming interface.
- **`audio/`**: Core Web Audio DSP implementations:
  - `AudioContextManager.ts`: Master audio context lifecycle and WASAPI device switching.
  - `DeckEngine.ts`: Dual deck playback, scrubbing, cue points, and sample-accurate loops.
  - `IsolatorEQ.ts`: 3-band 4th-order Linkwitz-Riley isolator equalization.
  - `MasterBus.ts`: Brickwall lookahead peak limiter and audio visualization tap.
  - `PreviewDeck.ts`: Dedicated headphone preview bus.
  - `OfflineMixRenderer.ts`: Fast offline timeline rendering.

---

## 3. Web Audio DSP Routing Architecture

Fluxo's audio signal path processes audio in 32-bit floating point precision at native hardware sampling frequencies ($44.1\text{ kHz}$ or $48\text{ kHz}$).

```
[ Deck A: AudioBufferSourceNode ]            [ Deck B: AudioBufferSourceNode ]
               │                                            │
               ▼                                            ▼
[ Deck A: RubberBand/SoundTouch Stretcher ]   [ Deck B: RubberBand/SoundTouch Stretcher ]
               │                                            │
               ▼                                            ▼
[ Deck A: 3-Band Linkwitz-Riley LR4 EQ ]     [ Deck B: 3-Band Linkwitz-Riley LR4 EQ ]
  ├─ Low Band:  24 dB/oct Lowpass (< 250 Hz)   ├─ Low Band:  24 dB/oct Lowpass (< 250 Hz)
  ├─ Mid Band:  24 dB/oct Bandpass (250-2.5k)  ├─ Mid Band:  24 dB/oct Bandpass (250-2.5k)
  └─ High Band: 24 dB/oct Highpass (> 2.5 kHz) └─ High Band: 24 dB/oct Highpass (> 2.5 kHz)
               │                                            │
               ▼                                            ▼
[ Deck A: Sweepable Resonant Biquad Filter ] [ Deck B: Sweepable Resonant Biquad Filter ]
               │                                            │
               ▼                                            ▼
[ Deck A: Volume & GainNode ]                [ Deck B: Volume & GainNode ]
               │                                            │
               └──────────────────────┬─────────────────────┘
                                      │
                                      ▼
                      [ Stereo Crossfader Gain Stage ]
                                      │
                                      ▼
                      [ Master Bus Summing Node ]
                                      │
                                      ▼
                      [ Master Brickwall Peak Limiter ]
                        • Threshold: -0.5 dBFS
                        • Lookahead Ratio: 20:1
                        • Knee: 0.0 dB (Hard Knee)
                                      │
                                      ▼
                         [ AnalyserNode (Visualizer) ]
                                      │
                                      ▼
                           [ AudioDestinationNode ]
                             (WASAPI Output Device)
```

### 3.1 Linkwitz-Riley 4th-Order (LR4) Isolator EQ Design
To eliminate the phase cancellation and comb-filtering artifacts common to standard bi-quad peaking filters, Fluxo uses cascaded second-order Butterworth filters in series to form a 4th-order Linkwitz-Riley crossover ($24\text{ dB/octave}$ rolloff):
- **Crossover Frequencies**: $f_{L} = 250\text{ Hz}$ (Low/Mid boundary) and $f_{H} = 2500\text{ Hz}$ (Mid/High boundary).
- **In-Phase Summing**: LR4 crossovers exhibit a flat magnitude response ($\pm 0.1\text{ dB}$) when summed at unity gain, with zero phase distortion between adjacent bands.
- **Complete Kill**: Fader attenuation drops to $-\infty\text{ dB}$ at minimum setting, completely isolating frequency bands.

### 3.2 Master Limiter Dynamics
To handle extreme bass overlap during transitions, the master bus routes through a precision lookahead dynamics compressor configured as a brickwall limiter:
- **Ceiling**: $-0.5\text{ dBFS}$ (guarantees zero inter-sample clipping on DAC output).
- **Compression Ratio**: $20:1$.
- **Distortion**: $\text{THD} < 0.05\%$ under standard operating levels, and $< 0.1\%$ under $+12\text{ dBFS}$ synthetic overdrive.

---

## 4. Multi-Tier Analysis Pipeline

Audio analysis is decoupled from the playback thread using a progressive two-tier worker architecture:

### Fast Tier Worker (Immediate Response)
- **Time to Result**: $< 1.0\text{ s}$.
- **Algorithm**: Decimates raw PCM into min/max amplitude envelopes across 256 display buckets.
- **Output**: Binary `.peaks` file cached on disk alongside the audio file.

### Deep Tier Worker (High Precision)
- **Time to Result**: $2 - 5\text{ s}$ (executed in background worker).
- **BPM & Beat-Grid Estimation**:
  1. Computes Short-Time Fourier Transform (STFT) with a 2048-sample Hanning window.
  2. Extracts spectral flux onset detection curve.
  3. Evaluates tempo candidates using autocorrelation across $60 - 180\text{ BPM}$.
  4. Identifies downbeat phase anchors for bar alignment.
- **Harmonic Key Extractor**:
  1. Filters spectrum into 12 Pitch Class Profile (HPCP) chroma bins.
  2. Correlates against major and minor Krumhansl-Schmuckler key templates.
  3. Maps classified tonic to Camelot Wheel notation ($1\text{A} - 12\text{B}$).
- **Loudness Normalization**:
  - Implements ITU-R BS.1770-4 K-weighting filters to calculate integrated LUFS and True Peak.

---

## 5. Database Schema & Indexing

Fluxo embeds `better-sqlite3` running with `journal_mode = WAL` and `synchronous = NORMAL`.

### Core Tables
1. **`tracks`**: Primary table containing track metadata (file path, title, artist, duration, format, bitrate, sample rate, file size, mtime).
2. **`analysis_cache`**: Analysis results (BPM, beat grid offset, Camelot key, integrated LUFS, peak file path).
3. **`cues`**: User-defined hot cue points ($1-8$) and loop coordinates.
4. **`playlists`** & **`playlist_tracks`**: User playlist collections with ordered sequence positions.

### Performance Indexing
- `idx_tracks_artist_title`: Composite index on `(artist, title)` enabling $< 5\text{ ms}$ search queries across $10,000+$ items.
- `idx_tracks_bpm`: Index on `(bpm)` for tempo-filtered track matching.
- `idx_tracks_camelot`: Index on `(camelot_key)` for harmonic compatibility queries.

---

## 6. Music Source Provider Architecture

All audio sources adhere to the unified `IMusicSourceProvider` interface:

```typescript
export interface IMusicSourceProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: {
    canSearch: boolean;
    canStream: boolean;
    canAccessPcmData: boolean;
    canOfflineExport: boolean;
  };
  search(query: string): Promise<SourceSearchResult[]>;
  getStreamUrl(trackId: string): Promise<string>;
  getAudioBuffer(trackId: string): Promise<AudioBuffer>;
  purgeCache?(): Promise<void>;
}
```

- **`LocalFileProvider`**: Direct filesystem access supporting MP3, WAV, FLAC, AAC, OGG, and M4A. Full capabilities (`canOfflineExport = true`).
- **`YouTubeAudioExtractorProvider`**: Subprocess provider utilizing local `yt-dlp` and `ffmpeg` to extract and cache audio streams locally to `%APPDATA%\Fluxo\cache\youtube\`. Full DSP and export parity (`canOfflineExport = true`).

---

## 7. Mix Project File Format (`.fluxo`)

The Mix Creator saves sessions to a portable, human-readable JSON schema:

```json
{
  "version": "1.0.0",
  "name": "Summer Festival Mix",
  "created": "2026-10-19T12:00:00.000Z",
  "bpm": 128.0,
  "tracks": [
    {
      "id": "trk-1",
      "path": "C:\\Music\\TrackA.mp3",
      "title": "Solaris",
      "artist": "Horizon",
      "startTime": 0.0,
      "duration": 180.0,
      "volume": 1.0,
      "eq": { "low": 0.0, "mid": 0.0, "high": 0.0 }
    }
  ],
  "transitions": [
    {
      "fromTrackId": "trk-1",
      "toTrackId": "trk-2",
      "startTime": 164.0,
      "duration": 16.0,
      "style": "bass-swap"
    }
  ]
}
```
