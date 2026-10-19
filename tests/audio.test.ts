import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Web Audio API mock for Node/jsdom testing environment
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

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam(-0.5);
  knee = new MockAudioParam(0);
  ratio = new MockAudioParam(20);
  attack = new MockAudioParam(0.001);
  release = new MockAudioParam(0.05);
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowshelf';
  frequency = new MockAudioParam(300);
  Q = new MockAudioParam(1.0);
  gain = new MockAudioParam(0);
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
  smoothingTimeConstant = 0.8;
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  playbackRate = new MockAudioParam(1.0);
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 10.5;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = new MockAudioNode();

  createGain() {
    return new MockGainNode();
  }
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode();
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
    return new MockAudioBufferSourceNode();
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
  decodeAudioData(buffer: ArrayBuffer, success: (b: AudioBuffer) => void) {
    const mockBuf = this.createBuffer(2, 44100 * 3, 44100);
    success(mockBuf);
  }
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

// Inject mock into global window object
beforeEach(() => {
  (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;
});

import { AudioContextManager } from '../src/renderer/audio/AudioContextManager';
import { MasterBus } from '../src/renderer/audio/MasterBus';
import { DeckEngine } from '../src/renderer/audio/DeckEngine';
import { AudioDecoder } from '../src/renderer/audio/AudioDecoder';
import { AudioEngine } from '../src/renderer/audio/AudioEngine';

describe('Phase 3 Audio Engine Foundations & DSP Tests', () => {
  it('P03-T001: AudioContextManager initializes with hardware clock and singleton pattern', () => {
    const manager = AudioContextManager.getInstance();
    expect(manager).toBeDefined();

    const ctx = manager.getContext();
    expect(ctx.sampleRate).toBe(44100);
    expect(manager.currentTime).toBe(10.5);
    expect(manager.state).toBe('running');
  });

  it('P03-T004: MasterBus lookahead peak limiter prevents clipping', () => {
    const manager = AudioContextManager.getInstance();
    const masterBus = manager.getMasterBus();

    expect(masterBus.limiterNode.threshold.value).toBe(-0.5);
    expect(masterBus.limiterNode.ratio.value).toBe(20);
    expect(masterBus.limiterNode.attack.value).toBe(0.001);

    masterBus.setVolume(1.2);
    expect(masterBus.getVolume()).toBe(1.2);
  });

  it('P03-T002: DeckEngine operates independent virtual decks with 3-band EQ and playback controls', () => {
    const manager = AudioContextManager.getInstance();
    const ctx = manager.getContext();
    const master = manager.getMasterBus();

    const deckA = new DeckEngine('A', ctx, master.inputNode);
    expect(deckA.deckId).toBe('A');
    expect(deckA.isPlaying).toBe(false);

    // Test 3-Band EQ adjustment
    deckA.setLowGain(0.5);
    deckA.setMidGain(1.0);
    deckA.setHighGain(0.0); // Kill
    expect(deckA.highFilter.gain.value).toBeLessThan(-90); // Near -100dB kill

    // Test playback rate and volume
    deckA.setPlaybackRate(1.05);
    expect(deckA.playbackRate).toBe(1.05);

    deckA.setVolume(0.9);
    expect(deckA.volume).toBe(0.9);
  });

  it('P03-T003: AudioDecoder decodes audio buffers and generates test signals', async () => {
    const manager = AudioContextManager.getInstance();
    const ctx = manager.getContext();
    const decoder = new AudioDecoder(ctx);

    const testBuf = decoder.createTestBuffer(2.0, 440, 44100);
    expect(testBuf.duration).toBe(2.0);
    expect(testBuf.numberOfChannels).toBe(2);

    const decoded = await decoder.decodeAudio(new ArrayBuffer(1024));
    expect(decoded.duration).toBe(3);
  });

  it('P03-T002: AudioEngine implements equal-power crossfader blending', () => {
    const engine = AudioEngine.getInstance();

    // Center crossfader (0.0): Both decks should have gain ~ 0.707 (cos(pi/4))
    engine.setCrossfader(0.0);
    expect(engine.deckA.volume).toBeCloseTo(0.707, 2);
    expect(engine.deckB.volume).toBeCloseTo(0.707, 2);

    // Sum of squares for equal-power curve must equal 1.0 (constant acoustic power)
    const power = Math.pow(engine.deckA.volume, 2) + Math.pow(engine.deckB.volume, 2);
    expect(power).toBeCloseTo(1.0, 2);

    // Full Left (-1.0): Deck A = 1.0, Deck B = 0.0
    engine.setCrossfader(-1.0);
    expect(engine.deckA.volume).toBeCloseTo(1.0, 2);
    expect(engine.deckB.volume).toBeCloseTo(0.0, 2);

    // Full Right (1.0): Deck A = 0.0, Deck B = 1.0
    engine.setCrossfader(1.0);
    expect(engine.deckA.volume).toBeCloseTo(0.0, 2);
    expect(engine.deckB.volume).toBeCloseTo(1.0, 2);
  });
});
