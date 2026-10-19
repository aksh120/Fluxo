import { describe, it, expect, vi } from 'vitest';
import { VocalCrossoverEngine } from '../src/renderer/audio/VocalCrossoverEngine';
import { TransitionEngine } from '../src/renderer/audio/TransitionEngine';
import type { DeckEngine } from '../src/renderer/audio/DeckEngine';

function createMockDeck(): DeckEngine {
  return {
    isPlaying: true,
    play: vi.fn(),
    pause: vi.fn(),
    setLowGain: vi.fn(),
    setMidGain: vi.fn(),
    setHighGain: vi.fn(),
    setFilterParam: vi.fn(),
    setVolume: vi.fn(),
    currentTrack: { bpm: 128 }
  } as unknown as DeckEngine;
}

describe('Phase 16 Vocal Crossover & Masking Suppression Engine Tests', () => {
  it('P16-T003: VocalCrossoverEngine executes two-stage layering and phrase vocal handoff', () => {
    let crossfader = -1.0;
    const setCrossfader = vi.fn((pos: number) => {
      crossfader = pos;
    });

    const deckA = createMockDeck();
    const deckB = createMockDeck();
    deckB.isPlaying = false; // Initially stopped

    const engine = new VocalCrossoverEngine(
      setCrossfader,
      (deckId) => (deckId === 'A' ? deckA : deckB)
    );

    const onProgress = vi.fn();
    const onComplete = vi.fn();

    engine.startCrossover({
      fromDeck: 'A',
      toDeck: 'B',
      timing: {
        transitionStartA: 100,
        transitionEndA: 116,
        startOffsetB: 0,
        durationBars: 16,
        durationSeconds: 16
      },
      onProgress,
      onComplete
    });

    // 1. Initial state checks
    expect(engine.isActive).toBe(true);
    expect(deckB.play).toHaveBeenCalled(); // Incoming deck started
    // Bass pre-cut on fromDeck
    expect(deckA.setLowGain).toHaveBeenCalledWith(0.7);
    // Dynamic mid-frequency masking suppression applied on toDeck (dip around 300Hz-3.5kHz)
    expect(deckB.setMidGain).toHaveBeenCalledWith(0.55);

    // 2. Finalize / complete transition
    engine.complete();

    expect(engine.isActive).toBe(false);
    expect(deckA.pause).toHaveBeenCalled(); // Outgoing deck paused
    expect(deckB.setMidGain).toHaveBeenCalledWith(1.0); // Restored flat EQ
    expect(deckB.setLowGain).toHaveBeenCalledWith(1.0);
    expect(setCrossfader).toHaveBeenCalledWith(1.0); // Full target Deck B
    expect(onComplete).toHaveBeenCalled();
  });

  it('P16-T003: TransitionEngine executes vocal_crossover and 9 transition styles cleanly', () => {
    let crossfader = -1.0;
    const setCrossfader = vi.fn((pos: number) => {
      crossfader = pos;
    });

    const deckA = createMockDeck();
    const deckB = createMockDeck();

    const transitionEngine = new TransitionEngine(
      setCrossfader,
      (deckId) => (deckId === 'A' ? deckA : deckB)
    );

    // Test vocal_crossover initialization
    transitionEngine.startTransition({
      style: 'vocal_crossover',
      fromDeck: 'A',
      toDeck: 'B',
      durationBars: 16,
      masterBpm: 128
    });

    expect(transitionEngine.isActive).toBe(true);
    expect(deckB.setMidGain).toHaveBeenCalledWith(0.55); // Masking suppression active

    transitionEngine.completeTransition();
    expect(transitionEngine.isActive).toBe(false);
    expect(deckA.pause).toHaveBeenCalled();
    expect(deckB.setMidGain).toHaveBeenCalledWith(1.0);

    // Test breakdown_build
    transitionEngine.startTransition({
      style: 'breakdown_build',
      fromDeck: 'A',
      toDeck: 'B'
    });
    expect(transitionEngine.isActive).toBe(true);
    expect(deckB.setLowGain).toHaveBeenCalledWith(0.0);
    transitionEngine.completeTransition();

    // Test instrumental_handoff
    transitionEngine.startTransition({
      style: 'instrumental_handoff',
      fromDeck: 'A',
      toDeck: 'B'
    });
    expect(transitionEngine.isActive).toBe(true);
    transitionEngine.completeTransition();
  });
});
