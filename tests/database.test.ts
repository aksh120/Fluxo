import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FluxoDatabase } from '../src/main/db/database';
import type { TrackMetadata, TrackAnalysis, CuePoint } from '../src/shared/types';

describe('Phase 4 Database Schema, Migrations & CRUD Tests', () => {
  let db: FluxoDatabase;

  beforeEach(() => {
    db = new FluxoDatabase({ inMemory: true });
  });

  afterEach(() => {
    db.close();
  });

  it('P04-T001: initializes database with schema, tables, and foreign keys', () => {
    const raw = db.getRawDatabase();
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('tracks');
    expect(tableNames).toContain('analyses');
    expect(tableNames).toContain('playlists');
    expect(tableNames).toContain('cue_points');
    expect(tableNames).toContain('schema_migrations');

    const fk = raw.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });

  it('P04-T001: performs CRUD operations on tracks with conflict updates', () => {
    const track: TrackMetadata = {
      id: 'test-track-1',
      filePath: 'C:/Music/test1.mp3',
      fileSize: 5242880,
      mtime: 1700000000,
      title: 'Aurora Beat',
      artist: 'Starlight',
      album: 'Cosmic Journey',
      genre: 'Electronic',
      year: 2024,
      duration: 185.5,
      sampleRate: 44100,
      channels: 2,
      bitrate: 320000,
      format: 'mp3',
      coverArtPath: 'C:/Music/covers/test1.jpg',
      sourceType: 'local'
    };

    db.upsertTrack(track);

    const fetched = db.getTrackById('test-track-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Aurora Beat');
    expect(fetched?.artist).toBe('Starlight');
    expect(fetched?.duration).toBe(185.5);

    // Conflict update on filePath
    const updatedTrack: TrackMetadata = {
      ...track,
      title: 'Aurora Beat (Remix)',
      duration: 190.0
    };
    db.upsertTrack(updatedTrack);

    const refetched = db.getTrackByPath('C:/Music/test1.mp3');
    expect(refetched?.title).toBe('Aurora Beat (Remix)');
    expect(refetched?.duration).toBe(190.0);

    // Search
    const searchRes = db.searchTracks('aurora');
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].id).toBe('test-track-1');

    // Count and Delete
    expect(db.getTrackCount()).toBe(1);
    const deleted = db.deleteTrack('test-track-1');
    expect(deleted).toBe(true);
    expect(db.getTrackCount()).toBe(0);
  });

  it('P04-T001: stores and retrieves track analysis with beatgrid JSON serialization', () => {
    const track: TrackMetadata = {
      id: 'track-analysis-test',
      filePath: 'C:/Music/analysis.flac',
      fileSize: 25000000,
      mtime: 1700000000,
      title: 'Deep Focus',
      artist: 'Synthetica',
      album: 'Mind Waves',
      duration: 320.0,
      sampleRate: 48000,
      channels: 2,
      format: 'flac',
      sourceType: 'local'
    };
    db.upsertTrack(track);

    const analysis: TrackAnalysis = {
      trackId: 'track-analysis-test',
      status: 'deep_ready',
      bpm: 124.0,
      bpmConfidence: 0.98,
      musicalKey: 'Am',
      camelotCode: '8A',
      keyConfidence: 0.95,
      integratedLufs: -14.2,
      truePeak: -0.8,
      energyLevel: 0.75,
      beatGrid: {
        firstDownbeat: 0.48,
        bpm: 124.0,
        interval: 60 / 124.0,
        confidence: 0.98
      }
    };

    db.upsertAnalysis(analysis);

    const fetchedAnalysis = db.getAnalysis('track-analysis-test');
    expect(fetchedAnalysis).not.toBeNull();
    expect(fetchedAnalysis?.bpm).toBe(124.0);
    expect(fetchedAnalysis?.camelotCode).toBe('8A');
    expect(fetchedAnalysis?.beatGrid?.firstDownbeat).toBe(0.48);
  });

  it('P04-T001: enforces cascade delete on track foreign keys (analyses and cue points)', () => {
    const track: TrackMetadata = {
      id: 'track-cascade-test',
      filePath: 'C:/Music/cascade.mp3',
      fileSize: 4000000,
      mtime: 1700000000,
      title: 'Cascade Track',
      artist: 'Fluxo Echoes',
      album: 'Cascades',
      duration: 200,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local'
    };
    db.upsertTrack(track);

    db.upsertAnalysis({
      trackId: 'track-cascade-test',
      status: 'fast_ready',
      bpm: 128.0
    });

    const cue: CuePoint = {
      id: 'cue-1',
      trackId: 'track-cascade-test',
      name: 'Main Drop',
      timestamp: 45.0,
      type: 'drop'
    };
    db.saveCuePoint(cue);

    expect(db.getCuePoints('track-cascade-test').length).toBe(1);
    expect(db.getAnalysis('track-cascade-test')).not.toBeNull();

    // Delete track -> should cascade delete analysis and cue points
    db.deleteTrack('track-cascade-test');

    expect(db.getTrackById('track-cascade-test')).toBeNull();
    expect(db.getAnalysis('track-cascade-test')).toBeNull();
    expect(db.getCuePoints('track-cascade-test').length).toBe(0);
  });
});
