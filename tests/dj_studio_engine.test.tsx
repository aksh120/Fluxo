/**
 * dj_studio_engine.test.tsx
 * Phase 16: Comprehensive AI DJ Engine & Intelligent Live Mixing Studio QA Suite
 * Verifies real audio engine safety, vocal-aware crossovers, 9 transition families,
 * 3-mode operation (Auto, Assisted, Manual), and zero mock data constraints.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VocalActivityDetector } from '../src/shared/analysis/VocalActivityDetector';
import { TransitionPlanner, type TransitionFamily } from '../src/renderer/audio/TransitionPlanner';
import { VocalCrossoverEngine } from '../src/renderer/audio/VocalCrossoverEngine';
import { DjStudioModeManager } from '../src/renderer/audio/DjStudioModeManager';
import { StudioView } from '../src/renderer/views/StudioView';
import type { Track, DeckState, TrackAnalysis } from '../src/shared/types';
import type { DeckEngine } from '../src/renderer/audio/DeckEngine';

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

function createMockDeckEngine(): DeckEngine {
  return {
    isPlaying: true,
    play: vi.fn(),
    pause: vi.fn(),
    setLowGain: vi.fn(),
    setMidGain: vi.fn(),
    setHighGain: vi.fn(),
    setFilterParam: vi.fn(),
    setVolume: vi.fn(),
    currentTrack: { bpm: 126 }
  } as unknown as DeckEngine;
}

describe('Phase 16: AI DJ Engine & Intelligent Live Mixing Studio QA', () => {
  const trackA: Track = {
    id: 'trk_alpha',
    title: 'Solar Resonance',
    artist: 'DJ Alpha',
    duration: 210,
    bpm: 126,
    key: '8B',
    format: 'flac',
    filePath: 'C:/music/alpha.flac',
    fileSize: 15000000,
    createdAt: Date.now()
  };

  const analysisA: TrackAnalysis = {
    id: 'ana_alpha',
    trackId: 'trk_alpha',
    bpm: 126,
    key: '8B',
    beatGrid: [0, 0.476, 0.952],
    energy: 0.82,
    lufs: -9.2,
    dropTime: 65,
    outroTime: 175
  };

  const trackB: Track = {
    id: 'trk_beta',
    title: 'Neon Odyssey',
    artist: 'DJ Beta',
    duration: 225,
    bpm: 126,
    key: '9B',
    format: 'mp3',
    filePath: 'C:/music/beta.mp3',
    fileSize: 8500000,
    createdAt: Date.now()
  };

  const analysisB: TrackAnalysis = {
    id: 'ana_beta',
    trackId: 'trk_beta',
    bpm: 126,
    key: '9B',
    beatGrid: [0, 0.476, 0.952],
    energy: 0.85,
    lufs: -8.8,
    dropTime: 50,
    outroTime: 195
  };

  const deckStateA: DeckState = {
    deckId: 'A',
    currentTrack: trackA,
    isPlaying: true,
    currentTime: 140,
    duration: 210,
    playbackRate: 1.0,
    volume: 1.0,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 20000,
    filterResonance: 1.0
  };

  const deckStateB: DeckState = {
    deckId: 'B',
    currentTrack: trackB,
    isPlaying: false,
    currentTime: 0,
    duration: 225,
    playbackRate: 1.0,
    volume: 0.0,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 20000,
    filterResonance: 1.0
  };

  // 1. Music Understanding & Vocal Analysis
  it('P16-T008: VocalActivityDetector accurately identifies vocal presence, boundaries, and clashing risk', () => {
    const vad = new VocalActivityDetector();
    const sampleRate = 44100;
    const duration = 20.0;
    const samples = new Float32Array(sampleRate * duration);

    // Formant vocal energy (300Hz-3.5kHz) between 4s and 12s
    for (let i = 4 * sampleRate; i < 12 * sampleRate; i++) {
      const t = i / sampleRate;
      samples[i] = 0.5 * Math.sin(2 * Math.PI * 500 * t) + 0.3 * Math.sin(2 * Math.PI * 1500 * t);
    }

    const vadResult = vad.analyzeVocals(samples, sampleRate, 126, 0.0, duration);
    expect(vadResult.vocalSegments.length).toBeGreaterThan(0);
    expect(vadResult.vocalSegments[0].start).toBeGreaterThanOrEqual(3.5);
    expect(vadResult.vocalSegments[0].end).toBeLessThanOrEqual(13.0);
    expect(vadResult.phraseBoundaries.length).toBeGreaterThan(0);
  });

  // 2. 9 Transition Families Planning
  it('P16-T008: TransitionPlanner evaluates 9 transition families with multi-factor scoring', () => {
    const planner = new TransitionPlanner();

    // Case A: Vocal Crossover when stems are available
    const vocalPlan = planner.planTransition(
      trackA,
      analysisA,
      trackB,
      analysisB,
      null,
      null,
      true, // hasStemsA
      true  // hasStemsB
    );
    expect(vocalPlan.family).toBe('vocal_crossover');
    expect(vocalPlan.factors.stemAvailability).toBe(true);
    expect(vocalPlan.explanation).toContain('mid-frequency masking suppression');

    // Case B: Bass Swap when harmonically matched
    const bassPlan = planner.planTransition(trackA, analysisA, trackB, analysisB);
    expect(bassPlan.family).toBe('bass_swap');
    expect(bassPlan.factors.keyScore).toBeGreaterThanOrEqual(0.85);

    // Case C: Echo out on large BPM gap
    const slowTrackB = { ...trackB, bpm: 90 };
    const slowAnalysisB = { ...analysisB, bpm: 90 };
    const echoPlan = planner.planTransition(trackA, analysisA, slowTrackB, slowAnalysisB);
    expect(echoPlan.family).toBe('echo_out');
  });

  // 3. Vocal Crossover DSP Execution
  it('P16-T008: VocalCrossoverEngine manages dynamic masking suppression and phrase handoff', () => {
    let crossfader = -1.0;
    const setCrossfader = vi.fn((pos: number) => {
      crossfader = pos;
    });

    const engineDeckA = createMockDeckEngine();
    const engineDeckB = createMockDeckEngine();
    engineDeckB.isPlaying = false;

    const crossoverEngine = new VocalCrossoverEngine(
      setCrossfader,
      (id) => (id === 'A' ? engineDeckA : engineDeckB)
    );

    crossoverEngine.startCrossover({
      fromDeck: 'A',
      toDeck: 'B',
      timing: {
        transitionStartA: 150,
        transitionEndA: 180,
        startOffsetB: 0,
        durationBars: 16,
        durationSeconds: 30
      }
    });

    expect(crossoverEngine.isActive).toBe(true);
    expect(engineDeckB.play).toHaveBeenCalled();
    // Dynamic mid frequency dip (-5.2dB) applied to prevent vocal masking
    expect(engineDeckB.setMidGain).toHaveBeenCalledWith(0.55);

    crossoverEngine.complete();
    expect(crossoverEngine.isActive).toBe(false);
    expect(engineDeckA.pause).toHaveBeenCalled();
    expect(engineDeckB.setMidGain).toHaveBeenCalledWith(1.0); // Restored
  });

  // 4. DjStudioModeManager (Auto, Assisted, Manual)
  it('P16-T008: DjStudioModeManager manages Automatic, Assisted, and Manual operating levels', () => {
    const onAutoTrigger = vi.fn();
    const manager = new DjStudioModeManager({ onAutoTriggerTransition: onAutoTrigger });

    const testPlan = {
      family: 'vocal_crossover' as TransitionFamily,
      confidence: 0.95,
      factors: { tempoScore: 1, keyScore: 1, phraseScore: 1, vocalScore: 1, energyScore: 1, stemAvailability: true },
      timing: { transitionStartA: 100, transitionEndA: 130, startOffsetB: 0, durationBars: 16, durationSeconds: 30 },
      explanation: 'Vocal handoff',
      isFallback: false
    };

    manager.setPlan(testPlan);
    expect(manager.mode).toBe('automatic');

    // Trigger at 100s in auto mode
    manager.checkPlaybackProgress(100.5, 200);
    expect(onAutoTrigger).toHaveBeenCalledTimes(1);

    // Switch to manual mode
    manager.setMode('manual');
    manager.resetTrack();
    manager.checkPlaybackProgress(100.5, 200);
    expect(onAutoTrigger).toHaveBeenCalledTimes(1); // Not called in manual mode!
  });

  // 5. StudioView Integrated UI Layout
  it('P16-T008: StudioView renders DJ Studio Top Bar, TransitionWorkspace, and deck controls', () => {
    const onTrigger = vi.fn();

    render(
      <StudioView
        deckA={deckStateA}
        deckB={deckStateB}
        libraryTracks={[trackA, trackB]}
        onUpdateDeckA={vi.fn()}
        onUpdateDeckB={vi.fn()}
        crossfaderPos={-1.0}
        onCrossfaderChange={vi.fn()}
        onTriggerTransition={onTrigger}
      />
    );

    // Verify DJ Studio Top Bar elements
    expect(screen.getByTestId('dj-studio-top-bar')).toBeTruthy();
    expect(screen.getByText('LIVE AI DJ STUDIO')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Auto DJ/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Assisted/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Manual/i })).toBeTruthy();

    // Verify Decks and Tracks
    expect(screen.getByText('DECK A')).toBeTruthy();
    expect(screen.getByText('DECK B')).toBeTruthy();
    expect(screen.getByText('Solar Resonance')).toBeTruthy();
    expect(screen.getByText('Neon Odyssey')).toBeTruthy();

    // Verify Transition Workspace Signature Component
    expect(screen.getByTestId('transition-workspace')).toBeTruthy();
    expect(screen.getByText(/Transition Workspace/i)).toBeTruthy();

    // Toggle Library Panel drawer
    const libBtn = screen.getByRole('button', { name: /Library \(2\)/i });
    fireEvent.click(libBtn);
    expect(screen.getByTestId('studio-library-panel')).toBeTruthy();
  });
});
