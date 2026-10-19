import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TrackMetadata } from '../src/shared/types';

// Mock Web Audio API
class MockAudioParam {
  value: number;
  constructor(initial: number) {
    this.value = initial;
  }
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  setTargetAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  cancelScheduledValues = vi.fn();
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1.0);
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowshelf';
  frequency = new MockAudioParam(1000);
  Q = new MockAudioParam(1.0);
  gain = new MockAudioParam(0);
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
  smoothingTimeConstant = 0.8;
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam(-0.5);
  knee = new MockAudioParam(0);
  ratio = new MockAudioParam(20);
  attack = new MockAudioParam(0.001);
  release = new MockAudioParam(0.05);
}

class MockBufferSourceNode extends MockAudioNode {
  buffer: any = null;
  playbackRate = new MockAudioParam(1.0);
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
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
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode();
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
  decodeAudioData(_buf: ArrayBuffer, success?: (ab: AudioBuffer) => void) {
    const audioBuf = this.createBuffer(2, 44100 * 180, 44100);
    if (success) success(audioBuf);
    return Promise.resolve(audioBuf);
  }
}

// Attach mock AudioContext to global/window
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).window = globalThis;
(window as any).AudioContext = MockAudioContext;

// Mock window.fluxoAPI
(window as any).fluxoAPI = {
  readAudioFile: vi.fn(async () => new ArrayBuffer(1024)),
  getPlatformInfo: vi.fn(async () => ({ platform: 'win32', arch: 'x64' })),
  getLibraryTracks: vi.fn(async () => []),
  onTrackAdded: vi.fn(),
  onScanProgress: vi.fn()
};

import { DeckEngine } from '../src/renderer/audio/DeckEngine';
import { AudioEngine } from '../src/renderer/audio/AudioEngine';
import { AudioContextManager } from '../src/renderer/audio/AudioContextManager';
import { AutopilotEngine } from '../src/renderer/audio/AutopilotEngine';

function createSampleTrack(id: string, title: string, duration: number = 185, bpm: number = 126): TrackMetadata {
  return {
    id,
    title,
    artist: 'Test Artist',
    album: 'Test Album',
    duration,
    bpm,
    key: '8A',
    energy: 0.75,
    filePath: `C:/Music/${id}.mp3`,
    fileSize: 4096000,
    format: 'mp3',
    dateAdded: Date.now()
  };
}

