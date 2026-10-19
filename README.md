# Fluxo 🎧
### Intelligent Music Crossover Desktop Application for Windows

[![Windows 10/11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20x64-0078D6?style=flat-square&logo=windows)](https://microsoft.com/windows)
[![Local First](https://img.shields.io/badge/Architecture-100%25%20Local--First-22C55E?style=flat-square)](SECURITY.md)
[![Zero Telemetry](https://img.shields.io/badge/Privacy-Zero%20Telemetry%20%7C%20Zero%20Cloud-0EA5E9?style=flat-square)](SECURITY.md)
[![Tests Passing](https://img.shields.io/badge/Tests-133%20Passing-success?style=flat-square)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

**Fluxo** is an intelligent, local-first Windows desktop music crossover application. Designed for bedroom DJs, party hosts, and music enthusiasts, Fluxo bridges the gap between passive playlist playback and live DJ mixing by automating beatmatching, harmonic key detection, 3-band Linkwitz-Riley isolator equalization, phrase-locked transitions, and real-time stem isolation—completely offline without cloud dependencies, subscriptions, or telemetry.

---

## 🌟 Key Features

### 🎛️ Dual-Deck Real-Time Audio Engine
- **32-Bit Floating Point Pipeline**: High-fidelity Web Audio API graph running at native WASAPI sample rates (44.1 kHz / 48 kHz).
- **3-Band Linkwitz-Riley Isolator EQ**: $24\text{ dB/octave}$ fourth-order (LR4) crossovers at $250\text{ Hz}$ and $2500\text{ Hz}$ with complete band kill ($-\infty\text{ dB}$) and strictly flat summed response ($\pm 0.1\text{ dB}$).
- **Time-Stretching & Pitch-Shifting**: High-quality DSP algorithm supporting $\pm 20\%$ tempo adjustment without pitch alteration or audible comb filtering.
- **Master Brickwall Peak Limiter**: Lookahead dynamic compressor ceiling at $-0.5\text{ dBFS}$ suppressing overdriven signals ($+12\text{ dBFS}$) strictly below $0.0\text{ dBFS}$ with $\text{THD} < 0.05\%$.
- **Instant Playback Budget**: Warm track playback trigger latency $< 250\text{ ms}$ backed by an intelligent background preloading cache.

### 🧠 Progressive Multi-Tier Analysis Pipeline
- **Fast Tier (Waveform & RMS)**: Generates 256-point binary peak files (`.peaks`) and fast RMS loudness within $< 1\text{ s}$ of track load.
- **Deep Tier (BPM & Downbeats)**: Spectral flux onset detection, autocorrelation tempo estimation ($> 90\%$ accuracy on 4/4 music), and beat-grid anchor tracking.
- **Harmonic Key Matching**: 12-bin Pitch Class Profile (HPCP) mapped to Camelot Wheel notation ($1\text{A} - 12\text{B}$) with harmonic compatibility scoring (relative major/minor, subdominant, dominant).
- **EBU R128 Loudness**: ITU-R BS.1770 integrated LUFS loudness measurement and gain compensation.
- **Persistent SQLite 3 Cache**: Indexed local SQLite storage with WAL mode, instantly invalidating modified audio files.

### 🤖 Autonomous Party DJ & Energy Flow
- **Curated Vibe Profiles**: Real-time energy curve profiles (**Warm Up**, **Peak Hour**, **After Hours**, **Chill Lounge**).
- **Dynamic Transition Scheduling**: Analyzes track phrasing to trigger transitions on musical bars ($8$, $16$, or $32$ bars) or during breakdowns.
- **Transition Styles**:
  - **Smooth Blend**: Equal-power crossfade with tempo ramp synchronization.
  - **Bass Swap**: Swaps low frequencies precisely on the downbeat to eliminate low-end phase clashing.
  - **Filter Sweep**: Resonant high-pass / low-pass filter sweeps across incoming and outgoing decks.
  - **Echo Out**: 1/2 beat delay freeze and feedback decay.
  - **Cut on the 1**: Instant drop on the downbeat for high-energy genre switches.
- **Emergency Controls**: Instant `"MIX NOW"` transition trigger with dynamic transition upgrade support.

### 🧬 4-Stem Neural Audio Separation
- **Offline Demixing**: Separates local or extracted audio into 4 discrete audio stems: **Vocals**, **Drums**, **Bass**, and **Other**.
- **Stem Mixer Deck**: Dedicated real-time deck faders for independent stem volume control, mute, and soloing.
- **Zero Phase Distortion**: Reconstructed stem sum achieves exact sample-level alignment with original master audio.

### 🎼 Mix Creator & Offline Audio Rendering
- **Multi-Track Timeline**: Linear drag-and-drop arranger showing track blocks, draggable transition overlap regions, and crossfade curve handles.
- **Project Persistence**: Saves and loads full mixing sessions in portable `.fluxo` JSON format.
- **Audition Preview Deck**: Headphone-routed preview engine that auditions scheduled transitions without disturbing master output.
- **$> 10\times$ Real-Time Rendering**: Non-realtime offline audio rendering engine processing multi-track timeline automation curves sample-accurately.
- **Bundled LGPL FFmpeg**: Encodes rendered PCM directly to 320 kbps MP3, lossless FLAC, or uncompressed 16-bit WAV with ITU-R BS.1770 LUFS normalization (e.g. $-14\text{ LUFS}$ target).

### 🌐 YouTube Audio Extraction Parity
- **Local Stream Demuxing**: High-performance extraction engine using local `yt-dlp` and FFmpeg.
- **Progressive Stream Buffering**: Fast playback start with simultaneous disk caching to `%APPDATA%\Fluxo\cache\youtube\`.
- **100% DSP Parity**: Extracted tracks undergo the exact same analysis, beatmatching, 3-band isolator EQ, stem demixing, and offline export as local lossless files.

### 🛡️ Hardware Device Management & Resilience
- **WASAPI Audio Device Switching**: Live output device selection and hotplug handling without audio freeze.
- **Configurable Buffer Latency**: Adjustable audio buffer sizes ($128$, $256$, $512$, $1024$ samples) with calculated latency display.
- **Crash Recovery**: Auto-reconnects and resumes audio graph within $< 150\text{ ms}$ upon hardware interruptions or buffer underruns.

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | Play / Pause | Toggles master playback on active deck |
| <kbd>Shift</kbd> + <kbd>→</kbd> | Mix Next Now | Forces immediate phrase-aligned transition to next queued track |
| <kbd>1</kbd> – <kbd>8</kbd> | Hot Cues 1–8 | Jumps playback to set cue point on active deck |
| <kbd>L</kbd> | Toggle Loop | Enables / disables active 4-beat or 8-beat loop |
| <kbd>M</kbd> | Mute Active Deck | Toggles master mute on currently playing deck |
| <kbd>S</kbd> | Solo Vocal Stem | Isolates vocal stem in 4-stem mixer |
| <kbd>?</kbd> | Keyboard Shortcuts | Opens interactive keyboard shortcuts reference modal |
| <kbd>Tab</kbd> | Cycle Focus | Advances keyboard navigation through interface controls |
| <kbd>Esc</kbd> | Dismiss / Close | Closes open modals, overlays, or settings screens |

---

## 🚀 Installation & Distribution

### Option 1: Windows NSIS Installer (Recommended)
1. Download `Fluxo-Setup-1.0.0.exe` from the latest release.
2. Run the installer. By default, Fluxo installs into `%LOCALAPPDATA%\Programs\Fluxo\` without requiring administrator privileges.
3. Launch Fluxo from your Start Menu or Desktop shortcut.

### Option 2: Portable Standalone Executable
1. Download `Fluxo-1.0.0-portable.exe`.
2. Move the `.exe` to any folder or USB drive.
3. Run directly—all caches and database files are created locally under standard user data directories.

---

## 💻 Developer Quickstart

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **Windows 10 / 11 x64** (Visual Studio C++ build tools required for `better-sqlite3` native compilation)
- **FFmpeg**: Bundled automatically inside `resources/bin/ffmpeg.exe`, or installed system-wide in `C:\ffmpeg\bin\ffmpeg.exe`.

### Setup Instructions
```powershell
# 1. Clone repository
git clone https://github.com/aksh120/Fluxo.git
cd Fluxo

# 2. Install dependencies
npm install

# 3. Start development server with live Electron reload
npm run dev

# 4. Run automated test suite (133 tests)
npm test

# 5. Build production bundle
npm run build

# 6. Package Windows distribution artifacts
npm run package:dir      # Unpacked directory for local testing
npm run package:portable # Standalone portable single .exe
npm run package:nsis     # Setup installer
```

---

## 📊 Technical Architecture & Audio Specifications

```
                     ┌───────────────────────────────────────────────┐
                     │               Electron Main Process           │
                     │  • SQLite3 Database (WAL Mode)                │
                     │  • Local File Scanner & ID3 Tag Parser        │
                     │  • Local yt-dlp & FFmpeg Demuxer Subprocess   │
                     └──────────────────────┬────────────────────────┘
                                            │ Typed IPC Channel
                     ┌──────────────────────┴────────────────────────┐
                     │              Electron Renderer Process        │
                     │  • React 19 UI / Custom Sleek Glassmorphism   │
                     │  • Web Audio API Graph (32-bit Float)         │
                     │  • Dual Deck Engines (Deck A & Deck B)        │
                     │  • Master Bus Limiter (-0.5 dBFS ceiling)     │
                     └──────────────────────┬────────────────────────┘
                                            │ SharedArrayBuffer / IPC
                     ┌──────────────────────┴────────────────────────┐
                     │           Multi-Worker Background Pool        │
                     │  • Fast Tier: Waveform Peak Generator         │
                     │  • Deep Tier: STFT Onset & Autocorrelation    │
                     │  • Key Extractor: 12-Bin HPCP & Camelot Wheel │
                     │  • Stem Demuxing: Neural 4-Stem Spleeter/Demucs│
                     └───────────────────────────────────────────────┘
```

### Audio Performance Metrics
- **Total Harmonic Distortion (THD)**: $< 0.05\%$ at $1\text{ kHz}$ reference tone.
- **Linkwitz-Riley 4th Order EQ**: Frequency sum flatness within $\pm 0.1\text{ dB}$ across $20\text{ Hz} - 20\text{ kHz}$.
- **Brickwall Peak Limiter**: Strictly prevents clipping ($< 0.0\text{ dBFS}$) under $+12\text{ dBFS}$ overdrive.
- **Instant Playback Latency**: $< 250\text{ ms}$ on warm/preloaded buffers.
- **Library Indexing Benchmark**: $< 5\text{ ms}$ search queries across $10,000+$ indexed tracks with $< 150\text{ MB}$ RAM footprint.

---

## 🔒 Security & Privacy

Fluxo adheres to strict local-first privacy standards:
- **Zero Telemetry**: No tracking, phone-home requests, or remote metrics.
- **No Remote Credentials**: Operates without requiring account sign-ins or cloud API keys.
- **Sandboxed Subprocess Execution**: External binaries (`yt-dlp`, `ffmpeg`) are spawned with strictly validated, non-shell command arrays preventing parameter injection.

For details, review our full [Security Policy](SECURITY.md).

---

## 📜 Milestone & Verification Status

| Phase | Milestone Description | Status | Verification Evidence |
| :---: | :--- | :---: | :--- |
| **01** | Core Workspace & Audio Test Fixtures | `COMPLETED` | Verified in `tests/smoke.test.ts` & `tests/audio.test.ts` |
| **02** | Design System & Desktop Shell | `COMPLETED` | Verified in `tests/layout.test.tsx` & `tests/components.test.tsx` |
| **03** | Dual-Deck Audio Engine & Web Audio Core | `COMPLETED` | Verified in `tests/audio.test.ts` |
| **04** | Local File Scanner, Tag Parser & SQLite | `COMPLETED` | Verified in `tests/database.test.ts` & `tests/metadata.test.ts` |
| **05** | Progressive Streaming & Preloading | `COMPLETED` | Verified in `tests/latency.test.ts` & `tests/workers.test.ts` |
| **06** | Audio Analysis, BPM, Key & Energy | `COMPLETED` | Verified in `tests/analysis.test.ts` |
| **07** | Live Mixing & Intelligent Transitions | `COMPLETED` | Verified in `tests/transitions.test.ts` |
| **08** | Dual Mode (Beginner Automix & DJ Studio) | `COMPLETED` | Verified in `tests/studio.test.tsx` |
| **09** | Autonomous Party DJ & Energy Flow | `COMPLETED` | Verified in `tests/party.test.tsx` |
| **10** | 4-Stem Audio Separation & Stem Mixer | `COMPLETED` | Verified in `tests/stems.test.tsx` |
| **11** | Mix Creator Timeline & Offline Export | `COMPLETED` | Verified in `tests/mix_creator_export.test.tsx` |
| **12** | YouTube Audio Extraction Engine Parity | `COMPLETED` | Verified in `tests/youtube_source.test.tsx` |
| **13** | Device Management, Settings & Recovery | `COMPLETED` | Verified in `tests/device_settings_recovery.test.tsx` |
| **14** | Performance Optimization & Quality QA | `COMPLETED` | Verified in `tests/performance_quality_qa.test.tsx` |
| **15** | Packaging, Distribution & Documentation | `COMPLETED` | Verified in `tests/packaging_acceptance.test.ts` |

---

## 📄 License & Attribution

Fluxo is licensed under the **[MIT License](LICENSE)**.
The bundled FFmpeg binary is licensed under the **[GNU LGPL v2.1](resources/bin/LICENSE-LGPL.txt)**.
All audio processing algorithms and UI components are open-source and free for personal and commercial usage.
