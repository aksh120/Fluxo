import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransitionWorkspace } from '../src/renderer/components/TransitionWorkspace';
import type { Track } from '../src/shared/types';
import type { TransitionPlan } from '../src/renderer/audio/TransitionPlanner';

describe('Phase 16 TransitionWorkspace UI Component Tests', () => {
  const trackA: Track = {
    id: 't_a',
    title: 'Song Alpha',
    artist: 'DJ One',
    duration: 180,
    bpm: 128,
    key: '8A',
    format: 'mp3',
    filePath: 'C:/music/a.mp3',
    fileSize: 4000000,
    createdAt: Date.now()
  };

  const trackB: Track = {
    id: 't_b',
    title: 'Song Beta',
    artist: 'DJ Two',
    duration: 210,
    bpm: 128,
    key: '9A',
    format: 'mp3',
    filePath: 'C:/music/b.mp3',
    fileSize: 4500000,
    createdAt: Date.now()
  };

  const mockPlan: TransitionPlan = {
    family: 'vocal_crossover',
    confidence: 0.94,
    factors: {
      tempoScore: 1.0,
      keyScore: 0.92,
      phraseScore: 0.95,
      vocalScore: 0.95,
      energyScore: 0.88,
      stemAvailability: true
    },
    timing: {
      transitionStartA: 140,
      transitionEndA: 170,
      startOffsetB: 0,
      durationBars: 16,
      durationSeconds: 30,
      vocalHandoffTimeA: 155
    },
    explanation: 'Incoming instrumental begins underneath active vocal phrase. Outgoing vocal continues for 8 bars before handoff.',
    isFallback: false
  };

  it('P16-T004: renders empty placeholder when one or both tracks are not loaded', () => {
    render(
      <TransitionWorkspace
        trackA={null}
        trackB={null}
        plan={null}
        progress={0}
        isActive={false}
        onTriggerTransition={vi.fn()}
        onSelectFamily={vi.fn()}
      />
    );

    expect(screen.getByText(/Load tracks into both Deck A and Deck B/i)).toBeTruthy();
  });

  it('P16-T004: renders dual aligned timeline, plan explanation, and triggers transition', () => {
    const onTrigger = vi.fn();
    const onSelectFamily = vi.fn();

    render(
      <TransitionWorkspace
        trackA={trackA}
        trackB={trackB}
        plan={mockPlan}
        progress={0.25}
        isActive={false}
        onTriggerTransition={onTrigger}
        onSelectFamily={onSelectFamily}
      />
    );

    // Verify dual deck indicators
    expect(screen.getByText('Deck A')).toBeTruthy();
    expect(screen.getByText('Deck B')).toBeTruthy();

    // Verify vocal & bass markers
    expect(screen.getAllByText(/Active Vocal Phrase/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bass Swap/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Vocal Handoff/i)).toBeTruthy();

    // Verify explanation card
    expect(screen.getByTestId('plan-explanation-card')).toBeTruthy();
    expect(screen.getByText(/Outgoing vocal continues for 8 bars/i)).toBeTruthy();

    // Verify family selector click
    const bassSwapBtn = screen.getByRole('button', { name: /Bass Swap/i });
    fireEvent.click(bassSwapBtn);
    expect(onSelectFamily).toHaveBeenCalledWith('bass_swap');

    // Trigger transition button
    const triggerBtn = screen.getByRole('button', { name: /Execute DJ Transition/i });
    fireEvent.click(triggerBtn);
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
