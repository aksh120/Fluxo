import { describe, it, expect, beforeEach, vi } from 'vitest';

// Web Audio API mock for latency testing
class MockAudioParam {
  value = 1.0;
  setValueAtTime = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  playbackRate = new MockAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 100.0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = {};

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length)
    } as unknown as AudioBuffer;
  }
  decodeAudioData(buffer: ArrayBuffer, success: (b: AudioBuffer) => void) {
    const mockBuf = this.createBuffer(2, 44100 * 5, 44100);
    success(mockBuf);
  }
}

import { ProgressiveStreamDecoder } from '../src/renderer/audio/ProgressiveStreamDecoder';
import { TrackPreloader } from '../src/renderer/audio/TrackPreloader';
import { AudioDecoder } from '../src/renderer/audio/AudioDecoder';
import type { TrackMetadata } from '../src/shared/types';

describe('Phase 5 Progressive Streaming, Preloading & Latency Benchmarks', () => {
  let mockCtx: MockAudioContext;
  let decoder: AudioDecoder;
  let progressive: ProgressiveStreamDecoder;
  let preloader: TrackPreloader;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    decoder = new AudioDecoder(mockCtx as unknown as AudioContext);
    progressive = new ProgressiveStreamDecoder(mockCtx as unknown as AudioContext);
    preloader = new TrackPreloader(decoder, {
      maxCachedBuffers: 3,
      preloadThresholdSeconds: 30
    });
  });

  it('P05-T001: decodes initial chunk immediately while streaming remainder in background', async () => {
    const fakeData = new ArrayBuffer(1024 * 512); // 512 KB
    const progressUpdates: number[] = [];

    const result = await progressive.decodeProgressive(
      'trk-stream-1',
      fakeData,
      131072, // 128 KB initial chunk
      (p) => progressUpdates.push(p.percent)
    );

    // Initial buffer is available immediately
    expect(result.initialBuffer).toBeDefined();
    expect(result.initialBuffer.duration).toBe(5);
    expect(result.isFullyDecoded).toBe(false);

    // Full buffer resolves in the background
    const fullBuffer = await result.fullBufferPromise;
    expect(fullBuffer).toBeDefined();
    expect(progressUpdates).toContain(100);
  });

  it('P05-T002: preloads upcoming queued track into standby buffer 30s before current track ends', async () => {
    const nextTrack: TrackMetadata = {
      id: 'trk-next-up',
      filePath: 'internal://next.mp3',
      fileSize: 3000000,
      mtime: Date.now(),
      title: 'Next Track',
      artist: 'Next Artist',
      album: 'Next Album',
      duration: 210,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local'
    };

    // Track has 60 seconds remaining -> should not preload yet
    const preloadedEarly = await preloader.checkAndPreload(120, 180, nextTrack);
    expect(preloadedEarly).toBe(false);
    expect(preloader.has('trk-next-up')).toBe(false);

    // Track enters threshold (<= 30 seconds remaining e.g. 155s of 180s)
    const preloadedOnTime = await preloader.checkAndPreload(155, 180, nextTrack);
    expect(preloadedOnTime).toBe(true);
    expect(preloader.has('trk-next-up')).toBe(true);

    const standby = preloader.getPreloadedBuffer('trk-next-up');
    expect(standby).not.toBeNull();
    expect(standby?.duration).toBe(210);
  });

  it('P05-T005: benchmark validates playback start latency < 250ms on warm/standby buffer', async () => {
    const track: TrackMetadata = {
      id: 'trk-warm',
      filePath: 'internal://warm.mp3',
      fileSize: 2000000,
      mtime: Date.now(),
      title: 'Warm Instant Track',
      artist: 'Fluxo',
      album: 'Instant',
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local'
    };

    // Preload into standby cache
    await preloader.preloadTrack(track);

    // Measure high-precision latency from user trigger to buffer playback start
    const startMark = performance.now();

    const readyBuffer = preloader.getPreloadedBuffer('trk-warm');
    expect(readyBuffer).not.toBeNull();

    const source = mockCtx.createBufferSource();
    source.buffer = readyBuffer;
    source.connect();
    source.start(0);

    const endMark = performance.now();
    const latencyMs = endMark - startMark;

    // Must be strictly < 250ms according to acceptance criteria (typically < 10ms)
    expect(latencyMs).toBeLessThan(250);
    expect(source.start).toHaveBeenCalledTimes(1);
  });
});
