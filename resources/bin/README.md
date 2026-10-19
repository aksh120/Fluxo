# Bundled FFmpeg Binary Resources

This directory contains external auxiliary binaries bundled with the packaged Fluxo desktop application:

- **`ffmpeg.exe`**: Statically linked LGPL v2.1/v3 compilation of FFmpeg used for:
  1. Offline multi-track mix rendering (encoding Float32 interleaved PCM to 320 kbps MP3 or lossless FLAC).
  2. Local YouTube audio stream demuxing and caching.

- **`yt-dlp.exe`**: Standalone audio/video extractor used for:
  1. Querying real search results and metadata from YouTube without requiring API keys.
  2. Extracting high-bitrate audio streams directly into the local application cache.

## Dynamic Path Resolution Hierarchy

Fluxo dynamically resolves `ffmpeg.exe` at runtime in the following order of precedence:
1. `process.env.FLUXO_FFMPEG_PATH` (user or test environment override).
2. `path.join(process.resourcesPath, 'bin', 'ffmpeg.exe')` (production installed application inside `%LOCALAPPDATA%\Programs\Fluxo\resources\bin\ffmpeg.exe`).
3. `path.join(process.cwd(), 'resources', 'bin', 'ffmpeg.exe')` (local development workspace).
4. `C:\ffmpeg\bin\ffmpeg.exe` (standard host developer installation).
5. System `PATH` (`ffmpeg`).

## Licensing

FFmpeg is licensed under the GNU Lesser General Public License (LGPL) version 2.1 or later.
See `LICENSE-LGPL.txt` for details. Fluxo executes FFmpeg as an independent child process via standard pipes (`node:child_process.spawn`) without statically linking FFmpeg libraries into application memory.
