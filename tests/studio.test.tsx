import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StudioView } from '../src/renderer/views/StudioView';
import { BeginnerView } from '../src/renderer/views/BeginnerView';
import { ScrollingWaveformCanvas } from '../src/renderer/components/ScrollingWaveformCanvas';
import type { DeckState } from '../src/shared/types';

// Mock Canvas 2D context for jsdom
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    canvas: { width: 960, height: 160 }
  });
});

describe('Phase 8 Beginner Mode, Advanced DJ Studio & Controls Tests', () => {
  const mockDeckA: DeckState = {
    deckId: 'A',
    currentTrack: {
      id: 'trk-a',
      filePath: 'a.mp3',
      fileSize: 1000,
      mtime: 1,
      title: 'Solar Wave',
      artist: 'Aura',
      album: 'Visions',
      duration: 200,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local',
      bpm: 128.0,
      camelotCode: '8A',
      musicalKey: 'Am'
    },
    isPlaying: true,
    currentTime: 45,
    duration: 200,
    playbackRate: 1.0,
    volume: 0.9,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 1000,
    filterResonance: 1.0
  };

  const mockDeckB: DeckState = {
    deckId: 'B',
    currentTrack: {
      id: 'trk-b',
      filePath: 'b.mp3',
      fileSize: 1000,
      mtime: 1,
      title: 'Neon Horizon',
      artist: 'Cygnus',
      album: 'Visions',
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local',
      bpm: 124.0,
      camelotCode: '9A',
      musicalKey: 'Em'
    },
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    playbackRate: 1.0,
    volume: 0.0,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 1000,
    filterResonance: 1.0
  };

  it('P08-T001: BeginnerView renders album art focus, vibe selector, and triggers transition', () => {
    const handleTransition = vi.fn();
    const handlePlayToggle = vi.fn();
    const handleSkip = vi.fn();
    const handleVolume = vi.fn();

    render(
      <BeginnerView
        activeDeck={mockDeckA}
        standbyDeck={mockDeckB}
        onPlayToggle={handlePlayToggle}
        onTriggerTransition={handleTransition}
        onSkipNext={handleSkip}
        onVolumeChange={handleVolume}
      />
    );

    // Track title and artist
    expect(screen.getByText('Solar Wave')).toBeDefined();
    expect(screen.getByText('Aura')).toBeDefined();

    // Vibe selection buttons
    expect(screen.getByText('Chill Lounge')).toBeDefined();
    expect(screen.getByText('Party Building')).toBeDefined();
    expect(screen.getByText('Peak Hour')).toBeDefined();

    // Transition trigger button
    const transBtn = screen.getByRole('button', { name: /transition now/i });
    fireEvent.click(transBtn);
    expect(handleTransition).toHaveBeenCalledWith('bass_swap');

    // Transport buttons
    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseBtn);
    expect(handlePlayToggle).toHaveBeenCalled();
  });

  it('P08-T002: ScrollingWaveformCanvas renders stacked waveforms and handles seek interactions', () => {
    const handleSeekA = vi.fn();
    const handleSeekB = vi.fn();

    const { container } = render(
      <ScrollingWaveformCanvas
        deckA={mockDeckA}
        deckB={mockDeckB}
        height={160}
        onSeekDeckA={handleSeekA}
        onSeekDeckB={handleSeekB}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeDefined();

    // Simulate clicking top half of canvas (Deck A seek)
    if (canvas) {
      fireEvent.click(canvas, { clientX: 480, clientY: 40 });
      expect(handleSeekA).toHaveBeenCalled();
    }
  });

  it('P08-T003: StudioView renders Advanced DJ Studio dual-deck layout', () => {
    render(
      <StudioView
        deckA={mockDeckA}
        deckB={mockDeckB}
        onUpdateDeckA={vi.fn()}
        onUpdateDeckB={vi.fn()}
        crossfaderPos={-1.0}
        onCrossfaderChange={vi.fn()}
      />
    );

    expect(screen.getByText('DECK A')).toBeDefined();
    expect(screen.getByText('DECK B')).toBeDefined();
    expect(screen.getByText('Solar Wave')).toBeDefined();
    expect(screen.getByText('Neon Horizon')).toBeDefined();
    expect(screen.getByText('MASTER MIXER')).toBeDefined();
  });

  it('P08-T004: StudioView manual DJ controls handle pitch bend, tempo, and cue', () => {
    const handlePitchBend = vi.fn();
    const handleUpdateA = vi.fn();
    const handleSync = vi.fn();

    render(
      <StudioView
        deckA={mockDeckA}
        deckB={mockDeckB}
        onUpdateDeckA={handleUpdateA}
        onUpdateDeckB={vi.fn()}
        crossfaderPos={0.0}
        onCrossfaderChange={vi.fn()}
        onPitchBend={handlePitchBend}
        onSyncDeck={handleSync}
      />
    );

    // Pitch bend + button on Deck A
    const plusButtons = screen.getAllByRole('button', { name: /\+/i });
    fireEvent.mouseDown(plusButtons[0]);
    expect(handlePitchBend).toHaveBeenCalledWith('A', 1);

    // Cue button
    const cueButtons = screen.getAllByRole('button', { name: /cue/i });
    fireEvent.click(cueButtons[0]);
    expect(handleUpdateA).toHaveBeenCalledWith({ currentTime: 0, isPlaying: true });

    // Sync button
    const syncButtons = screen.getAllByRole('button', { name: /sync/i });
    fireEvent.click(syncButtons[0]);
    expect(handleSync).toHaveBeenCalledWith('A');
  });

  it('P08-T005: StudioView 3-band EQ knobs support click-to-kill toggles', () => {
    const handleUpdateA = vi.fn();

    render(
      <StudioView
        deckA={mockDeckA}
        deckB={mockDeckB}
        onUpdateDeckA={handleUpdateA}
        onUpdateDeckB={vi.fn()}
        crossfaderPos={0.0}
        onCrossfaderChange={vi.fn()}
      />
    );

    // Find KILL buttons on Deck A (RotaryKnob includes KILL toggle button when onKillToggle is passed)
    const killButtons = screen.getAllByTitle(/toggle kill/i);
    expect(killButtons.length).toBeGreaterThanOrEqual(3);

    // Click Low Kill toggle
    fireEvent.click(killButtons[2]);
    expect(handleUpdateA).toHaveBeenCalled();
  });

  it('P08-T006: preserves shared audio state during mode toggle', () => {
    const { rerender } = render(
      <BeginnerView
        activeDeck={mockDeckA}
        standbyDeck={mockDeckB}
        onPlayToggle={vi.fn()}
        onTriggerTransition={vi.fn()}
        onSkipNext={vi.fn()}
        onVolumeChange={vi.fn()}
      />
    );

    expect(screen.getByText('Solar Wave')).toBeDefined();

    // Toggle to Advanced Studio View with the exact same deck states
    rerender(
      <StudioView
        deckA={mockDeckA}
        deckB={mockDeckB}
        onUpdateDeckA={vi.fn()}
        onUpdateDeckB={vi.fn()}
        crossfaderPos={-1.0}
        onCrossfaderChange={vi.fn()}
      />
    );

    expect(screen.getByText('DECK A')).toBeDefined();
    expect(screen.getByText('Solar Wave')).toBeDefined();
    expect(screen.getByText('DECK B')).toBeDefined();
    expect(screen.getByText('Neon Horizon')).toBeDefined();
  });
});
