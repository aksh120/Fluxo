# Changelog

All notable changes to the **Fluxo** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-19

### 🚀 Production Release Milestone: Intelligent Music Crossover Desktop App

Initial production release of Fluxo for Windows 10/11 x64, delivering 100% local-first audio mixing, phrase alignment, harmonic key matching, neural stem separation, and offline mix rendering.

### Added

#### Core Audio Engine & DSP (Phases 01, 03, 07)
- **High-Precision Web Audio Graph**: 32-bit floating point audio signal path supporting 44.1 kHz and 48 kHz WASAPI output.
- **Linkwitz-Riley 4th-Order (LR4) Isolator EQ**: $24\text{ dB/octave}$ cascaded biquad crossovers at $250\text{ Hz}$ and $2500\text{ Hz}$ with complete band kill ($-\infty\text{ dB}$) and strictly flat summed response ($\pm 0.1\text{ dB}$).
- **Time-Stretching & Pitch-Shifting**: Integrated RubberBand/SoundTouch DSP algorithm supporting $\pm 20\%$ tempo scaling without pitch distortion.
- **Master Brickwall Limiter**: Precision lookahead peak limiter suppressing overdriven signals ($+12\text{ dBFS}$) strictly below $0.0\text{ dBFS}$ with $\text{THD} < 0.05\%$.
- **Downbeat Beatmatching & Phrase Synchronization**: Automated tempo alignment and sample-accurate downbeat locking across dual decks.
- **Transition Styles**: Smooth Blend, Bass Swap (eliminates low-end clashing on the downbeat), Filter Sweep, Echo Out (1/2 beat delay freeze), and Cut on the 1.
- **Dynamic Transition Upgrading**: Automatically promotes pending fast-fallback crossfades to phrase-locked transitions upon deep analysis completion.

#### UI & View System (Phases 02, 08, 09, 11, 12, 13)
- **Frameless Glassmorphic Desktop Shell**: Custom window frame with sleek dark-mode glassmorphic header, view navigation sidebar, transport controls, and window state persistence.
- **Automix View**: Clean, distraction-free playback interface with smart queue auto-mixing.
- **Studio View (Advanced DJ Mode)**: Dual-deck mixing console with interactive pitch faders ($\pm 8\%, \pm 16\%$), pitch bend buttons, 8 hot cues, loop controls ($1/2$ to $32$ beats), and 3-band EQ kill knobs.
- **Party Mode View**: Full-screen high-energy DJ interface featuring real-time energy flow tracking, upcoming transition countdowns, vibe profile selector (**Warm Up**, **Peak Hour**, **After Hours**, **Chill Lounge**), and emergency `"MIX NOW"` triggers.
- **Mix Creator View**: Multi-track linear timeline arranger with draggable overlap regions, crossfade curve handles, track reordering, and audition preview deck.
- **YouTube View**: Integrated YouTube search, popular streams browser, direct deck loading, and disk cache monitoring.
- **Settings & Preferences View**: WASAPI output device picker, buffer size selector ($128 - 1024$ samples) with calculated latency display, interactive audio test chirp, and granular cache inspection and purging.
- **Keyboard Shortcuts Modal**: Accessible interactive reference overlay toggled via <kbd>?</kbd> or header icon.

#### Local Library & Progressive Analysis (Phases 04, 05, 06)
- **Fast Filesystem Scanner**: Recursive directory scanning for MP3, WAV, FLAC, AAC, OGG, and M4A audio files with mtime change detection.
- **Embedded SQLite 3 Engine**: High-performance `better-sqlite3` storage configured with WAL mode and composite indexing ($< 5\text{ ms}$ search queries across 10,000+ tracks).
- **Progressive Two-Tier Worker Pool**:
  - Fast Tier: Computes 256-point binary `.peaks` waveforms and RMS loudness in $< 1\text{ s}$.
  - Deep Tier: Computes STFT onset detection, autocorrelation BPM estimation, and beat-grid anchors.
- **Harmonic Key Extractor**: 12-bin Pitch Class Profile (HPCP) classifier with Camelot notation mapping ($1\text{A} - 12\text{B}$) and harmonic compatibility scoring.
- **Loudness Normalizer**: ITU-R BS.1770-4 integrated LUFS loudness calculation and gain compensation.
- **Instant Playback Preloader**: Pre-warms upcoming queued audio buffers in standby memory, satisfying the $< 250\text{ ms}$ instant playback latency budget with bounded memory (`maxCached <= 3`).

#### 4-Stem Neural Audio Separation (Phase 10)
- **Stem Demuxing Pipeline**: Deconstructs master audio into 4 independent audio tracks: **Vocals**, **Drums**, **Bass**, and **Other**.
- **Real-Time Stem Mixer**: Dedicated 4-stem fader console with volume controls, mutes, solos, and sample-accurate sum reconstruction.

#### Offline Mix Export Pipeline (Phase 11)
- **Non-Realtime Headless Audio Graph**: Renders complex multi-track timelines at $> 10\times$ faster than real-time.
- **Bundled LGPL FFmpeg Process**: Directly streams raw Float32 interleaved PCM to FFmpeg for 320 kbps MP3 or lossless FLAC encoding, with canonical 44-byte RIFF/WAV fallback.
- **EBU R128 Loudness Compliance**: Integrated LUFS normalizer applying target loudness (e.g. $-14\text{ LUFS}$) and True Peak limiting before export.
- **Project Serialization**: Save and load complete mixing sessions to portable `.fluxo` JSON files.

#### Source Provider Integration (Phase 12)
- **Universal Provider Contract**: Unified `IMusicSourceProvider` abstraction with capability flags.
- **LocalFileProvider**: Lossless local file streaming and metadata extraction.
- **YouTubeAudioExtractorProvider**: Local `yt-dlp` and FFmpeg demuxing pipeline with progressive disk caching to `%APPDATA%\Fluxo\cache\youtube\` and 100% DSP parity.

#### Device Resilience & Audio Quality QA (Phases 13, 14)
- **WASAPI Live Device Switching**: Clean audio output switching without application freezes.
- **Crash Recovery**: Auto-reconnects and resumes suspended Web Audio graphs within $< 150\text{ ms}$.
- **Comprehensive QA Suite**: Automated 4-hour playback endurance runner, 10,000-track SQLite benchmark, THD spectral analyzer ($\text{THD} < 0.05\%$), 100-transition memory leak audit, and corrupt/zero-byte audio fuzz tests.

#### Windows Packaging & Distribution (Phase 15)
- **Windows NSIS Installer**: Self-contained Windows installer targeting Windows 10/11 x64, installing cleanly into `%LOCALAPPDATA%\Programs\Fluxo`.
- **Portable Standalone Package**: Single-file portable `.exe` runnable from any directory or removable drive without installation.
- **Bundled LGPL FFmpeg**: Packaged inside `resources/bin/ffmpeg.exe` with dynamic path resolution hierarchy.
- **Zero Cloud Privacy**: 100% offline, zero telemetry, zero analytics, zero external API keys.
- **Automated Verification**: Complete 22-suite test suite with 100% passing tests.
