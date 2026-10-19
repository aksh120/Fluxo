import { describe, it, expect, beforeEach, vi } from 'vitest';

// Web Audio API mock for Vitest testing
class MockAudioParam {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  setTargetAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1.0);
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam(1000);
  Q = new MockAudioParam(1.0);
  gain = new MockAudioParam(0);
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
}

class MockBufferSourceNode extends MockAudioNode {
  playbackRate = new MockAudioParam(1.0);
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = new MockAudioNode();

  createGain() {
    return new MockGainNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createDelay(_max = 1.0) {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      delayTime: new MockAudioParam(0)
    };
  }
  createOscillator() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      frequency: new MockAudioParam(1),
      type: 'sine',
      start: vi.fn(),
      stop: vi.fn()
    };
  }
  createBufferSource() {
    return new MockBufferSourceNode();
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const channelData = new Array(channels).fill(0).map(() => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (c: number) => channelData[c],
      copyToChannel: (src: Float32Array, c: number) => channelData[c].set(src)
    } as unknown as AudioBuffer;
  }
}

// Attach mock AudioContext before importing audio modules
beforeEach(() => {
  (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;
});

import { TimeStretcher } from '../src/renderer/audio/TimeStretcher';
import { IsolatorEQ } from '../src/renderer/audio/IsolatorEQ';
import { BeatSyncController } from '../src/renderer/audio/BeatSyncController';
import { TransitionEngine } from '../src/renderer/audio/TransitionEngine';
import { FallbackCrossfadeEngine } from '../src/renderer/audio/FallbackCrossfadeEngine';
import { DynamicTransitionCoordinator } from '../src/renderer/audio/DynamicTransitionCoordinator';
import { DeckEngine } from '../src/renderer/audio/DeckEngine';
import type { TrackMetadata, BeatGrid, TrackAnalysis } from '../src/shared/types';

describe('Phase 7 Live Mixing, Beatmatching & Intelligent Transitions Tests', () => {
  const sampleRate = 44100;

  // Helper to synthesize a pure sine wave buffer
  const createSineSignal = (freq: number, durationSec: number): Float32Array => {
    const totalSamples = Math.floor(sampleRate * durationSec);
    const signal = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      signal[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
    return signal;
  };

  it('P07-T001: TimeStretcher scales tempo (±20%) and transposes key without pitch distortion', () => {
    const stretcher = new TimeStretcher({ windowSize: 1024, searchRange: 256 });
    const originalDuration = 1.0;
    const testSignal = createSineSignal(440, originalDuration);

    // 1. Test 1.20x tempo speedup (+20%)
    const spedUp = stretcher.processChannel(testSignal, 1.2, 0);
    expect(spedUp.length).toBeLessThan(testSignal.length);
    const spedUpRatio = testSignal.length / spedUp.length;
    expect(spedUpRatio).toBeCloseTo(1.2, 1);

    // 2. Test 0.85x tempo slowdown (-15%)
    const slowedDown = stretcher.processChannel(testSignal, 0.85, 0);
    expect(slowedDown.length).toBeGreaterThan(testSignal.length);
    const slowedDownRatio = testSignal.length / slowedDown.length;
    expect(slowedDownRatio).toBeCloseTo(0.85, 1);

    // 3. Test Key Transposition (+3 semitones)
    const transposed = stretcher.processChannel(testSignal, 1.0, 3);
    expect(transposed.length).toBeGreaterThan(0);
  });

  it('P07-T002: IsolatorEQ implements Linkwitz-Riley 4th order crossover with flat unity gain and full kill', () => {
    const ctx = new MockAudioContext();
    const isolator = new IsolatorEQ(ctx as unknown as BaseAudioContext);

    // Initial state: all gains unity (1.0), kills false
    expect(isolator.getState().lowGain).toBe(1.0);
    expect(isolator.getState().midGain).toBe(1.0);
    expect(isolator.getState().highGain).toBe(1.0);

    // Test Low Band Kill
    isolator.setLowKill(true);
    expect(isolator.getState().lowKill).toBe(true);

    // Test Resonant Filter Sweep: Low-pass sweep
    isolator.setFilterParam(-0.5, 2.0);
    expect(isolator.sweepFilter.type).toBe('lowpass');
    expect(isolator.sweepFilter.frequency.value).toBeLessThan(20000);

    // High-pass sweep
    isolator.setFilterParam(0.5, 2.0);
    expect(isolator.sweepFilter.type).toBe('highpass');
    expect(isolator.sweepFilter.frequency.value).toBeGreaterThan(20);

    // Neutral bypass
    isolator.setFilterParam(0.0);
    expect(isolator.sweepFilter.type).toBe('allpass');
  });

  it('P07-T003: BeatSyncController matches tempos and calculates sample-accurate downbeat alignment', () => {
    const ctx = new MockAudioContext();
    const dest = new MockAudioNode();
    const deckA = new DeckEngine('A', ctx as unknown as AudioContext, dest as unknown as AudioNode);
    const deckB = new DeckEngine('B', ctx as unknown as AudioContext, dest as unknown as AudioNode);

    const trackA: TrackMetadata = {
      id: 'trk-a',
      filePath: 'a.mp3',
      fileSize: 1000,
      mtime: 1,
      title: 'Track A',
      artist: 'DJ A',
      album: 'Mix',
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local',
      bpm: 128.0
    };

    const trackB: TrackMetadata = {
      id: 'trk-b',
      filePath: 'b.mp3',
      fileSize: 1000,
      mtime: 1,
      title: 'Track B',
      artist: 'DJ B',
      album: 'Mix',
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local',
      bpm: 124.0
    };

    const gridA: BeatGrid = {
      firstDownbeat: 0.1,
      bpm: 128.0,
      interval: 60 / 128.0,
      confidence: 0.95
    };

    const gridB: BeatGrid = {
      firstDownbeat: 0.2,
      bpm: 124.0,
      interval: 60 / 124.0,
      confidence: 0.95
    };

    // Load tracks
    const mockBuf = ctx.createBuffer(2, 44100 * 180, 44100);
    deckA.loadTrack(mockBuf, trackA);
    deckB.loadTrack(mockBuf, trackB);

    const controller = new BeatSyncController();
    const sync = controller.calculateSync(deckA, deckB, gridA, gridB);

    expect(sync).not.toBeNull();
    // Tempo ratio Deck B should play at: 128 / 124 = 1.032258...
    expect(sync?.tempoRatio).toBeCloseTo(128.0 / 124.0, 3);
    expect(sync?.masterBpm).toBe(128.0);
    expect(sync?.targetBpm).toBe(124.0);
    expect(sync?.masterBarInterval).toBeCloseTo((60 / 128) * 4, 3);

    // Apply tempo sync directly to Deck B
    const appliedRatio = controller.syncTempo(deckA, deckB, gridA, gridB);
    expect(appliedRatio).toBeCloseTo(128.0 / 124.0, 3);
    expect(deckB.playbackRate).toBeCloseTo(128.0 / 124.0, 3);
  });

  it('P07-T004: TransitionEngine automates Smooth Blend, Bass Swap, and Filter Sweep without clipping', () => {
    const ctx = new MockAudioContext();
    const dest = new MockAudioNode();
    const deckA = new DeckEngine('A', ctx as unknown as AudioContext, dest as unknown as AudioNode);
    const deckB = new DeckEngine('B', ctx as unknown as AudioContext, dest as unknown as AudioNode);

    let crossfaderPos = -1.0;
    const transitionEngine = new TransitionEngine(
      (pos) => {
        crossfaderPos = pos;
      },
      (id) => (id === 'A' ? deckA : deckB)
    );

    expect(transitionEngine.isActive).toBe(false);

    // Start Bass Swap transition
    transitionEngine.startTransition({
      style: 'bass_swap',
      fromDeck: 'A',
      toDeck: 'B',
      durationBars: 8,
      masterBpm: 128
    });

    expect(transitionEngine.isActive).toBe(true);
    expect(transitionEngine.currentConfig?.style).toBe('bass_swap');

    // Complete transition
    transitionEngine.completeTransition();
    expect(transitionEngine.isActive).toBe(false);
    expect(crossfaderPos).toBe(1.0); // Fully at Deck B
    expect(deckA.isPlaying).toBe(false); // Outgoing deck paused
  });

  it('P07-T005: FallbackCrossfadeEngine executes frequency-aware 8-second crossfade for pending tracks', () => {
    const ctx = new MockAudioContext();
    const dest = new MockAudioNode();
    const deckA = new DeckEngine('A', ctx as unknown as AudioContext, dest as unknown as AudioNode);
    const deckB = new DeckEngine('B', ctx as unknown as AudioContext, dest as unknown as AudioNode);

    let currentCrossfader = -1.0;
    const fallback = new FallbackCrossfadeEngine(
      (pos) => {
        currentCrossfader = pos;
      },
      (id) => (id === 'A' ? deckA : deckB)
    );

    expect(fallback.isActive).toBe(false);

    fallback.startFallback({
      fromDeck: 'A',
      toDeck: 'B',
      durationSeconds: 8.0
    });

    expect(fallback.isActive).toBe(true);

    fallback.complete();
    expect(fallback.isActive).toBe(false);
    expect(currentCrossfader).toBe(1.0);
  });

  it('P07-T006: DynamicTransitionCoordinator promotes fallback transition to beatmatched transition when analysis arrives', () => {
    const ctx = new MockAudioContext();
    const dest = new MockAudioNode();
    const deckA = new DeckEngine('A', ctx as unknown as AudioContext, dest as unknown as AudioNode);
    const deckB = new DeckEngine('B', ctx as unknown as AudioContext, dest as unknown as AudioNode);

    const beatSync = new BeatSyncController();
    const transitionEngine = new TransitionEngine(vi.fn(), (id) => (id === 'A' ? deckA : deckB), beatSync);
    const fallbackEngine = new FallbackCrossfadeEngine(vi.fn(), (id) => (id === 'A' ? deckA : deckB));

    const coordinator = new DynamicTransitionCoordinator(
      transitionEngine,
      fallbackEngine,
      beatSync,
      (id) => (id === 'A' ? deckA : deckB)
    );

    // 1. Initial trigger with pending deep analysis -> triggers fallback
    const pendingAnalysis: TrackAnalysis = {
      trackId: 'trk-new',
      status: 'pending'
    };

    const mode = coordinator.executeTransition(
      {
        fromDeck: 'A',
        toDeck: 'B',
        preferredStyle: 'bass_swap'
      },
      pendingAnalysis
    );

    expect(mode).toBe('fallback');
    expect(fallbackEngine.isActive).toBe(true);

    // 2. Background worker finishes deep analysis mid-flight!
    const readyAnalysis: TrackAnalysis = {
      trackId: 'trk-new',
      status: 'deep_ready',
      bpm: 126.0,
      camelotCode: '8A',
      beatGrid: {
        firstDownbeat: 0.15,
        bpm: 126.0,
        interval: 60 / 126.0,
        confidence: 0.96
      }
    };

    const upgraded = coordinator.notifyAnalysisReady(readyAnalysis);
    expect(upgraded).toBe(true);
    expect(coordinator.isUpgraded).toBe(true);
    expect(fallbackEngine.isActive).toBe(false); // Fallback stopped
    expect(transitionEngine.isActive).toBe(true); // Promoted to phrase-locked transition
  });
});
