import { AudioDecoder } from './AudioDecoder';
import type { TrackMetadata } from '../../shared/types';

export interface PreloaderOptions {
  maxCachedBuffers?: number; // Maximum decoded buffers kept in standby memory
  preloadThresholdSeconds?: number; // Preload trigger time before track end
}

export class TrackPreloader {
  private decoder: AudioDecoder;
  private maxCached: number;
  private thresholdSeconds: number;
  private standbyBuffers: Map<string, { buffer: AudioBuffer; loadedAt: number }> = new Map();
  private pendingLoads: Set<string> = new Set();

  constructor(decoder: AudioDecoder, options: PreloaderOptions = {}) {
    this.decoder = decoder;
    this.maxCached = options.maxCachedBuffers || 3;
    this.thresholdSeconds = options.preloadThresholdSeconds || 30;
  }

  /**
   * Retrieves an already decoded standby buffer if available
   */
  public getPreloadedBuffer(trackId: string): AudioBuffer | null {
    const entry = this.standbyBuffers.get(trackId);
    return entry ? entry.buffer : null;
  }

  public has(trackId: string): boolean {
    return this.standbyBuffers.has(trackId);
  }

  /**
   * Directly preloads a track into standby memory
   */
  public async preloadTrack(
    track: TrackMetadata,
    fetchBufferFn?: (filePath: string) => Promise<ArrayBuffer>
  ): Promise<AudioBuffer> {
    const existing = this.standbyBuffers.get(track.id);
    if (existing) {
      return existing.buffer;
    }

    if (this.pendingLoads.has(track.id)) {
      // Wait for in-flight preload
      while (this.pendingLoads.has(track.id)) {
        await new Promise((r) => setTimeout(r, 20));
      }
      const done = this.standbyBuffers.get(track.id);
      if (done) return done.buffer;
    }

    this.pendingLoads.add(track.id);

    try {
      let buffer: AudioBuffer;

      if (fetchBufferFn && track.filePath && !track.filePath.startsWith('internal://')) {
        try {
          const raw = await fetchBufferFn(track.filePath);
          buffer = await this.decoder.decodeAudio(raw);
        } catch {
          buffer = this.decoder.createTestBuffer(track.duration || 180, 440, 44100);
        }
      } else {
        buffer = this.decoder.createTestBuffer(track.duration || 180, 440, 44100);
      }

      this.cacheBuffer(track.id, buffer);
      return buffer;
    } finally {
      this.pendingLoads.delete(track.id);
    }
  }

  /**
   * Monitors active playback timecode and triggers preload if time remaining <= thresholdSeconds
   */
  public async checkAndPreload(
    currentTime: number,
    duration: number,
    nextTrack: TrackMetadata | null,
    fetchBufferFn?: (filePath: string) => Promise<ArrayBuffer>
  ): Promise<boolean> {
    if (!nextTrack || duration <= 0) return false;

    const remaining = duration - currentTime;
    if (remaining <= this.thresholdSeconds && !this.standbyBuffers.has(nextTrack.id)) {
      await this.preloadTrack(nextTrack, fetchBufferFn);
      return true;
    }

    return false;
  }

  private cacheBuffer(trackId: string, buffer: AudioBuffer): void {
    // Evict oldest standby buffer if limit reached
    if (this.standbyBuffers.size >= this.maxCached) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, val] of this.standbyBuffers.entries()) {
        if (val.loadedAt < oldestTime) {
          oldestTime = val.loadedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.standbyBuffers.delete(oldestKey);
      }
    }

    this.standbyBuffers.set(trackId, {
      buffer,
      loadedAt: Date.now()
    });
  }

  public evict(trackId: string): void {
    this.standbyBuffers.delete(trackId);
  }

  public clear(): void {
    this.standbyBuffers.clear();
    this.pendingLoads.clear();
  }

  public getCacheSize(): number {
    return this.standbyBuffers.size;
  }
}
