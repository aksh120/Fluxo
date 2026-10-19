/**
 * tests/autopilot_engine.test.tsx
 * Comprehensive Automated QA Test Suite for Fluxo Autopilot (Phase 17).
 * Verifies:
 * 1. Autopilot State Machine & Orchestrator (idle, planning, playing, takeover)
 * 2. Autonomous Set Planner, Energy Arc Models & Track Locking Preservation
 * 3. Autonomous Audio Mixing Coordination & Fallback Safety
 * 4. Transition Audit Logging & User Feedback Store
 * 5. Genuine Library Intelligence & Coverage Metrics Calculation
 * 6. AutopilotView React UI Component Rendering & Interactive Controls
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { TrackMetadata, TrackAnalysis } from '../src/shared/types';
import { AutopilotEngine } from '../src/renderer/audio/AutopilotEngine';
import { AutopilotPlanner } from '../src/renderer/audio/AutopilotPlanner';
import { AutopilotAuditStore } from '../src/renderer/audio/AutopilotAuditStore';
import { AutopilotMetricsService } from '../src/renderer/audio/AutopilotMetricsService';
import { AutopilotView } from '../src/renderer/views/AutopilotView';
import { DEFAULT_AUTOPILOT_CONFIG } from '../src/renderer/audio/AutopilotTypes';

// Track fixtures for diverse autonomous set planning
const MOCK_TRACKS: TrackMetadata[] = [
  {
    id: 'trk-001',
    filePath: 'C:/Music/ClubAnthem.mp3',
    fileSize: 10485760,
    mtime: Date.now(),
    title: 'Club Anthem',
    artist: 'DJ Pulse',
    album: 'Peak Horizons',
    duration: 210,
    sampleRate: 48000,
    channels: 2,
    format: 'mp3',
    sourceType: 'local',
    importedAt: Date.now()
  },
  {
    id: 'trk-002',
    filePath: 'C:/Music/MidnightGroove.mp3',
    fileSize: 8388608,
    mtime: Date.now(),
    title: 'Midnight Groove',
    artist: 'Aura',
    album: 'Deep Nights',
    duration: 195,
    sampleRate: 48000,
    channels: 2,
    format: 'mp3',
    sourceType: 'local',
    importedAt: Date.now()
  },
  {
    id: 'trk-003',
    filePath: 'C:/Music/SolarisVocal.flac',
    fileSize: 25165824,
    mtime: Date.now(),
    title: 'Solaris',
    artist: 'Vocal Echo',
    album: 'Solar Winds',
    duration: 240,
    sampleRate: 48000,
    channels: 2,
    format: 'flac',
    sourceType: 'local',
    importedAt: Date.now()
  },
  {
    id: 'trk-004',
    filePath: 'C:/Music/UndergroundBeat.wav',
    fileSize: 33554432,
    mtime: Date.now(),
    title: 'Underground Beat',
    artist: 'Sub Bass',
    album: 'Low End Theory',
    duration: 180,
    sampleRate: 48000,
    channels: 2,
    format: 'wav',
    sourceType: 'local',
    importedAt: Date.now()
  },
  {
    id: 'trk-005',
    filePath: 'C:/Music/SunsetMelody.mp3',
    fileSize: 9437184,
    mtime: Date.now(),
    title: 'Sunset Melody',
    artist: 'Horizon',
    album: 'Chillout Vol 1',
    duration: 220,
    sampleRate: 48000,
    channels: 2,
    format: 'mp3',
    sourceType: 'local',
    importedAt: Date.now()
  }
];

const MOCK_ANALYSES = new Map<string, TrackAnalysis>([
  [
    'trk-001',
    {
      trackId: 'trk-001',
      status: 'complete',
      bpm: 126,
      bpmConfidence: 0.95,
      musicalKey: 'A minor',
      camelotCode: '8A',
      keyConfidence: 0.92,
      integratedLufs: -9.5,
      truePeak: -0.2,
      energyLevel: 0.88,
      stemsPath: 'C:/Fluxo/cache/stems/trk-001',
      updatedAt: Date.now()
    }
  ],
  [
    'trk-002',
    {
      trackId: 'trk-002',
      status: 'complete',
      bpm: 124,
      bpmConfidence: 0.94,
      musicalKey: 'E minor',
      camelotCode: '9A',
      keyConfidence: 0.89,
      integratedLufs: -11.0,
      truePeak: -0.5,
      energyLevel: 0.72,
      updatedAt: Date.now()
    }
  ],
  [
    'trk-003',
    {
      trackId: 'trk-003',
      status: 'complete',
      bpm: 125,
      bpmConfidence: 0.98,
      musicalKey: 'A minor',
      camelotCode: '8A',
      keyConfidence: 0.96,
      integratedLufs: -10.2,
      truePeak: -0.3,
      energyLevel: 0.82,
      stemsPath: 'C:/Fluxo/cache/stems/trk-003',
      updatedAt: Date.now()
    }
  ],
  [
    'trk-004',
    {
      trackId: 'trk-004',
      status: 'complete',
      bpm: 128,
      bpmConfidence: 0.91,
      musicalKey: 'D minor',
      camelotCode: '7A',
      keyConfidence: 0.85,
      integratedLufs: -8.8,
      truePeak: -0.1,
      energyLevel: 0.91,
      updatedAt: Date.now()
    }
  ],
  [
    'trk-005',
    {
      trackId: 'trk-005',
      status: 'complete',
      bpm: 118,
      bpmConfidence: 0.88,
      musicalKey: 'C major',
      camelotCode: '8B',
      keyConfidence: 0.9,
      integratedLufs: -14.0,
      truePeak: -1.0,
      energyLevel: 0.42,
      updatedAt: Date.now()
    }
  ]
]);

describe('Phase 17: Fluxo Autopilot Autonomous AI DJ QA', () => {
  beforeEach(() => {
    // Reset singleton engine state
    const engine = AutopilotEngine.getInstance();
    engine.reset();
  });

  it('P17-T001: AutopilotEngine state machine initializes in idle and coordinates session lifecycle', async () => {
    const engine = AutopilotEngine.getInstance();
    engine.setLibrary(MOCK_TRACKS, MOCK_ANALYSES);

    expect(engine.getState()).toBe('idle');
    expect(engine.getActiveDeckId()).toBe('A');

    // Start session
    await engine.startSession(MOCK_TRACKS[0]);

    expect(engine.getState()).toBe('playing');
    expect(engine.getCurrentTrack()?.id).toBe('trk-001');

    const upcoming = engine.getUpcomingQueue();
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming[0].track).toBeDefined();

    // Pause and resume
    engine.pauseSession();
    expect(engine.getState()).toBe('paused');

    engine.resumeSession();
    expect(engine.getState()).toBe('playing');

    // Safe takeover
    const takeover = engine.takeoverToManual();
    expect(takeover.activeDeck).toBe('A');
    expect(takeover.currentTrack?.id).toBe('trk-001');
    expect(engine.getState()).toBe('idle');
  });

  it('P17-T002: AutopilotPlanner models energy progression arcs and strictly preserves locked tracks upon regeneration', () => {
    const planner = new AutopilotPlanner();

    // 1. Verify energy arcs
    const warmupArc = planner.calculateEnergyArcTargets('warmup', 5);
    expect(warmupArc[0]).toBeLessThan(warmupArc[4]);

    const buildingArc = planner.calculateEnergyArcTargets('building', 5);
    expect(buildingArc[4]).toBeGreaterThan(0.8);

    const winddownArc = planner.calculateEnergyArcTargets('winddown', 5);
    expect(winddownArc[0]).toBeGreaterThan(winddownArc[4]);

    // 2. Plan sequence
    const queue = planner.planSetSequence(
      MOCK_TRACKS[0],
      MOCK_TRACKS,
      MOCK_ANALYSES,
      DEFAULT_AUTOPILOT_CONFIG,
      [],
      [],
      4
    );

    expect(queue.length).toBe(4);
    expect(queue[0].track).toBeDefined();

    // 3. Lock track at index 1 and regenerate
    queue[1].isLocked = true;
    const lockedTrackId = queue[1].track.id;

    const regeneratedQueue = planner.planSetSequence(
      MOCK_TRACKS[0],
      MOCK_TRACKS,
      MOCK_ANALYSES,
      { ...DEFAULT_AUTOPILOT_CONFIG, energyProfile: 'peak' },
      queue,
      [],
      4
    );

    expect(regeneratedQueue[1].isLocked).toBe(true);
    expect(regeneratedQueue[1].track.id).toBe(lockedTrackId);
  });

  it('P17-T003: Evaluates candidate transitions, selects appropriate families, and provides human explanations', () => {
    const planner = new AutopilotPlanner();

    // Harmonic match: trk-001 (8A, 126 BPM) to trk-003 (8A, 125 BPM) with stems
    const evalResult = planner.evaluateCandidate(
      MOCK_TRACKS[0],
      MOCK_TRACKS[2],
      0.85,
      MOCK_ANALYSES,
      DEFAULT_AUTOPILOT_CONFIG
    );

    expect(evalResult.score).toBeGreaterThan(50);
    expect(evalResult.transitionPlan).toBeDefined();
    if (evalResult.transitionPlan) {
      expect(evalResult.transitionPlan.family).toBe('vocal_crossover');
      expect(evalResult.transitionPlan.explanation.length).toBeGreaterThan(10);
      expect(evalResult.transitionPlan.confidence).toBeGreaterThan(0.7);
    }
  });

  it('P17-T004: AutopilotAuditStore records execution metrics, calculates statistics, and captures feedback', () => {
    const store = new AutopilotAuditStore();
    store.clearAuditLog();

    const entry = store.recordTransition({
      fromTrackId: 'trk-001',
      fromTrackTitle: 'Club Anthem',
      toTrackId: 'trk-003',
      toTrackTitle: 'Solaris',
      transitionType: 'vocal_crossover',
      plannedDuration: 16.0,
      actualDuration: 15.8,
      confidence: 88,
      fallbackUsed: false,
      stemUsed: true
    });

    expect(entry.id).toBeDefined();
    expect(entry.transitionType).toBe('vocal_crossover');

    // Submit feedback
    const feedbackSuccess = store.submitFeedback(entry.id, 'good');
    expect(feedbackSuccess).toBe(true);

    const metrics = store.getMetrics();
    expect(metrics.totalTransitions).toBe(1);
    expect(metrics.stemPercentage).toBe(100);
    expect(metrics.fallbackPercentage).toBe(0);
    expect(metrics.feedbackStats.good).toBe(1);
  });

  it('P17-T005: AutopilotMetricsService calculates genuine library intelligence counts without placeholders', () => {
    const metrics = AutopilotMetricsService.calculateMetrics(MOCK_TRACKS, MOCK_ANALYSES, false);

    expect(metrics.totalDiscovered).toBe(5);
    expect(metrics.tracksIndexed).toBe(5);
    expect(metrics.tracksAnalysed).toBe(5);
    // Tracks with stems: trk-001 and trk-003
    expect(metrics.tracksWithStems).toBe(2);
    expect(metrics.tracksAwaitingDeepAnalysis).toBe(0);
    expect(metrics.libraryCoveragePercent).toBe(100);
  });

  it('P17-T006: AutopilotView renders Main Header, Library Intelligence, live waveform strip, and upcoming set list', async () => {
    const engine = AutopilotEngine.getInstance();
    engine.setLibrary(MOCK_TRACKS, MOCK_ANALYSES);

    let takeoverTriggered = false;
    render(
      <AutopilotView
        libraryTracks={MOCK_TRACKS}
        analyses={MOCK_ANALYSES}
        isScanning={false}
        onTakeoverToStudio={() => {
          takeoverTriggered = true;
        }}
      />
    );

    // 1. Verify Header and badges
    expect(screen.getByTestId('autopilot-header')).toBeTruthy();
    expect(screen.getByText('FLUXO AUTOPILOT')).toBeTruthy();
    expect(screen.getByTestId('autopilot-state-badge')).toBeTruthy();
    expect(screen.getByText('WASAPI 48kHz Stereo')).toBeTruthy();

    // 2. Verify Library Intelligence Metrics panel
    expect(screen.getByTestId('library-intelligence-panel')).toBeTruthy();
    expect(screen.getByText('Discovered')).toBeTruthy();
    expect(screen.getByText('Cached Stems')).toBeTruthy();

    // 3. Verify Live Performance View
    expect(screen.getByTestId('autopilot-live-performance')).toBeTruthy();
    expect(screen.getByText(/NOW PLAYING/i)).toBeTruthy();

    // 4. Verify Upcoming Set and Start DJ button
    expect(screen.getByTestId('upcoming-set-section')).toBeTruthy();
    const toggleBtn = screen.getByTestId('autopilot-toggle-btn');
    expect(toggleBtn).toBeTruthy();

    // 5. Test Start DJ action
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // 6. Test Safe Takeover trigger
    const takeoverBtn = screen.getByTestId('autopilot-takeover-btn');
    await act(async () => {
      fireEvent.click(takeoverBtn);
    });
    expect(takeoverTriggered).toBe(true);
  });
});
