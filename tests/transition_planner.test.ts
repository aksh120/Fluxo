import { describe, it, expect } from 'vitest';
import { TransitionPlanner } from '../src/renderer/audio/TransitionPlanner';
import type { Track, TrackAnalysis } from '../src/shared/types';
import type { VocalAnalysisResult } from '../src/shared/analysis/VocalActivityDetector';

describe('Phase 16 Transition Planner Tests', () => {
  const planner = new TransitionPlanner();

  const trackA: Track = {
    id: 'track_a',
    title: 'Outgoing Anthem',
    artist: 'Artist A',
    duration: 200,
    bpm: 126,
    key: '8B',
    format: 'mp3',
    filePath: 'C:/music/a.mp3',
    fileSize: 5000000,
    createdAt: Date.now()
  };

  const analysisA: TrackAnalysis = {
    id: 'ana_a',
    trackId: 'track_a',
    bpm: 126,
    key: '8B',
    beatGrid: [0, 0.476, 0.952],
    energy: 0.8,
    lufs: -9.5,
    dropTime: 60,
    outroTime: 170
  };

  const trackB: Track = {
    id: 'track_b',
    title: 'Incoming Groove',
    artist: 'Artist B',
    duration: 220,
    bpm: 126,
    key: '9B', // Adjacent harmonic key on Camelot wheel!
    format: 'mp3',
    filePath: 'C:/music/b.mp3',
    fileSize: 5500000,
    createdAt: Date.now()
  };

  const analysisB: TrackAnalysis = {
    id: 'ana_b',
    trackId: 'track_b',
    bpm: 126,
    key: '9B',
    beatGrid: [0, 0.476, 0.952],
    energy: 0.85,
    lufs: -9.0,
    dropTime: 45,
    outroTime: 190
  };

  it('P16-T002: selects bass_swap transition for harmonically compatible tracks', () => {
    const plan = planner.planTransition(trackA, analysisA, trackB, analysisB);

    expect(plan.family).toBe('bass_swap');
    expect(plan.isFallback).toBe(false);
    expect(plan.confidence).toBeGreaterThan(0.8);
    expect(plan.factors.keyScore).toBeGreaterThanOrEqual(0.85); // 8B to 9B
    expect(plan.factors.tempoScore).toBeCloseTo(1.0, 1);
    expect(plan.timing.bassSwapTimeA).toBeDefined();
    expect(plan.explanation).toContain('bass swap');
  });

  it('P16-T002: selects vocal_crossover when stems are available and vocal phrase active', () => {
    const vocalA: VocalAnalysisResult = {
      vocalSegments: [{ start: 150, end: 185, confidence: 0.9, averageEnergy: 0.8, isVocal: true }],
      instrumentalWindows: [],
      vocalActivityRatio: 0.5,
      phraseBoundaries: [],
      optimalVocalHandoffWindows: []
    };

    const plan = planner.planTransition(
      trackA,
      analysisA,
      trackB,
      analysisB,
      vocalA,
      null,
      true, // hasStemsA
      true  // hasStemsB
    );

    expect(plan.family).toBe('vocal_crossover');
    expect(plan.factors.stemAvailability).toBe(true);
    expect(plan.timing.vocalHandoffTimeA).toBeDefined();
    expect(plan.explanation).toContain('mid-frequency masking suppression');
  });

  it('P16-T002: selects echo_out transition when tempo delta is large (> 20%)', () => {
    const slowTrackB: Track = {
      ...trackB,
      bpm: 95 // 126 -> 95 BPM (large drop)
    };
    const slowAnalysisB: TrackAnalysis = {
      ...analysisB,
      bpm: 95
    };

    const plan = planner.planTransition(trackA, analysisA, slowTrackB, slowAnalysisB);

    expect(plan.family).toBe('echo_out');
    expect(plan.factors.tempoScore).toBeLessThan(0.45);
    expect(plan.explanation).toContain('tempo difference');
  });

  it('P16-T002: falls back gracefully to fallback_crossfade when analysis is null', () => {
    const plan = planner.planTransition(trackA, null, trackB, null);

    expect(plan.family).toBe('fallback_crossfade');
    expect(plan.isFallback).toBe(true);
    expect(plan.confidence).toBeLessThan(0.7);
    expect(plan.explanation).toContain('fallback crossfade');
  });
});
