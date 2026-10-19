# Security Policy & Local-First Privacy Guarantees

The Fluxo project adheres to rigorous local-first engineering principles. We believe audio mixing, playlist management, and music creation are personal activities that should never be monitored, monetized, or transmitted to remote servers.

---

## 1. Core Privacy & Architecture Guarantees

### 1.1 Zero Telemetry Policy
- **No Analytics**: Fluxo contains zero telemetry hooks, tracking beacons, error-reporting daemons (e.g., Sentry, Bugsnag), or usage metric trackers.
- **No Cloud Accounts**: Fluxo requires no registration, sign-in, OAuth tokens, or remote API keys.
- **Offline Integrity**: Fluxo functions with 100% feature parity on air-gapped computers disconnected from the internet (with the natural exception of live YouTube audio queries).

### 1.2 Local Persistence Boundaries
- All track metadata, analysis caches, beat grids, Camelot keys, and playlists are stored exclusively on your local storage drive in an embedded SQLite database (`%APPDATA%\Fluxo\fluxo.db` or application directory).
- Raw audio files are never modified, overwritten, or uploaded. Caches (`.peaks`, `.stems`, YouTube audio cache) are stored locally and can be purged at any time via the Settings panel.

---

## 2. Process Isolation & Subprocess Execution Policy

Fluxo implements defense-in-depth within the Electron multi-process hierarchy:

### 2.1 Context Isolation & Preload Security
- **Context Isolation**: `contextIsolation: true` is strictly enforced on all BrowserWindows.
- **Node Integration Disabled**: `nodeIntegration: false` ensures the renderer UI layer has no direct access to Node.js filesystem (`fs`), network (`net`), or process APIs.
- **Typed IPC Bridge**: The preload script exposes only explicit, sanitized methods (`window.electronAPI`) communicating via `ipcRenderer.invoke()`.

### 2.2 Subprocess Command Parameterization
Fluxo spawns external utility binaries (`ffmpeg` and `yt-dlp`) to support offline audio rendering and stream extraction:
- **Zero Shell Interpolation**: Subprocesses are spawned using `child_process.spawn` with discrete argument arrays (`string[]`), never through an arbitrary shell interpreter (`shell: false` / `exec`).
- **Input Sanitization**: File paths, query strings, and URLs are validated and escaped before execution. Shell meta-characters (`&`, `|`, `;`, `$`, `` ` ``) are stripped to eliminate command injection vectors.
- **Deterministic Resource Paths**: Packaged application binaries (`resources/bin/ffmpeg.exe`) are cryptographically verified or resolved from deterministic paths within the application sandbox.

### 2.3 SQL Injection Prevention
All SQLite interactions via `better-sqlite3` use parameterized prepared statements (e.g., `db.prepare('SELECT * FROM tracks WHERE path = ?').get(filePath)`). Dynamic string concatenation in SQL queries is prohibited across the entire codebase.

---

## 3. Supported Versions

Security updates and patches are actively provided for the following releases:

| Version | Supported | Maintenance Status |
| :--- | :---: | :--- |
| `1.0.x` | ✅ Yes | Active Release & Long-Term Support (LTS) |
| `< 1.0.0` | ❌ No | Pre-release Development Milestone |

---

## 4. Reporting a Security Vulnerability

If you discover a security vulnerability or potential threat in Fluxo, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Send a detailed vulnerability report via email to: `security@fluxo-audio.local` or contact the lead maintainers directly.
3. Include the following details:
   - Description of the vulnerability and attack vector.
   - Operating system and exact Fluxo version.
   - Proof of Concept (PoC) steps or test script.
   - Recommended remediation if known.

### Our Commitment:
- We acknowledge receipt of vulnerability reports within **24 hours**.
- We assess and validate the vulnerability within **72 hours**.
- If confirmed, a patched release will be published within **7 days** with full credit to the researcher (unless anonymity is requested).
