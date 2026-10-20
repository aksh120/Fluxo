import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { INITIAL_SCHEMA_SQL, CURRENT_SCHEMA_VERSION } from './schema';
import type { TrackMetadata, TrackAnalysis, CuePoint, PlayHistoryEntry, TrackFeedbackStats } from '../../shared/types';

export interface DatabaseOptions {
  inMemory?: boolean;
  dbPath?: string;
}

export class FluxoDatabase {
  private db: Database.Database;

  constructor(options: DatabaseOptions = {}) {
    let nativeBinding: string | undefined = undefined;
    if (typeof process !== 'undefined' && process.versions && (process.versions as any).electron) {
      if (process.resourcesPath) {
        const packaged = path.join(process.resourcesPath, 'bin', 'better_sqlite3_electron.node');
        if (fs.existsSync(packaged)) nativeBinding = packaged;
      }
      if (!nativeBinding) {
        const localDev = path.join(process.cwd(), 'resources', 'bin', 'better_sqlite3_electron.node');
        if (fs.existsSync(localDev)) nativeBinding = localDev;
      }
    }

    const dbOptions: any = {};
    if (nativeBinding) {
      dbOptions.nativeBinding = nativeBinding;
    }

    if (options.inMemory) {
      this.db = new Database(':memory:', dbOptions);
    } else {
      const dbFile = options.dbPath || path.join(process.cwd(), 'fluxo.sqlite');
      const dir = path.dirname(dbFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(dbFile, dbOptions);
    }

    this.configurePragmas();
    this.runMigrations();
  }

  private configurePragmas(): void {
    // Enable Write-Ahead Logging for high-concurrency and crash-resilience
    this.db.pragma('journal_mode = WAL');
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    // Set busy timeout so concurrent reads/writes don't fail immediately
    this.db.pragma('busy_timeout = 5000');
    // Synchronous NORMAL is optimal with WAL mode
    this.db.pragma('synchronous = NORMAL');
  }

  private runMigrations(): void {
    this.db.exec(INITIAL_SCHEMA_SQL);

    const versionRow = this.db
      .prepare('SELECT MAX(version) as currentVersion FROM schema_migrations')
      .get() as { currentVersion: number | null } | undefined;

    const currentVersion = versionRow?.currentVersion ?? 0;

    if (currentVersion < CURRENT_SCHEMA_VERSION) {
      const insertMigration = this.db.prepare(
        'INSERT INTO schema_migrations (version, appliedAt) VALUES (?, ?)'
      );
      insertMigration.run(CURRENT_SCHEMA_VERSION, Date.now());
    }
  }

  public getRawDatabase(): Database.Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  // ==========================================
  // Track Operations
  // ==========================================

  public upsertTrack(track: TrackMetadata): void {
    const stmt = this.db.prepare(`
      INSERT INTO tracks (
        id, filePath, fileSize, mtime, title, artist, album,
        genre, year, duration, sampleRate, channels, bitrate,
        format, coverArtPath, sourceType, youtubeId, importedAt
      ) VALUES (
        @id, @filePath, @fileSize, @mtime, @title, @artist, @album,
        @genre, @year, @duration, @sampleRate, @channels, @bitrate,
        @format, @coverArtPath, @sourceType, @youtubeId, @importedAt
      )
      ON CONFLICT(filePath) DO UPDATE SET
        fileSize = excluded.fileSize,
        mtime = excluded.mtime,
        title = excluded.title,
        artist = excluded.artist,
        album = excluded.album,
        genre = excluded.genre,
        year = excluded.year,
        duration = excluded.duration,
        sampleRate = excluded.sampleRate,
        channels = excluded.channels,
        bitrate = excluded.bitrate,
        format = excluded.format,
        coverArtPath = COALESCE(excluded.coverArtPath, tracks.coverArtPath)
    `);

    stmt.run({
      id: track.id,
      filePath: track.filePath,
      fileSize: track.fileSize,
      mtime: track.mtime,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre ?? null,
      year: track.year ?? null,
      duration: track.duration,
      sampleRate: track.sampleRate,
      channels: track.channels,
      bitrate: track.bitrate ?? null,
      format: track.format,
      coverArtPath: track.coverArtPath ?? null,
      sourceType: track.sourceType || 'local',
      youtubeId: track.youtubeId ?? null,
      importedAt: Date.now()
    });
  }

  private readonly trackSelectQuery = `
    SELECT 
      t.*,
      a.bpm AS analysisBpm,
      a.camelotCode AS analysisCamelotCode,
      a.musicalKey AS analysisMusicalKey,
      a.energyLevel AS analysisEnergyLevel
    FROM tracks t
    LEFT JOIN analyses a ON t.id = a.trackId
  `;

  public getTrackById(id: string): TrackMetadata | null {
    const stmt = this.db.prepare(`${this.trackSelectQuery} WHERE t.id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRowToTrack(row) : null;
  }

  public getTrackByPath(filePath: string): TrackMetadata | null {
    const stmt = this.db.prepare(`${this.trackSelectQuery} WHERE t.filePath = ?`);
    const row = stmt.get(filePath) as Record<string, unknown> | undefined;
    return row ? this.mapRowToTrack(row) : null;
  }

  public getAllTracks(): TrackMetadata[] {
    const stmt = this.db.prepare(`${this.trackSelectQuery} ORDER BY t.artist ASC, t.album ASC, t.title ASC`);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.mapRowToTrack(r));
  }

  public searchTracks(query: string): TrackMetadata[] {
    const wildcard = `%${query.trim()}%`;
    const stmt = this.db.prepare(`
      ${this.trackSelectQuery}
      WHERE t.title LIKE ? OR t.artist LIKE ? OR t.album LIKE ? OR t.genre LIKE ?
      ORDER BY t.artist ASC, t.title ASC
      LIMIT 100
    `);
    const rows = stmt.all(wildcard, wildcard, wildcard, wildcard) as Record<string, unknown>[];
    return rows.map((r) => this.mapRowToTrack(r));
  }

  public deleteTrack(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tracks WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  public deleteTracksBySource(sourceType: string): number {
    const stmt = this.db.prepare('DELETE FROM tracks WHERE sourceType = ?');
    const info = stmt.run(sourceType);
    return info.changes;
  }

  public deleteTracksUnderPath(dirPath: string): number {
    const wildcard = `${dirPath}%`;
    const stmt = this.db.prepare('DELETE FROM tracks WHERE filePath LIKE ?');
    const info = stmt.run(wildcard);
    return info.changes;
  }

  public getTrackCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number };
    return row.count;
  }

  // ==========================================
  // Analysis Operations
  // ==========================================

  public upsertAnalysis(analysis: TrackAnalysis): void {
    const stmt = this.db.prepare(`
      INSERT INTO analyses (
        trackId, status, bpm, bpmConfidence, musicalKey, camelotCode,
        keyConfidence, integratedLufs, truePeak, energyLevel,
        beatGridJson, waveformOverviewPath, stemsPath, errorMessage, updatedAt
      ) VALUES (
        @trackId, @status, @bpm, @bpmConfidence, @musicalKey, @camelotCode,
        @keyConfidence, @integratedLufs, @truePeak, @energyLevel,
        @beatGridJson, @waveformOverviewPath, @stemsPath, @errorMessage, @updatedAt
      )
      ON CONFLICT(trackId) DO UPDATE SET
        status = excluded.status,
        bpm = excluded.bpm,
        bpmConfidence = excluded.bpmConfidence,
        musicalKey = excluded.musicalKey,
        camelotCode = excluded.camelotCode,
        keyConfidence = excluded.keyConfidence,
        integratedLufs = excluded.integratedLufs,
        truePeak = excluded.truePeak,
        energyLevel = excluded.energyLevel,
        beatGridJson = excluded.beatGridJson,
        waveformOverviewPath = excluded.waveformOverviewPath,
        stemsPath = excluded.stemsPath,
        errorMessage = excluded.errorMessage,
        updatedAt = excluded.updatedAt
    `);

    stmt.run({
      trackId: analysis.trackId,
      status: analysis.status,
      bpm: analysis.bpm ?? null,
      bpmConfidence: analysis.bpmConfidence ?? null,
      musicalKey: analysis.musicalKey ?? null,
      camelotCode: analysis.camelotCode ?? null,
      keyConfidence: analysis.keyConfidence ?? null,
      integratedLufs: analysis.integratedLufs ?? null,
      truePeak: analysis.truePeak ?? null,
      energyLevel: analysis.energyLevel ?? null,
      beatGridJson: analysis.beatGrid ? JSON.stringify(analysis.beatGrid) : null,
      waveformOverviewPath: analysis.waveformOverviewPath ?? null,
      stemsPath: analysis.stemsPath ?? null,
      errorMessage: analysis.errorMessage ?? null,
      updatedAt: Date.now()
    });
  }

  public getAnalysis(trackId: string): TrackAnalysis | null {
    const stmt = this.db.prepare('SELECT * FROM analyses WHERE trackId = ?');
    const row = stmt.get(trackId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      trackId: row.trackId as string,
      status: row.status as TrackAnalysis['status'],
      bpm: (row.bpm as number) ?? undefined,
      bpmConfidence: (row.bpmConfidence as number) ?? undefined,
      musicalKey: (row.musicalKey as string) ?? undefined,
      camelotCode: (row.camelotCode as string) ?? undefined,
      keyConfidence: (row.keyConfidence as number) ?? undefined,
      integratedLufs: (row.integratedLufs as number) ?? undefined,
      truePeak: (row.truePeak as number) ?? undefined,
      energyLevel: (row.energyLevel as number) ?? undefined,
      beatGrid: row.beatGridJson ? JSON.parse(row.beatGridJson as string) : undefined,
      waveformOverviewPath: (row.waveformOverviewPath as string) ?? undefined,
      stemsPath: (row.stemsPath as string) ?? undefined,
      errorMessage: (row.errorMessage as string) ?? undefined
    };
  }

  // ==========================================
  // Cue Points Operations
  // ==========================================

  public saveCuePoint(cue: CuePoint): void {
    const stmt = this.db.prepare(`
      INSERT INTO cue_points (id, trackId, name, timestamp, type, loopLengthBeats, color, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        timestamp = excluded.timestamp,
        type = excluded.type,
        loopLengthBeats = excluded.loopLengthBeats,
        color = excluded.color
    `);

    stmt.run(
      cue.id,
      cue.trackId,
      cue.name,
      cue.timestamp,
      cue.type,
      cue.loopLengthBeats ?? null,
      cue.color ?? null,
      Date.now()
    );
  }

  public getCuePoints(trackId: string): CuePoint[] {
    const stmt = this.db.prepare('SELECT * FROM cue_points WHERE trackId = ? ORDER BY timestamp ASC');
    const rows = stmt.all(trackId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      trackId: r.trackId as string,
      name: r.name as string,
      timestamp: r.timestamp as number,
      type: r.type as CuePoint['type'],
      loopLengthBeats: (r.loopLengthBeats as number) ?? undefined,
      color: (r.color as string) ?? undefined
    }));
  }

  public deleteCuePoint(cueId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM cue_points WHERE id = ?');
    const res = stmt.run(cueId);
    return res.changes > 0;
  }

  // ==========================================
  // Play History & Preference Learning Operations
  // ==========================================

  public recordPlayEvent(entry: PlayHistoryEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO play_history (id, trackId, playedAt, durationPlayed, completed, skippedAt, liked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.trackId,
      entry.playedAt,
      entry.durationPlayed,
      entry.completed ? 1 : 0,
      entry.skippedAt ?? null,
      entry.liked ? 1 : 0
    );
  }

  public getTrackFeedbackStats(trackId: string): TrackFeedbackStats {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(CASE WHEN completed = 1 THEN 1 END) as completedCount,
        COUNT(CASE WHEN completed = 0 AND skippedAt IS NOT NULL THEN 1 END) as skipCount,
        MAX(liked) as isLiked
      FROM play_history
      WHERE trackId = ?
    `);

    const row = stmt.get(trackId) as { completedCount: number; skipCount: number; isLiked: number } | undefined;
    const completedCount = row?.completedCount ?? 0;
    const skipCount = row?.skipCount ?? 0;
    const totalPlays = completedCount + skipCount;
    const skipRatio = totalPlays > 0 ? skipCount / totalPlays : 0;
    const isLiked = Boolean(row?.isLiked);

    // Score adjustment: penalty for high skips, boost for completed plays and likes
    let scoreAdjustment = 0;
    if (isLiked) scoreAdjustment += 0.3;
    if (completedCount > 0) scoreAdjustment += Math.min(0.2, completedCount * 0.05);
    if (skipCount > 0) scoreAdjustment -= Math.min(0.5, skipCount * 0.15);

    return {
      completedCount,
      skipCount,
      skipRatio,
      isLiked,
      scoreAdjustment
    };
  }

  public getArtistAffinity(artist: string): number {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(CASE WHEN ph.completed = 1 THEN 1 END) as completedCount,
        COUNT(CASE WHEN ph.completed = 0 AND ph.skippedAt IS NOT NULL THEN 1 END) as skipCount
      FROM play_history ph
      JOIN tracks t ON ph.trackId = t.id
      WHERE t.artist = ?
    `);

    const row = stmt.get(artist) as { completedCount: number; skipCount: number } | undefined;
    const completed = row?.completedCount ?? 0;
    const skipped = row?.skipCount ?? 0;
    const total = completed + skipped;
    if (total === 0) return 0.0;

    return Math.max(-1.0, Math.min(1.0, (completed - skipped * 1.5) / (total + 2)));
  }

  // ==========================================
  // Helper Mappers
  // ==========================================

  private mapRowToTrack(row: Record<string, unknown>): TrackMetadata {
    return {
      id: row.id as string,
      filePath: row.filePath as string,
      fileSize: row.fileSize as number,
      mtime: row.mtime as number,
      title: row.title as string,
      artist: row.artist as string,
      album: row.album as string,
      genre: (row.genre as string) ?? undefined,
      year: (row.year as number) ?? undefined,
      duration: row.duration as number,
      sampleRate: row.sampleRate as number,
      channels: row.channels as number,
      bitrate: (row.bitrate as number) ?? undefined,
      format: row.format as string,
      coverArtPath: (row.coverArtPath as string) ?? undefined,
      sourceType: (row.sourceType as 'local' | 'youtube') || 'local',
      youtubeId: (row.youtubeId as string) ?? undefined,
      bpm: (row.analysisBpm as number) ?? (row.bpm as number) ?? undefined,
      camelotCode: (row.analysisCamelotCode as string) ?? (row.camelotCode as string) ?? undefined,
      musicalKey: (row.analysisMusicalKey as string) ?? (row.musicalKey as string) ?? undefined,
      energyLevel: (row.analysisEnergyLevel as number) ?? (row.energyLevel as number) ?? undefined
    };
  }
}
