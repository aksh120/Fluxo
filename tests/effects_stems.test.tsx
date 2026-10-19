import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LoopController, LoopLength } from '../src/renderer/audio/LoopController';
import { CuePointManager } from '../src/renderer/audio/CuePointManager';
import { AudioEffectsChain } from '../src/renderer/audio/AudioEffectsChain';
import { StemSeparationManager } from '../src/main/stems/StemSeparationManager';
import { StemDeckPlayer } from '../src/renderer/audio/StemDeckPlayer';
import { CuePads } from '../src/renderer/components/CuePads';
import { LoopControls } from '../src/renderer/components/LoopControls';
import { EffectControls } from '../src/renderer/components/EffectControls';
import { StemMixer } from '../src/renderer/components/StemMixer';
import { StudioView } from '../src/renderer/views/StudioView';
import { FluxoDatabase } from '../src/main/db/database';
import type { DeckState } from '../src/shared/types';

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

class MockDelayNode extends MockAudioNode {
  delayTime = new MockAudioParam(0.0);
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam(440);
  start = vi.fn();
  stop = vi.fn();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam(1000);
  Q = new MockAudioParam(1.0);
  gain = new MockAudioParam(0);
}

class MockAudioContext {
  currentTime = 10.0;
  sampleRate = 44100;
  state = 'running';
  destination = new MockAudioNode();

  createGain() {
    return new MockGainNode();
  }
  createDelay() {
    return new MockDelayNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn(() => new Float32Array(length))
    } as unknown as AudioBuffer;
  }
  createBufferSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0
    };
  }
}

// Mock Canvas 2D context and AudioContext for JSDOM
beforeEach(() => {
  (globalThis as any).AudioContext = MockAudioContext;
  (window as any).AudioContext = MockAudioContext;

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn()
    }),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1
  }) as any;
});

function createMockDeckState(deckId: 'A' | 'B'): DeckState {
  return {
    deckId,
    currentTrack: {
      id: `track-${deckId}`,
      filePath: 'C:/Music/test.mp3',
      fileSize: 4000000,
      mtime: Date.now(),
      title: `Deck ${deckId} Track`,
      artist: 'Fluxo Artist',
      album: 'Studio Test',
      duration: 240,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local',
      bpm: 120,
      camelotCode: '8A',
      energyLevel: 0.7
    },
    isPlaying: true,
    currentTime: 30,
    duration: 240,
    playbackRate: 1.0,
    volume: 0.8,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 1000,
    filterResonance: 1.0
  };
}

