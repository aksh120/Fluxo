import { contextBridge, ipcRenderer } from 'electron';
import type { FluxoAPI } from '../shared/types';

const fluxoAPI: FluxoAPI = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Platform info
  getPlatformInfo: () => ipcRenderer.invoke('system:get-platform-info'),

  // File dialogs
  selectMusicDirectory: () => ipcRenderer.invoke('dialog:select-music-dir'),
  openAudioFiles: () => ipcRenderer.invoke('dialog:open-audio-files'),

  // Audio loading
  readAudioFile: (filePath: string) => ipcRenderer.invoke('audio:read-file', filePath),

  // Library & Database Operations
  getLibraryTracks: () => ipcRenderer.invoke('library:get-tracks'),
  scanMusicDirectory: (dirPath: string) => ipcRenderer.invoke('library:scan-directory', dirPath),
  importAudioFiles: (filePaths: string[]) => ipcRenderer.invoke('library:import-files', filePaths),
  deleteLibraryTrack: (trackId: string) => ipcRenderer.invoke('library:delete-track', trackId),
  searchLibraryTracks: (query: string) => ipcRenderer.invoke('library:search-tracks', query),
  onScanProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('library:scan-progress', handler);
    return () => {
      ipcRenderer.removeListener('library:scan-progress', handler);
    };
  },

  // Analysis Operations
  getTrackAnalysis: (trackId: string) => ipcRenderer.invoke('analysis:get', trackId),
  analyzeTrackPcm: (trackId: string, channelData: Float32Array, sampleRate: number) =>
    ipcRenderer.invoke('analysis:analyze-pcm', trackId, channelData, sampleRate),

  // Play History & Preference Learning
  recordPlayEvent: (entry) => ipcRenderer.invoke('history:record-play', entry),
  getTrackFeedbackStats: (trackId) => ipcRenderer.invoke('history:get-feedback-stats', trackId),
  getArtistAffinity: (artist) => ipcRenderer.invoke('history:get-artist-affinity', artist),

  // Cue Points Operations (Phase 10)
  saveCuePoint: (cue) => ipcRenderer.invoke('cue:save', cue),
  getCuePoints: (trackId) => ipcRenderer.invoke('cue:get', trackId),
  deleteCuePoint: (cueId) => ipcRenderer.invoke('cue:delete', cueId),

  // Stem Separation & Caching Operations (Phase 10)
  separateStems: (trackId, filePath, sampleRate, duration) =>
    ipcRenderer.invoke('stems:separate', trackId, filePath, sampleRate, duration),
  getStemsCacheStats: () => ipcRenderer.invoke('stems:get-cache-stats'),
  clearStemsCache: () => ipcRenderer.invoke('stems:clear-cache'),

  // Mix Creator & Project Persistence (Phase 11)
  saveProject: (project, customPath) => ipcRenderer.invoke('project:save', project, customPath),
  loadProject: (customPath) => ipcRenderer.invoke('project:load', customPath),
  selectSaveProjectPath: (defaultName) => ipcRenderer.invoke('project:select-save-path', defaultName),
  selectExportAudioPath: (defaultName, format) =>
    ipcRenderer.invoke('export:select-audio-path', defaultName, format),
  encodeAudioFile: (request) => ipcRenderer.invoke('export:encode-audio', request),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:show-item-in-folder', fullPath),
  onExportProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('export:progress', handler);
    return () => ipcRenderer.removeListener('export:progress', handler);
  },

  // YouTube Audio Extraction & Streaming (Phase 12)
  searchYouTube: (query, limit) => ipcRenderer.invoke('youtube:search', query, limit),
  extractYouTubeAudio: (identifier) => ipcRenderer.invoke('youtube:extract', identifier),
  getYoutubeCachedTracks: () => ipcRenderer.invoke('youtube:get-cached-tracks'),
  getYouTubeCacheStats: () => ipcRenderer.invoke('youtube:get-cache-stats'),
  clearYouTubeCache: () => ipcRenderer.invoke('youtube:clear-cache'),
  onTrackAdded: (callback) => {
    const handler = (_event: any, track: any) => callback(track);
    ipcRenderer.on('library:track-added', handler);
    return () => ipcRenderer.removeListener('library:track-added', handler);
  },
  onTracksUpdated: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('library:tracks-updated', handler);
    return () => ipcRenderer.removeListener('library:tracks-updated', handler);
  },

  // Playlist & Album Batch Download & YouTube Login
  fetchPlaylistInfo: (urlOrId) => ipcRenderer.invoke('youtube:fetch-playlist', urlOrId),
  downloadPlaylist: (urlOrId, options) => ipcRenderer.invoke('youtube:download-playlist', urlOrId, options),
  cancelPlaylistDownload: (playlistId) => ipcRenderer.invoke('youtube:cancel-playlist-download', playlistId),
  onPlaylistDownloadProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('youtube:playlist-progress', handler);
    return () => ipcRenderer.removeListener('youtube:playlist-progress', handler);
  },
  getYouTubeLoginStatus: () => ipcRenderer.invoke('youtube:get-login-status'),
  logoutYouTube: () => ipcRenderer.invoke('youtube:logout')
};

// Expose safe API to the renderer process
contextBridge.exposeInMainWorld('fluxoAPI', fluxoAPI);
