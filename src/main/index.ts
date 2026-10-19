import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { FluxoDatabase } from './db/database';
import { LibraryManager } from './library/LibraryManager';
import { AnalysisPipeline } from './analysis/AnalysisPipeline';
import { StemSeparationManager } from './stems/StemSeparationManager';
import { FFmpegEncoder } from './export/FFmpegEncoder';
import { YouTubeAudioExtractorProvider } from './sources/YouTubeAudioExtractorProvider';

let mainWindow: BrowserWindow | null = null;
let activeEncoder: FFmpegEncoder | null = null;

// Determine environment paths
const isDev = !app.isPackaged;
const PRELOAD_PATH = path.join(__dirname, '../preload/index.js');

function checkTool(command: string): boolean {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: 'Fluxo — Intelligent Music Crossover',
    backgroundColor: '#0B0F19',
    frame: false, // Custom sleek glassmorphic header
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for custom preload IPC access
      webSecurity: true
    }
  });

  // Load dev server URL or production index.html
  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// Platform and environment inspection
ipcMain.handle('system:get-platform-info', async () => {
  const ffmpegAvailable = FFmpegEncoder.isAvailable();
  const pythonAvailable = checkTool('py --version') || checkTool('python --version');

  return {
    platform: process.platform,
    version: app.getVersion(),
    ffmpegAvailable,
    pythonAvailable
  };
});

// File dialog handlers
ipcMain.handle('dialog:select-music-dir', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Music Folder to Import'
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('dialog:open-audio-files', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'Select Audio Files',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'] }
    ]
  });
  if (result.canceled) return [];
  return result.filePaths;
});