describe('Phase 10 Effects, Loops, Cue Points, Vocal Separation & Creative Mashups', () => {
  describe('P10-T001: Beat-Aligned Looping Engine', () => {
    it('activates beat-aligned loops, snapping accurately to beat grid', () => {
      const loop = new LoopController();
      const bpm = 120; // 0.5s per beat
      const currentPos = 14.1; // Between beats 28 (14.0s) and 29 (14.5s)

      // 4-beat loop (2.0s duration) snapped to downbeat 0.0s
      const state = loop.activateLoop(4, currentPos, bpm, 0.0);
      expect(state.isActive).toBe(true);
      expect(state.lengthBeats).toBe(4);
      expect(state.startPosition).toBeCloseTo(14.0, 2);
      expect(state.endPosition).toBeCloseTo(16.0, 2);
      expect(state.duration).toBeCloseTo(2.0, 2);
    });

    it('halves and doubles active loop lengths seamlessly', () => {
      const loop = new LoopController();
      loop.activateLoop(4, 10.0, 120);

      // Halve: 4 -> 2 beats (1.0s duration)
      const halved = loop.halveLoop();
      expect(halved.lengthBeats).toBe(2);
      expect(halved.duration).toBeCloseTo(1.0, 2);

      // Halve again: 2 -> 1 beat (0.5s duration)
      const halved2 = loop.halveLoop();
      expect(halved2.lengthBeats).toBe(1);
      expect(halved2.duration).toBeCloseTo(0.5, 2);

      // Double: 1 -> 2 beats
      const doubled = loop.doubleLoop();
      expect(doubled.lengthBeats).toBe(2);
      expect(doubled.duration).toBeCloseTo(1.0, 2);

      // Double again: 2 -> 4 beats
      const doubled2 = loop.doubleLoop();
      expect(doubled2.lengthBeats).toBe(4);
      expect(doubled2.duration).toBeCloseTo(2.0, 2);
    });

    it('manages loop exit, reloop, and sub-sample wrap boundaries', () => {
      const loop = new LoopController();
      loop.activateLoop(8, 20.0, 120); // 20.0s to 24.0s

      // Before boundary: does not wrap
      const check1 = loop.checkLoopWrap(22.5);
      expect(check1.wrapped).toBe(false);
      expect(check1.newPosition).toBe(22.5);

      // At/past boundary: wraps cleanly to startPosition
      const check2 = loop.checkLoopWrap(24.0);
      expect(check2.wrapped).toBe(true);
      expect(check2.newPosition).toBe(20.0);

      // Exit loop
      const exited = loop.exitLoop();
      expect(exited.isActive).toBe(false);

      const checkExited = loop.checkLoopWrap(24.5);
      expect(checkExited.wrapped).toBe(false);

      // Reloop
      const relooped = loop.reloop();
      expect(relooped.isActive).toBe(true);
      expect(relooped.startPosition).toBe(20.0);
    });
  });

  describe('P10-T002: Hot Cue Point Manager & Latency Benchmark', () => {
    it('sets, retrieves, and deletes hot cues on 8 color-coded pads', async () => {
      const cueManager = new CuePointManager();
      await cueManager.setTrack('test-track-1');

      // Set Cue 1 at 12.5s
      const cue1 = await cueManager.setCue(0, 12.5, 'Drop Intro');
      expect(cue1.timestamp).toBe(12.5);
      expect(cue1.color).toBe('#00F2FE');

      // Jump to Cue 1
      const start = performance.now();
      const jumpTime = cueManager.jumpToCue(0);
      const latencyMs = performance.now() - start;

      expect(jumpTime).toBe(12.5);
      expect(latencyMs).toBeLessThan(10); // < 10ms seek latency requirement

      // Empty pad returns null
      expect(cueManager.jumpToCue(3)).toBeNull();

      // Delete Cue 1
      const deleted = await cueManager.deleteCue(0);
      expect(deleted).toBe(true);
      expect(cueManager.jumpToCue(0)).toBeNull();
    });

    it('persists and loads hot cue points from FluxoDatabase', async () => {
      const db = new FluxoDatabase({ inMemory: true });
      const trackId = 'db-cues-track';

      db.upsertTrack({
        id: trackId,
        filePath: 'C:/Music/test-cue.mp3',
        fileSize: 4000000,
        mtime: Date.now(),
        title: 'Cue Test Track',
        artist: 'DJ SQLite',
        album: 'Test Album',
        duration: 200,
        sampleRate: 44100,
        channels: 2,
        format: 'mp3',
        sourceType: 'local'
      });

      db.saveCuePoint({
        id: 'cue-1',
        trackId,
        name: 'Hot Cue 1',
        timestamp: 45.2,
        type: 'cue',
        color: '#00F2FE'
      });

      db.saveCuePoint({
        id: 'cue-2',
        trackId,
        name: 'Hot Cue 2',
        timestamp: 90.0,
        type: 'drop',
        color: '#FE0979'
      });

      const cues = db.getCuePoints(trackId);
      expect(cues.length).toBe(2);
      expect(cues[0].timestamp).toBe(45.2);
      expect(cues[1].name).toBe('Hot Cue 2');

      const deleted = db.deleteCuePoint('cue-1');
      expect(deleted).toBe(true);
      expect(db.getCuePoints(trackId).length).toBe(1);

      db.close();
    });
  });

  describe('P10-T003: Beat-Synced Echo and Flanger DSP Effects', () => {
    it('calculates beat-synced delay times and adjusts wet/dry feedback', () => {
      const audioCtx = new AudioContext();
      const effects = new AudioEffectsChain(audioCtx);

      effects.setBpm(120); // 120 BPM -> 0.5s per beat

      // 1/2 beat echo -> 0.25s
      effects.setEchoBeat(0.5);
      effects.setEchoMix(0.4);
      effects.setEchoFeedback(0.5);

      const state1 = effects.getState();
      expect(state1.echoEnabled).toBe(true);
      expect(state1.echoBeat).toBe(0.5);
      expect(state1.echoMix).toBe(0.4);
      expect(state1.echoFeedback).toBe(0.5);

      // Flanger modulation adjustments
      effects.setFlangerMix(0.6);
      effects.setFlangerRate(1.2);

      const state2 = effects.getState();
      expect(state2.flangerEnabled).toBe(true);
      expect(state2.flangerMix).toBe(0.6);
      expect(state2.flangerRate).toBe(1.2);

      // Reset effects
      effects.reset();
      expect(effects.getState().echoEnabled).toBe(false);
      expect(effects.getState().flangerEnabled).toBe(false);
    });
  });

  describe('P10-T004 & P10-T006: Stem Separation & Cache Manager', () => {
    it('separates vocals and instrumental stems and manages local disk cache', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-stems-test-'));
      const manager = new StemSeparationManager({ cacheDir: tempDir });

      const trackId = 'test-song-stems';
      expect(manager.isStemsCached(trackId)).toBe(false);

      // Perform separation (using high-speed offline DSP engine)
      const result = await manager.separateStems(trackId, 'internal://test.mp3', 44100, 2);
      expect(result.trackId).toBe(trackId);
      expect(fs.existsSync(result.vocalsPath)).toBe(true);
      expect(fs.existsSync(result.instrumentalPath)).toBe(true);
      expect(manager.isStemsCached(trackId)).toBe(true);

      // Check cache stats
      const stats = await manager.getCacheStats();
      expect(stats.trackCount).toBe(1);
      expect(stats.totalBytes).toBeGreaterThan(1000);

      // Clear cache
      const clearResult = await manager.clearCache();
      expect(clearResult.deletedCount).toBeGreaterThan(0);
      expect(manager.isStemsCached(trackId)).toBe(false);

      // Clean up temp test directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });
  });

  describe('P10-T005: Stem Mixer & Audio Acapella Mashups', () => {
    it('controls independent vocal and instrumental levels with mute and solo modes', () => {
      const audioCtx = new AudioContext();
      const output = audioCtx.createGain();
      const player = new StemDeckPlayer(audioCtx, output);

      // Create test stem audio buffers (1s stereo)
      const vocalBuf = audioCtx.createBuffer(2, 44100, 44100);
      const instBuf = audioCtx.createBuffer(2, 44100, 44100);

      player.loadStems(vocalBuf, instBuf);
      expect(player.getState().hasStems).toBe(true);

      // Set volume levels
      player.setVocalVolume(0.75);
      player.setInstrumentalVolume(0.9);
      expect(player.getState().vocalVolume).toBe(0.75);
      expect(player.getState().instrumentalVolume).toBe(0.9);

      // Vocal Solo (Acapella mode)
      player.setVocalSolo(true);
      expect(player.getState().isVocalSolo).toBe(true);
      expect(player.getState().isInstrumentalSolo).toBe(false);

      // Instrumental Solo (Dub / Beat mode)
      player.setInstrumentalSolo(true);
      expect(player.getState().isInstrumentalSolo).toBe(true);
      expect(player.getState().isVocalSolo).toBe(false);

      // Mute toggles
      player.setVocalMute(true);
      expect(player.getState().isVocalMuted).toBe(true);
    });
  });

  describe('Interactive StudioView UI Tabs: Cues, Loops, FX, and Stems', () => {
    it('renders StudioView and toggles between performance tabs', () => {
      const deckA = createMockDeckState('A');
      const deckB = createMockDeckState('B');

      render(
        <StudioView
          deckA={deckA}
          deckB={deckB}
          onUpdateDeckA={vi.fn()}
          onUpdateDeckB={vi.fn()}
          crossfaderPos={0}
          onCrossfaderChange={vi.fn()}
        />
      );

      // Deck A default tab: HOT CUES
      expect(screen.getByTestId('deck-a-tab-cues')).toBeDefined();
      expect(screen.getByTestId('cue-pad-A-1')).toBeDefined();

      // Switch to LOOPS
      const loopTabA = screen.getByTestId('deck-a-tab-loops');
      fireEvent.click(loopTabA);
      expect(screen.getByTestId('loop-toggle-A')).toBeDefined();
      expect(screen.getByTestId('loop-btn-A-4')).toBeDefined();

      // Switch to DSP FX
      const fxTabA = screen.getByTestId('deck-a-tab-fx');
      fireEvent.click(fxTabA);
      expect(screen.getByText('ECHO / DELAY')).toBeDefined();
      expect(screen.getByText('FLANGER')).toBeDefined();

      // Switch to STEMS
      const stemsTabA = screen.getByTestId('deck-a-tab-stems');
      fireEvent.click(stemsTabA);
      expect(screen.getByText('STEM ISOLATION MIXER')).toBeDefined();
      expect(screen.getByText('VOCALS')).toBeDefined();
      expect(screen.getByText('INSTRUMENTAL')).toBeDefined();
    });
  });
});