describe('Autopilot Playback Lifecycle & End-Of-Track Recovery (P17-T009)', () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    (AudioEngine as any).instance = null;
    (AudioContextManager as any).instance = null;
    (AutopilotEngine as any).instance = null;
    ctx = new MockAudioContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DeckEngine emits onTrackEnded when track naturally finishes at EOF', () => {
    const masterBusNode = new MockAudioNode();
    const deck = new DeckEngine('A', ctx as unknown as AudioContext, masterBusNode as unknown as AudioNode);

    const testTrack = createSampleTrack('track-1', 'Barsaat - Banjaare', 185);
    const testBuffer = ctx.createBuffer(2, 44100 * 185, 44100);
    deck.loadTrack(testBuffer, testTrack);

    expect(deck.hasBuffer()).toBe(true);
    expect(deck.duration).toBe(185);

    const onTrackEndedSpy = vi.fn();
    const unsub = deck.onTrackEnded(onTrackEndedSpy);

    deck.play(0);
    expect(deck.getState().isPlaying).toBe(true);

    // Fast-forward context time to track end
    ctx.currentTime = 184.9;

    // Trigger buffer source onended callback
    const sourceNode = (deck as any).sourceNode as MockBufferSourceNode;
    expect(sourceNode).toBeDefined();
    sourceNode.onended?.();

    expect(onTrackEndedSpy).toHaveBeenCalledTimes(1);
    expect(onTrackEndedSpy).toHaveBeenCalledWith('A', testTrack);
    expect(deck.getState().isPlaying).toBe(false);

    unsub();
  });

  it('DeckEngine does not emit onTrackEnded on manual pause or early stop', () => {
    const masterBusNode = new MockAudioNode();
    const deck = new DeckEngine('A', ctx as unknown as AudioContext, masterBusNode as unknown as AudioNode);
    const testTrack = createSampleTrack('track-1', 'Barsaat - Banjaare', 185);
    const testBuffer = ctx.createBuffer(2, 44100 * 185, 44100);
    deck.loadTrack(testBuffer, testTrack);

    const onTrackEndedSpy = vi.fn();
    deck.onTrackEnded(onTrackEndedSpy);

    deck.play(0);
    ctx.currentTime = 45.0; // Midway through song

    deck.pause();
    expect(onTrackEndedSpy).not.toHaveBeenCalled();
    expect(deck.getState().isPlaying).toBe(false);
  });

  it('AudioEngine forwards onTrackEnded events from virtual decks and attaches to window', () => {
    const engine = AudioEngine.getInstance();
    expect((window as any).__fluxoAudioEngine).toBe(engine);

    const engineTrackEndedSpy = vi.fn();
    const unsub = engine.onTrackEnded(engineTrackEndedSpy);

    const testTrack = createSampleTrack('track-2', 'Boom Shaka', 210);
    const testBuffer = ctx.createBuffer(2, 44100 * 210, 44100);
    engine.deckA.loadTrack(testBuffer, testTrack);

    engine.deckA.play(0);
    (engine.deckA as any).context.currentTime = 209.95;

    const source = (engine.deckA as any).sourceNode as MockBufferSourceNode;
    source.onended?.();

    expect(engineTrackEndedSpy).toHaveBeenCalledWith('A', testTrack);
    unsub();
  });

  it('Autopilot checkAutoTransition triggers anticipatory transition before track ends', async () => {
    const autopilot = AutopilotEngine.getInstance();
    autopilot.reset();

    const track1 = createSampleTrack('t1', 'Song 1', 180);
    const track2 = createSampleTrack('t2', 'Song 2', 200);
    autopilot.setLibrary([track1, track2]);

    const executeSpy = vi.spyOn(autopilot, 'executeAutonomousTransition');

    await autopilot.startSession(track1);
    expect(autopilot.getState()).toBe('playing');
    expect(autopilot.getActiveDeckId()).toBe('A');

    // 168s elapsed on 180s track: remaining = 12s (<= triggerWindow of 16s)
    autopilot.checkAutoTransition(168, 180);

    expect(executeSpy).toHaveBeenCalled();
  });

  it('Autopilot handleTrackEnded executes guaranteed emergency fallback when song ends before transition', async () => {
    const autopilot = AutopilotEngine.getInstance();
    autopilot.reset();

    const track1 = createSampleTrack('t1', 'First Song', 180);
    const track2 = createSampleTrack('t2', 'Second Song', 200);
    autopilot.setLibrary([track1, track2]);

    await autopilot.startSession(track1);
    expect(autopilot.getActiveDeckId()).toBe('A');
    expect(autopilot.getState()).toBe('playing');

    // Track on Deck A unexpectedly hits EOF
    autopilot.handleTrackEnded('A', track1);

    expect(autopilot.getState()).toBe('transitioning');
  });

  it('Autopilot notifies onTrackChange when starting session and switching decks', async () => {
    const autopilot = AutopilotEngine.getInstance();
    autopilot.reset();

    const track1 = createSampleTrack('t1', 'Track Alpha', 180);
    const track2 = createSampleTrack('t2', 'Track Beta', 210);
    autopilot.setLibrary([track1, track2]);

    const trackChangeSpy = vi.fn();
    const unsub = autopilot.onTrackChange(trackChangeSpy);

    await autopilot.startSession(track1);

    expect(trackChangeSpy).toHaveBeenCalledWith(track1, 'A');

    // Fast-forward transition completion to Deck B
    const upcoming = autopilot.getUpcomingQueue()[0];
    (autopilot as any).completeAutonomousTransition('A', 'B', upcoming, false);

    expect(autopilot.getActiveDeckId()).toBe('B');
    expect(autopilot.getCurrentTrack()?.id).toBe(track2.id);
    expect(trackChangeSpy).toHaveBeenCalledWith(track2, 'B');

    unsub();
  });

  it('Autopilot standby buffer check verifies buffer readiness before transition start', async () => {
    const autopilot = AutopilotEngine.getInstance();
    autopilot.reset();

    const track1 = createSampleTrack('t1', 'Track 1', 180);
    const track2 = createSampleTrack('t2', 'Track 2', 200);
    autopilot.setLibrary([track1, track2]);

    await autopilot.startSession(track1);

    const prepareSpy = vi.spyOn(autopilot, 'prepareNextTrack');

    // Simulate standby deck without buffer
    const engine = AudioEngine.getInstance();
    (engine.deckB as any).currentBuffer = null;

    await autopilot.executeAutonomousTransition();

    expect(prepareSpy).toHaveBeenCalled();
  });

  it('Autopilot recovers cleanly to next queue candidate if track decoding fails', async () => {
    const autopilot = AutopilotEngine.getInstance();
    autopilot.reset();

    const track1 = createSampleTrack('t1', 'Track 1', 180);
    const trackCorrupt = createSampleTrack('t-corrupt', 'Corrupt Track', 180);
    const track3 = createSampleTrack('t3', 'Track 3', 200);

    autopilot.setLibrary([track1, trackCorrupt, track3]);
    await autopilot.startSession(track1);

    // Mock readAudioFile failure for corrupt track
    (window as any).fluxoAPI.readAudioFile.mockRejectedValueOnce(new Error('Corrupt audio header'));

    const handleFailureSpy = vi.spyOn(autopilot as any, 'handleTrackLoadFailure');

    // Execute transition which attempts to prepare corrupt track
    await autopilot.executeAutonomousTransition();

    expect(handleFailureSpy).toHaveBeenCalled();
    // Autopilot recovers and does not freeze
    expect(autopilot.getState()).not.toBe('error');
  });

  it('Autopilot autonomous monitor ticker continuously evaluates checkAutoTransition', async () => {
    vi.useFakeTimers();

    const autopilot = AutopilotEngine.getInstance();
    autopilot.reset();

    const track1 = createSampleTrack('t1', 'Track 1', 180);
    const track2 = createSampleTrack('t2', 'Track 2', 200);
    autopilot.setLibrary([track1, track2]);

    const checkAutoSpy = vi.spyOn(autopilot, 'checkAutoTransition');

    await autopilot.startSession(track1);

    // Mock deck A position
    const engine = AudioEngine.getInstance();
    vi.spyOn(engine.deckA, 'currentTime', 'get').mockReturnValue(165);
    vi.spyOn(engine.deckA, 'duration', 'get').mockReturnValue(180);

    // Advance timer by 250ms
    vi.advanceTimersByTime(250);

    expect(checkAutoSpy).toHaveBeenCalledWith(165, 180);

    autopilot.stopSession();
    vi.useRealTimers();
  });
});
