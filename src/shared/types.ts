// Shared types across Main, Preload, and Renderer

export interface TrackMetadata {
  id: string;
  filePath: string;
  fileSize: number;
  mtime: number;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  year?: number;
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  bitrate?: number;
  format: string;
  coverArtPath?: string;
  sourceType: 'local' | 'youtube';
  youtubeId?: string;
  bpm?: number;
  camelotCode?: string;
  musicalKey?: string;
  energyLevel?: number;
}

export interface BeatGrid {
  firstDownbeat: number; // in seconds
  bpm: number;
  interval: number; // seconds per beat
  confidence: number;
}

export interface TrackAnalysis {
  trackId: string;
  status: 'pending' | 'fast_ready' | 'deep_ready' | 'failed';
  bpm?: number;
  bpmConfidence?: number;
  beatGrid?: BeatGrid;
  musicalKey?: string; // e.g. "Am", "C"
  camelotCode?: string; // e.g. "8A", "8B"
  keyConfidence?: number;
  integratedLufs?: number;
  truePeak?: number;
  energyLevel?: number; // 0.0 - 1.0
  waveformOverviewPath?: string;
  stemsPath?: string;
  errorMessage?: string;
}

export interface CuePoint {
  id: string;
  trackId: string;
  name: string;
  timestamp: number;
  type: 'cue' | 'intro' | 'drop' | 'outro' | 'loop';
  loopLengthBeats?: number;
  color?: string;
}

export interface PlayHistoryEntry {
  id: string;
  trackId: string;
  playedAt: number;
  durationPlayed: number;
  completed: boolean;
  skippedAt?: number;
  liked?: boolean;
}

export interface TrackFeedbackStats {
  completedCount: number;
  skipCount: number;
  skipRatio: number;
  isLiked: boolean;
  scoreAdjustment: number;
}

export interface DeckState {
  deckId: 'A' | 'B';
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number; // 1.0 = normal
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  lowGain: number; // -inf to 1.0
  midGain: number;
  highGain: number;
  filterFreq: number; // 20Hz to 20000Hz
  filterResonance: number;
}

export type TransitionStyle =
  | 'smooth_blend'
  | 'bass_swap'
  | 'filter_sweep'
  | 'echo_out'
  | 'drop_cut';

export interface TransitionPlan {
  outgoingDeck: 'A' | 'B';
  incomingDeck: 'A' | 'B';
  style: TransitionStyle;
  durationBeats: number;
  startBeatTime: number;
  isFallback: boolean;
}

export interface AudioSourceCapabilities {
  canSearch: boolean;
  canStream: boolean;
  canAccessPcmData: boolean;
  canOfflineExport: boolean;
  requiresAuthentication: boolean;
  latencyProfile: 'instant' | 'buffered' | 'network';
}

export interface FluxoAPI {
  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;

  // System & Platform info
  getPlatformInfo: () => Promise<{
    platform: string;
    version: string;
    ffmpegAvailable: boolean;
    pythonAvailable: boolean;
  }>;

  // Local File dialogs
  selectMusicDirectory: () => Promise<string | null>;
  openAudioFiles: () => Promise<string[]>;

  // Playback & Audio
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;

  // Library & Database Operations
  getLibraryTracks: () => Promise<TrackMetadata[]>;
  scanMusicDirectory: (dirPath: string) => Promise<TrackMetadata[]>;
  importAudioFiles: (filePaths: string[]) => Promise<TrackMetadata[]>;
  deleteLibraryTrack: (trackId: string) => Promise<boolean>;
  searchLibraryTracks: (query: string) => Promise<TrackMetadata[]>;
  onScanProgress: (
    callback: (progress: {
      phase: string;
      totalFiles: number;
      processedFiles: number;
      currentFile?: string;
    }) => void
  ) => () => void;

  // Analysis Operations
  getTrackAnalysis: (trackId: string) => Promise<TrackAnalysis | null>;
  analyzeTrackPcm: (
    trackId: string,
    channelData: Float32Array,
    sampleRate: number
  ) => Promise<TrackAnalysis>;

  // Play History & Preference Learning
  recordPlayEvent: (entry: PlayHistoryEntry) => Promise<void>;
  getTrackFeedbackStats: (trackId: string) => Promise<TrackFeedbackStats>;
  getArtistAffinity: (artist: string) => Promise<number>;

  // Cue Points Operations (Phase 10)
  saveCuePoint: (cue: CuePoint) => Promise<void>;
  getCuePoints: (trackId: string) => Promise<CuePoint[]>;
  deleteCuePoint: (cueId: string) => Promise<boolean>;

  // Stem Separation & Caching Operations (Phase 10)
  separateStems: (
    trackId: string,
    filePath: string,
    sampleRate?: number,
    duration?: number
  ) => Promise<{
    trackId: string;
    vocalsPath: string;
    instrumentalPath: string;
    model: string;
    duration: number;
  }>;
  getStemsCacheStats: () => Promise<{ totalBytes: number; trackCount: number; formattedSize: string }>;
  clearStemsCache: () => Promise<{ freedBytes: number; deletedCount: number }>;

