import { describe, it, expect, vi } from 'vitest';
import { DjStudioModeManager } from '../src/renderer/audio/DjStudioModeManager';
import type { TransitionPlan } from '../src/renderer/audio/TransitionPlanner';

describe('Phase 16 DjStudioModeManager Tests', () => {
  const mockPlan: TransitionPlan = {
    family: 'bass_swap',
    confidence: 0.95,
    factors: {
      tempoScore: 1.0,
      keyScore: 1.0,
      phraseScore: 1.0,
      vocalScore: 0.9,
      energyScore: 0.9,
      stemAvailability: false
    },
    timing: {
      transitionStartA: 160,
      transitionEndA: 190,
      startOffsetB: 0,
      durationBars: 16,
      durationSeconds: 30
    },
    explanation: 'Harmonically compatible bass swap on the 1.',
    isFallback: false
  };

  it('P16-T006: automatically triggers transition at transitionStartA in automatic mode', () => {
    const onAutoTrigger = vi.fn();
    const onStatus = vi.fn();

    const manager = new DjStudioModeManager({
      onAutoTriggerTransition: onAutoTrigger,
      onStatusUpdate: onStatus
    });

    manager.setPlan(mockPlan);

    // Track at 100s (before transitionStartA 160s) -> no trigger
    manager.checkPlaybackProgress(100, 200);
    expect(onAutoTrigger).not.toHaveBeenCalled();

    // Track reaches 160.5s -> triggers!
    manager.checkPlaybackProgress(160.5, 200);
    expect(onAutoTrigger).toHaveBeenCalledWith(mockPlan);

    // Second check does not re-trigger repeatedly
    manager.checkPlaybackProgress(162, 200);
    expect(onAutoTrigger).toHaveBeenCalledTimes(1);
  });

  it('P16-T006: does not auto trigger in assisted or manual mode', () => {
    const onAutoTrigger = vi.fn();

    const manager = new DjStudioModeManager({
      onAutoTriggerTransition: onAutoTrigger
    });

    manager.setPlan(mockPlan);
    manager.setMode('assisted');

    // Track reaches 165s in assisted mode -> no automatic execution
    manager.checkPlaybackProgress(165, 200);
    expect(onAutoTrigger).not.toHaveBeenCalled();

    // Switch to manual mode
    manager.setMode('manual');
    manager.checkPlaybackProgress(170, 200);
    expect(onAutoTrigger).not.toHaveBeenCalled();
  });

  it('P16-T006: respects auto mix toggle in automatic mode', () => {
    const onAutoTrigger = vi.fn();

    const manager = new DjStudioModeManager({
      onAutoTriggerTransition: onAutoTrigger
    });

    manager.setPlan(mockPlan);
    manager.setAutoMixEnabled(false);

    manager.checkPlaybackProgress(165, 200);
    expect(onAutoTrigger).not.toHaveBeenCalled();

    manager.setAutoMixEnabled(true);
    manager.checkPlaybackProgress(165, 200);
    expect(onAutoTrigger).toHaveBeenCalledWith(mockPlan);
  });
});
