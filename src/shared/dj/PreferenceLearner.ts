import type { TrackMetadata, PlayHistoryEntry, TrackFeedbackStats } from '../types';

export interface StorageBackend {
  recordPlayEvent: (entry: PlayHistoryEntry) => void | Promise<void>;
  getTrackFeedbackStats: (trackId: string) => TrackFeedbackStats | Promise<TrackFeedbackStats>;
  getArtistAffinity: (artist: string) => number | Promise<number>;
}

export interface InMemTrackStats {
  completedCount: number;
  skipCount: number;
  liked: boolean;
}

export class PreferenceLearner {
  private inMemTrackStats: Map<string, InMemTrackStats> = new Map();
  private inMemArtistAffinity: Map<string, { completed: number; skipped: number }> = new Map();
  private storage?: StorageBackend;

  constructor(storage?: StorageBackend) {
    this.storage = storage;
  }

  /**
   * Records a completed track play (> 75% or natural transition).
   */
  public async recordCompletion(track: TrackMetadata, durationPlayed: number): Promise<void> {
    const entry: PlayHistoryEntry = {
      id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      trackId: track.id,
      playedAt: Date.now(),
      durationPlayed: Math.max(0, durationPlayed),
      completed: true
    };

    // Update in-memory cache
    const stats = this.getOrCreateTrackStats(track.id);
    stats.completedCount++;

    if (track.artist) {
      const art = track.artist.trim().toLowerCase();
      const artistEntry = this.getOrCreateArtistEntry(art);
      artistEntry.completed++;
    }

    if (this.storage) {
      await this.storage.recordPlayEvent(entry);
    }
  }

  /**
   * Records a skipped track. If skipped within 30s (or < 20% duration),
   * counts as an early skip penalty.
   */
  public async recordSkip(track: TrackMetadata, durationPlayed: number): Promise<void> {
    const isEarlySkip = durationPlayed < 30 || (track.duration > 0 && durationPlayed / track.duration < 0.2);

    const entry: PlayHistoryEntry = {
      id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      trackId: track.id,
      playedAt: Date.now(),
      durationPlayed: Math.max(0, durationPlayed),
      completed: false,
      skippedAt: durationPlayed
    };

    const stats = this.getOrCreateTrackStats(track.id);
    if (isEarlySkip) {
      stats.skipCount++;
      if (track.artist) {
        const art = track.artist.trim().toLowerCase();
        const artistEntry = this.getOrCreateArtistEntry(art);
        artistEntry.skipped++;
      }
    }

    if (this.storage) {
      await this.storage.recordPlayEvent(entry);
    }
  }

  /**
   * Records a user like / favorite toggle.
   */
  public async recordLike(track: TrackMetadata, liked: boolean): Promise<void> {
    const stats = this.getOrCreateTrackStats(track.id);
    stats.liked = liked;

    const entry: PlayHistoryEntry = {
      id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      trackId: track.id,
      playedAt: Date.now(),
      durationPlayed: 0,
      completed: true,
      liked
    };

    if (this.storage) {
      await this.storage.recordPlayEvent(entry);
    }
  }

  /**
   * Computes a local preference score modifier (-0.5 to +0.3) for a given track,
   * combining individual track skip/completion history with overall artist affinity.
   */
  public getScoreAdjustment(track: TrackMetadata): number {
    const stats = this.inMemTrackStats.get(track.id);
    let adjustment = 0;

    if (stats) {
      if (stats.liked) {
        adjustment += 0.25;
      }
      if (stats.completedCount > 0) {
        adjustment += Math.min(0.20, stats.completedCount * 0.05);
      }
      if (stats.skipCount > 0) {
        // -0.15 for first skip, up to -0.45 for repeated skips
        adjustment -= Math.min(0.45, stats.skipCount * 0.15);
      }
    }

    // Blend artist affinity (-0.15 to +0.10)
    if (track.artist) {
      const artistAffinity = this.getArtistAffinity(track.artist);
      adjustment += artistAffinity * 0.15;
    }

    return Math.max(-0.5, Math.min(0.3, Math.round(adjustment * 100) / 100));
  }

  /**
   * Returns artist affinity in range -1.0 to +1.0.
   */
  public getArtistAffinity(artist: string): number {
    const art = artist.trim().toLowerCase();
    const entry = this.inMemArtistAffinity.get(art);
    if (!entry) return 0.0;

    const total = entry.completed + entry.skipped;
    if (total === 0) return 0.0;

    // Skips weigh slightly heavier than completions (-1.5x)
    return Math.max(-1.0, Math.min(1.0, (entry.completed - entry.skipped * 1.5) / (total + 2)));
  }

  /**
   * Returns in-memory stats for track
   */
  public getTrackStats(trackId: string): InMemTrackStats {
    return {
      completedCount: this.inMemTrackStats.get(trackId)?.completedCount ?? 0,
      skipCount: this.inMemTrackStats.get(trackId)?.skipCount ?? 0,
      liked: this.inMemTrackStats.get(trackId)?.liked ?? false
    };
  }

  private getOrCreateTrackStats(trackId: string): InMemTrackStats {
    let s = this.inMemTrackStats.get(trackId);
    if (!s) {
      s = { completedCount: 0, skipCount: 0, liked: false };
      this.inMemTrackStats.set(trackId, s);
    }
    return s;
  }

  private getOrCreateArtistEntry(artist: string): { completed: number; skipped: number } {
    let a = this.inMemArtistAffinity.get(artist);
    if (!a) {
      a = { completed: 0, skipped: 0 };
      this.inMemArtistAffinity.set(artist, a);
    }
    return a;
  }
}