  // Mix Creator & Project Persistence (Phase 11)
  saveProject: (project: FluxoProject, customPath?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  loadProject: (customPath?: string) => Promise<{ success: boolean; project?: FluxoProject; error?: string }>;
  selectSaveProjectPath: (defaultName?: string) => Promise<string | null>;
  selectExportAudioPath: (defaultName?: string, format?: 'mp3' | 'wav' | 'flac') => Promise<string | null>;
  encodeAudioFile: (request: {
    channelData: Float32Array[];
    sampleRate: number;
    outputPath: string;
    format: 'mp3' | 'wav' | 'flac';
    bitrateKbps?: number;
    targetLufs?: number;
  }) => Promise<{ success: boolean; outputPath: string; duration: number; measuredLufs?: number; fileSize: number }>;
  cancelExport: () => Promise<void>;
  showItemInFolder: (fullPath: string) => Promise<void>;
  onExportProgress: (callback: (progress: ExportProgress) => void) => () => void;

  // YouTube Audio Extraction & Streaming (Phase 12)
  searchYouTube: (query: string, limit?: number) => Promise<any[]>;
  extractYouTubeAudio: (identifier: string) => Promise<TrackMetadata>;
  getYoutubeCachedTracks: () => Promise<TrackMetadata[]>;
  getYouTubeCacheStats: () => Promise<{ totalBytes: number; trackCount: number; formattedSize: string }>;
  clearYouTubeCache: () => Promise<{ freedBytes: number; deletedCount: number }>;
  onTrackAdded?: (callback: (track: TrackMetadata) => void) => () => void;
  onTracksUpdated?: (callback: () => void) => () => void;

  // Playlist & Album Batch Download & YouTube Login (Phase 12 Extension)
  fetchPlaylistInfo: (urlOrId: string) => Promise<PlaylistMetadata | null>;
  downloadPlaylist: (
    urlOrId: string,
    options?: { albumName?: string; artistName?: string }
  ) => Promise<{ success: boolean; tracksCount: number; tracks: TrackMetadata[]; error?: string }>;
  cancelPlaylistDownload: (playlistId: string) => Promise<void>;
  onPlaylistDownloadProgress?: (callback: (progress: PlaylistDownloadProgress) => void) => () => void;
  getYouTubeLoginStatus: () => Promise<{ isLoggedIn: boolean; email?: string }>;
  logoutYouTube: () => Promise<{ success: boolean }>;
}

export interface PlaylistMetadata {
  id: string;
  title: string;
  author?: string;
  trackCount: number;
  thumbnailUrl?: string;
  url: string;
  tracks: Array<{
    id: string;
    sourceType: 'youtube';
    title: string;
    artist: string;
    duration: number;
    thumbnailUrl?: string;
    url?: string;
  }>;
}

export interface PlaylistDownloadProgress {
  playlistId: string;
  playlistTitle: string;
  currentTrackIndex: number;
  totalTracks: number;
  currentTrackTitle: string;
  currentTrackProgress: number; // 0.0 - 1.0
  overallProgress: number; // 0.0 - 1.0
  statusMessage: string;
  isComplete: boolean;
  isCancelled: boolean;
  failedTracks: string[];
}

// Phase 11: Multi-Track Timeline & Project Types
export interface TimelineTrack {
  id: string; // Unique timeline block instance ID
  trackId: string; // Underlying library/source track ID
  filePath: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // Seconds
  bpm?: number;
  key?: string;
  offsetSeconds: number; // Start time on project timeline
  volume: number; // 0.0 - 1.0 (default 1.0)
  lowGain: number; // 0.0 - 1.0 (default 1.0)
  midGain: number; // 0.0 - 1.0 (default 1.0)
  highGain: number; // 0.0 - 1.0 (default 1.0)
  color?: string; // Optional track block theme color
}

export interface TimelineTransition {
  id: string;
  fromTrackId: string;
  toTrackId: string;
  overlapSeconds: number; // Overlap duration between outgoing and incoming tracks
  style: TransitionStyle; // 'smooth' | 'bass_swap' | 'filter_sweep' | 'drop_cut'
  curve: 'equal_power' | 'linear' | 'exponential';
}

export interface ExportSettings {
  format: 'mp3' | 'wav' | 'flac';
  bitrateKbps: number; // e.g. 320 for MP3
  sampleRate: number; // 44100 or 48000
  normalize: boolean; // Apply ITU-R BS.1770 LUFS normalization
  targetLufs: number; // e.g. -14 LUFS
}

export interface FluxoProject {
  version: '1.0.0';
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tracks: TimelineTrack[];
  transitions: TimelineTransition[];
  targetLufs: number;
  exportSettings: ExportSettings;
}

export interface ExportProgress {
  phase: 'idle' | 'decoding' | 'rendering' | 'normalizing' | 'encoding' | 'complete' | 'cancelled' | 'error';
  progress: number; // 0.0 - 1.0
  percentage: number; // 0 - 100
  statusMessage: string;
  elapsedSeconds: number;
  estimatedSecondsRemaining?: number;
  error?: string;
}

declare global {
  interface Window {
    fluxoAPI: FluxoAPI;
  }
}