// Audio binary file reader for local playback
ipcMain.handle('audio:read-file', async (_event, filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const buffer = await fs.promises.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

// Database & Library Management
const dbPath = path.join(app.getPath('userData'), 'fluxo.sqlite');
const coversDir = path.join(app.getPath('userData'), 'covers');
const database = new FluxoDatabase({ dbPath });
const libraryManager = new LibraryManager(database, coversDir);

ipcMain.handle('library:get-tracks', async () => {
  return libraryManager.getDatabase().getAllTracks();
});

ipcMain.handle('library:scan-directory', async (_event, dirPath: string) => {
  return libraryManager.scanDirectory(dirPath, (progress) => {
    mainWindow?.webContents.send('library:scan-progress', progress);
  });
});

ipcMain.handle('library:import-files', async (_event, filePaths: string[]) => {
  return libraryManager.importFiles(filePaths, (progress) => {
    mainWindow?.webContents.send('library:scan-progress', progress);
  });
});

ipcMain.handle('library:delete-track', async (_event, trackId: string) => {
  return libraryManager.deleteTrack(trackId);
});

ipcMain.handle('library:search-tracks', async (_event, query: string) => {
  return libraryManager.searchTracks(query);
});

// Audio Analysis Pipeline
const peaksDir = path.join(app.getPath('userData'), 'peaks');
const analysisPipeline = new AnalysisPipeline(database, { peaksCacheDir: peaksDir });

ipcMain.handle('analysis:get', async (_event, trackId: string) => {
  return database.getAnalysis(trackId);
});

ipcMain.handle(
  'analysis:analyze-pcm',
  async (_event, trackId: string, channelData: Float32Array, sampleRate: number) => {
    const track = database.getTrackById(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found in database`);
    }
    return analysisPipeline.analyzeTrack(track, channelData, sampleRate);
  }
);

// Stem Separation Manager (Phase 10)
const stemsCacheDir = path.join(app.getPath('userData'), 'cache', 'stems');
const stemManager = new StemSeparationManager({ cacheDir: stemsCacheDir });

// Play History & Feedback Operations
ipcMain.handle('history:record-play', async (_event, entry: any) => {
  return database.recordPlayEvent(entry);
});

ipcMain.handle('history:get-feedback-stats', async (_event, trackId: string) => {
  return database.getTrackFeedbackStats(trackId);
});

ipcMain.handle('history:get-artist-affinity', async (_event, artist: string) => {
  return database.getArtistAffinity(artist);
});

// Cue Points Operations (Phase 10)
ipcMain.handle('cue:save', async (_event, cue: any) => {
  return database.saveCuePoint(cue);
});

ipcMain.handle('cue:get', async (_event, trackId: string) => {
  return database.getCuePoints(trackId);
});

ipcMain.handle('cue:delete', async (_event, cueId: string) => {
  return database.deleteCuePoint(cueId);
});

// Stem Separation & Caching Operations (Phase 10)
ipcMain.handle(
  'stems:separate',
  async (_event, trackId: string, filePath: string, sampleRate?: number, duration?: number) => {
    return stemManager.separateStems(trackId, filePath, sampleRate, duration);
  }
);

ipcMain.handle('stems:get-cache-stats', async () => {
  return stemManager.getCacheStats();
});

ipcMain.handle('stems:clear-cache', async () => {
  return stemManager.clearCache();
});

// Mix Creator & Project Persistence (Phase 11)
ipcMain.handle('project:save', async (_event, project: any, customPath?: string) => {
  try {
    let savePath = customPath;
    if (!savePath && mainWindow) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Fluxo Project',
        defaultPath: `${project.name || 'Untitled'}.fluxo`,
        filters: [{ name: 'Fluxo Project (*.fluxo)', extensions: ['fluxo'] }]
      });
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save was cancelled.' };
      }
      savePath = result.filePath;
    }
    if (!savePath) return { success: false, error: 'No save path specified.' };
    fs.writeFileSync(savePath, JSON.stringify(project, null, 2), 'utf-8');
    return { success: true, filePath: savePath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('project:load', async (_event, customPath?: string) => {
  try {
    let loadPath = customPath;
    if (!loadPath && mainWindow) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Fluxo Project',
        filters: [{ name: 'Fluxo Project (*.fluxo)', extensions: ['fluxo'] }],
        properties: ['openFile']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, error: 'Open was cancelled.' };
      }
      loadPath = result.filePaths[0];
    }
    if (!loadPath) return { success: false, error: 'No load path specified.' };
    const raw = fs.readFileSync(loadPath, 'utf-8');
    const project = JSON.parse(raw);
    return { success: true, project };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('project:select-save-path', async (_event, defaultName = 'Untitled') => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Select Project File Location',
    defaultPath: `${defaultName}.fluxo`,
    filters: [{ name: 'Fluxo Project (*.fluxo)', extensions: ['fluxo'] }]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('export:select-audio-path', async (_event, defaultName = 'Fluxo_Mix', format = 'mp3') => {
  if (!mainWindow) return null;
  const ext = format === 'wav' ? 'wav' : format === 'flac' ? 'flac' : 'mp3';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Rendered Mix Audio',
    defaultPath: `${defaultName}.${ext}`,
    filters: [{ name: `${format.toUpperCase()} Audio (*.${ext})`, extensions: [ext] }]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('export:encode-audio', async (_event, request: any) => {
  const encoder = new FFmpegEncoder();
  activeEncoder = encoder;
  try {
    const res = await encoder.encode(request);
    activeEncoder = null;
    return res;
  } catch (err) {
    activeEncoder = null;
    return {
      success: false,
      outputPath: request.outputPath,
      duration: 0,
      fileSize: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
});

ipcMain.handle('export:cancel', async () => {
  if (activeEncoder) {
    activeEncoder.cancel();
    activeEncoder = null;
  }
});

ipcMain.handle('shell:show-item-in-folder', async (_event, fullPath: string) => {
  if (fs.existsSync(fullPath)) {
    shell.showItemInFolder(fullPath);
  }
});

// YouTube Audio Extraction & Streaming (Phase 12)
const youtubeCacheDir = path.join(app.getPath('userData'), 'cache', 'youtube');
const youtubeProvider = new YouTubeAudioExtractorProvider({
  cacheDir: youtubeCacheDir,
  database
});

ipcMain.handle('youtube:search', async (_event, query: string, limit?: number) => {
  return youtubeProvider.search(query, limit);
});

ipcMain.handle('youtube:extract', async (_event, identifier: string) => {
  return youtubeProvider.extractAudio(identifier);
});

ipcMain.handle('youtube:get-cache-stats', async () => {
  return youtubeProvider.getCacheStats();
});

ipcMain.handle('youtube:clear-cache', async () => {
  return youtubeProvider.clearCache();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
