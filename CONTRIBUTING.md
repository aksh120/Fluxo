# Contributing to Fluxo

Thank you for your interest in contributing to **Fluxo**! Fluxo is an open-source, local-first intelligent music crossover application built with Electron, React 19, TypeScript, and the Web Audio API.

We welcome contributions from developers, audio engineers, and UI/UX designers of all skill levels.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **Windows 10 / 11 x64**
- **C++ Build Tools**: Required for native compilation of `better-sqlite3`. On Windows, install the *"Desktop development with C++"* workload via Visual Studio Installer, or run:
  ```powershell
  npm install --global --production windows-build-tools
  ```
- **FFmpeg**: Bundled automatically inside `resources/bin/ffmpeg.exe`, or installed system-wide in `C:\ffmpeg\bin\ffmpeg.exe`.

### 2. Getting the Code
```powershell
# Clone the repository
git clone https://github.com/aksh120/Fluxo.git
cd Fluxo

# Install project dependencies
npm install
```

### 3. Running Locally
```powershell
# Launch Vite development server with Electron live reload
npm run dev
```

---

## 🧪 Testing & Verification

Fluxo maintains a comprehensive automated test suite spanning unit tests, Web Audio mock assertions, database benchmarks, and UI component rendering tests.

```powershell
# Run the complete test suite once
npm test

# Run Vitest in interactive watch mode during active development
npm run test:watch

# Validate TypeScript typing and build production bundles
npm run build
```

### Testing Rules
1. **Never break existing tests**: All test files must pass with zero failures before committing.
2. **Headless Audio Mocks**: Real-time Web Audio API nodes (`AudioContext`, `BiquadFilterNode`, `GainNode`, `DynamicsCompressorNode`, etc.) are polyfilled/mocked in `tests/setup.ts` to allow fast headless execution in Node/JSDOM.
3. **Synthetic Sizing in Stress Tests**: When writing loop stress tests (e.g., testing 100 transitions), use lightweight buffers ($0.05\text{ s}$ or $4410\text{ samples}$) rather than multi-minute audio buffers to prevent CPU starvation and test timeouts.

---

## 📦 Packaging & Building Installers

Packaging configurations are handled by `electron-builder`:

```powershell
# Create an unpacked application directory for rapid local testing
npm run package:dir
# Output: release/win-unpacked/Fluxo.exe

# Generate standalone portable single-file executable
npm run package:portable
# Output: release/Fluxo-1.0.0-portable.exe

# Generate Windows NSIS setup installer
npm run package:nsis
# Output: release/Fluxo Setup 1.0.0.exe
```

---

## 📐 Architecture & Coding Guidelines

### 1. TypeScript Strictness
- Strict type checking is enforced (`"strict": true` in `tsconfig.json`).
- Avoid `any` types whenever possible; use explicit interfaces and type unions.

### 2. Digital Signal Processing (DSP) Principles
- Process all audio buffers using 32-bit floating point precision (`Float32Array`).
- Implement Linkwitz-Riley 4th-order (LR4) crossovers using cascaded second-order Butterworth filters to ensure in-phase flat summing ($\pm 0.1\text{ dB}$).
- Never allocate or garbage-collect large typed arrays inside real-time audio callback loops.
- Always disconnect audio nodes when a deck or track is unloaded to prevent Web Audio memory leaks.

### 3. IPC & Security Boundaries
- The Renderer process must never import `electron`, `fs`, `path`, or `child_process`.
- All inter-process communication must traverse the typed `window.electronAPI` bridge defined in `src/preload/index.ts`.
- Subprocesses (`yt-dlp`, `ffmpeg`) must be spawned with discrete argument arrays (`child_process.spawn`), never through raw shell interpolation strings.

### 4. UI Design & Styling
- Fluxo follows a bespoke glassmorphic dark-mode design system.
- Global CSS tokens and variables are maintained in `src/renderer/index.css`.
- Ensure all interactive elements feature keyboard navigation support, visible focus rings, and proper ARIA accessibility labels.

---

## 📋 Pull Request Workflow

1. Fork the repository and create your feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes adhering to code style and architecture guidelines.
3. Verify all tests pass and the production build compiles cleanly:
   ```bash
   npm test
   npm run build
   ```
4. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat(audio): implement adaptive crossfade curve smoothing"
   ```
5. Push to your fork and submit a Pull Request against `main`.
6. Maintainers will review your PR and provide constructive feedback.
