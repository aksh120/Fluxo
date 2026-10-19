// SQLite Schema and Migration Definitions for Fluxo

export const CURRENT_SCHEMA_VERSION = 1;

export const INITIAL_SCHEMA_SQL = `
-- Tracks Table
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  filePath TEXT UNIQUE NOT NULL,
  fileSize INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  genre TEXT,
  year INTEGER,
  duration REAL NOT NULL,
  sampleRate INTEGER NOT NULL,
  channels INTEGER NOT NULL,
  bitrate INTEGER,
  format TEXT NOT NULL,
  coverArtPath TEXT,
  sourceType TEXT NOT NULL DEFAULT 'local',
  youtubeId TEXT,
  importedAt INTEGER NOT NULL
);

-- Analyses Table (DSP, BPM, Beatgrid, Musical Key, Camelot)
CREATE TABLE IF NOT EXISTS analyses (
  trackId TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  bpm REAL,
  bpmConfidence REAL,
  musicalKey TEXT,
  camelotCode TEXT,
  keyConfidence REAL,
  integratedLufs REAL,
  truePeak REAL,
  energyLevel REAL,
  beatGridJson TEXT,
  waveformOverviewPath TEXT,
  stemsPath TEXT,
  errorMessage TEXT,
  updatedAt INTEGER NOT NULL
);

-- Playlists Table
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- Playlist Tracks Junction Table
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlistId TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  trackId TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (playlistId, trackId, position)
);

-- Cue Points Table (Cue, Drop, Loop, Intro, Outro)
CREATE TABLE IF NOT EXISTS cue_points (
  id TEXT PRIMARY KEY,
  trackId TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timestamp REAL NOT NULL,
  type TEXT NOT NULL,
  loopLengthBeats INTEGER,
  color TEXT,
  createdAt INTEGER NOT NULL
);

-- Play History & User Preference Feedback Table (Phase 9 Local Learning)
CREATE TABLE IF NOT EXISTS play_history (
  id TEXT PRIMARY KEY,
  trackId TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  playedAt INTEGER NOT NULL,
  durationPlayed REAL NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  skippedAt REAL,
  liked INTEGER NOT NULL DEFAULT 0
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_mtime ON tracks(mtime);
CREATE INDEX IF NOT EXISTS idx_analyses_bpm ON analyses(bpm);
CREATE INDEX IF NOT EXISTS idx_analyses_camelotCode ON analyses(camelotCode);
CREATE INDEX IF NOT EXISTS idx_cue_points_trackId ON cue_points(trackId);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlistId ON playlist_tracks(playlistId);
CREATE INDEX IF NOT EXISTS idx_play_history_trackId ON play_history(trackId);
CREATE INDEX IF NOT EXISTS idx_play_history_playedAt ON play_history(playedAt);

-- Schema Version Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  appliedAt INTEGER NOT NULL
);
`;
