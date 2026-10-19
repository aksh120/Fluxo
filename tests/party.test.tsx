import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  calculateTrackCompatibility,
  calculateHarmonicScore,
  calculateBpmScore,
  calculateEnergyScore,
  rankCandidates,
  extractCamelotCode
} from '../src/shared/dj/compatibility';
import {
  EnergyFlowOrchestrator,
  ENERGY_PROFILES
} from '../src/shared/dj/EnergyFlowOrchestrator';
import { PreferenceLearner } from '../src/shared/dj/PreferenceLearner';
import { FluxoDatabase } from '../src/main/db/database';
import { PartyModeView } from '../src/renderer/views/PartyModeView';
import type { TrackMetadata } from '../src/shared/types';
import type { QueueItem } from '../src/renderer/state/QueueManager';

// Mock Canvas 2D context for JSDOM
beforeEach(() => {
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

function createMockTrack(overrides: Partial<TrackMetadata> = {}): TrackMetadata {
  return {
    id: `track-${Math.random().toString(36).substring(2, 7)}`,
    filePath: 'C:/Music/test.mp3',
    fileSize: 5000000,
    mtime: Date.now(),
    title: 'Test Title',
    artist: 'Artist A',
    album: 'Test Album',
    duration: 210,
    sampleRate: 44100,
    channels: 2,
    format: 'mp3',
    sourceType: 'local',
    bpm: 124,
    camelotCode: '8A',
    energyLevel: 0.6,
    ...overrides
  };
}

describe('Phase 9 Autonomous Party DJ, Compatibility & Learning Tests', () => {
  describe('P09-T001: Track Compatibility Scoring Algorithm', () => {
    it('accurately parses Camelot codes and maps musical keys', () => {
      const t1 = createMockTrack({ camelotCode: '8A' });
      const t2 = createMockTrack({ camelotCode: undefined, musicalKey: 'Am' });
      const t3 = createMockTrack({ camelotCode: undefined, musicalKey: 'C' });

      expect(extractCamelotCode(t1)).toEqual({ number: 8, letter: 'A' });
      expect(extractCamelotCode(t2)).toEqual({ number: 8, letter: 'A' });
      expect(extractCamelotCode(t3)).toEqual({ number: 8, letter: 'B' });
    });

    it('scores harmonic compatibility across circle of fifths', () => {
      const base = createMockTrack({ camelotCode: '8A' });

      // Identical key (8A -> 8A)
      const identical = calculateHarmonicScore(base, createMockTrack({ camelotCode: '8A' }));
      expect(identical.relation).toBe('identical');
      expect(identical.score).toBe(1.0);

      // Relative major (8A -> 8B, A minor to C major)
      const relative = calculateHarmonicScore(base, createMockTrack({ camelotCode: '8B' }));
      expect(relative.relation).toBe('relative');
      expect(relative.score).toBe(0.95);

      // Adjacent key (8A -> 9A, 8A -> 7A)
      const adjacent = calculateHarmonicScore(base, createMockTrack({ camelotCode: '9A' }));
      expect(adjacent.relation).toBe('adjacent');
      expect(adjacent.score).toBe(0.92);

      // Wrap-around adjacent key (12A -> 1A)
      const wrapAdjacent = calculateHarmonicScore(
        createMockTrack({ camelotCode: '12A' }),
        createMockTrack({ camelotCode: '1A' })
      );
      expect(wrapAdjacent.relation).toBe('adjacent');
      expect(wrapAdjacent.score).toBe(0.92);

      // Energy boost key jump (+2 steps, 8A -> 10A)
      const boost = calculateHarmonicScore(base, createMockTrack({ camelotCode: '10A' }));
      expect(boost.relation).toBe('energy_boost');
      expect(boost.score).toBe(0.65);

      // Harmonic clash (8A -> 2A)
      const clash = calculateHarmonicScore(base, createMockTrack({ camelotCode: '2A' }));
      expect(clash.relation).toBe('clash');
      expect(clash.score).toBeLessThan(0.3);
    });

    it('scores BPM proximity and supports half-time / double-time detection', () => {
      // Exact BPM match
      const exact = calculateBpmScore(124, 124);
      expect(exact.score).toBe(1.0);
      expect(exact.halfOrDoubleTime).toBe(false);

      // Pitch-bendable BPM match (124 -> 126, ~1.6% delta)
      const close = calculateBpmScore(124, 126);
      expect(close.score).toBe(1.0);

      // Double-time mixing (70 BPM mixing into 140 BPM)
      const doubleTime = calculateBpmScore(70, 140);
      expect(doubleTime.halfOrDoubleTime).toBe(true);
      expect(doubleTime.effectiveBpm).toBe(70);
      expect(doubleTime.score).toBe(1.0);

      // Half-time mixing (140 BPM mixing into 70 BPM)
      const halfTime = calculateBpmScore(140, 70);
      expect(halfTime.halfOrDoubleTime).toBe(true);
      expect(halfTime.effectiveBpm).toBe(140);
      expect(halfTime.score).toBe(1.0);

      // Clashing tempos (124 -> 165)
      const distant = calculateBpmScore(124, 165);
      expect(distant.score).toBeLessThan(0.4);
    });

    it('computes composite compatibility score with artist clash penalty', () => {
      const current = createMockTrack({
        artist: 'Avicii',
        bpm: 126,
        camelotCode: '7A',
        energyLevel: 0.8
      });

      // Perfect candidate: different artist, adjacent key, matched BPM, similar energy
      const candidatePerfect = createMockTrack({
        artist: 'Swedish House Mafia',
        bpm: 126,
        camelotCode: '7A',
        energyLevel: 0.82
      });

      const scorePerfect = calculateTrackCompatibility(current, candidatePerfect);
      expect(scorePerfect.totalScore).toBeGreaterThanOrEqual(0.95);
      expect(scorePerfect.artistPenalty).toBe(0);

      // Same artist penalty applied
      const candidateSameArtist = createMockTrack({
        artist: 'Avicii',
        bpm: 126,
        camelotCode: '7A',
        energyLevel: 0.82
      });

      const scoreSameArtist = calculateTrackCompatibility(current, candidateSameArtist, {
        penalizeSameArtist: true,
        artistClashPenalty: 0.25
      });
      expect(scoreSameArtist.artistPenalty).toBe(0.25);
      expect(scoreSameArtist.totalScore).toBeLessThan(scorePerfect.totalScore);

      // Ranking candidates
      const ranked = rankCandidates(current, [candidateSameArtist, candidatePerfect]);
      expect(ranked[0].track.artist).toBe('Swedish House Mafia');
    });
  });

  describe('P09-T002: Energy Flow Queue Orchestrator', () => {
    it('calculates profile target energies for steady, building, wave, and peak', () => {
      const orchestrator = new EnergyFlowOrchestrator();

      // Steady: remains constant
      expect(orchestrator.getTargetEnergy(0, 10, 'steady')).toBeCloseTo(0.55);
      expect(orchestrator.getTargetEnergy(9, 10, 'steady')).toBeCloseTo(0.55);

      // Building: ramps up from low/mid to high
      const buildStart = orchestrator.getTargetEnergy(0, 10, 'building');
      const buildEnd = orchestrator.getTargetEnergy(9, 10, 'building');
      expect(buildStart).toBeLessThan(0.45);
      expect(buildEnd).toBeGreaterThan(0.9);

      // Peak: sustained maximum
      expect(orchestrator.getTargetEnergy(5, 10, 'peak')).toBeGreaterThanOrEqual(0.85);

      // Wave: sinusoidal oscillation
      const wave0 = orchestrator.getTargetEnergy(0, 10, 'wave');
      const wave1 = orchestrator.getTargetEnergy(1, 10, 'wave');
      expect(wave0).not.toBe(wave1);
    });

    it('sequences a 50-track playlist while strictly respecting pinned tracks', () => {
      const orchestrator = new EnergyFlowOrchestrator('building');

      // Generate 50 synthetic test tracks across various keys, BPMs, and energy levels
      const tracks: TrackMetadata[] = [];
      const camelots = ['8A', '8B', '9A', '7A', '10A', '11B', '12A', '1A', '2B', '3A'];

      for (let i = 0; i < 50; i++) {
        tracks.push(
          createMockTrack({
            id: `track-${i}`,
            title: `Track ${i}`,
            artist: `Artist ${i % 12}`,
            bpm: 120 + (i % 10) * 1.5,
            camelotCode: camelots[i % camelots.length],
            energyLevel: 0.2 + (i / 50) * 0.7
          })
        );
      }

      // Pin track at index 5 and track at index 25
      const pinnedTrack5Id = tracks[5].id;
      const pinnedTrack25Id = tracks[25].id;
      const pinnedIds = new Set([pinnedTrack5Id, pinnedTrack25Id]);

      const sequenced = orchestrator.sequenceTracks(tracks, {
        profile: 'building',
        pinnedTrackIds: pinnedIds,
        preserveFirstTrack: true
      });

      expect(sequenced.length).toBe(50);
      // Preserved first track
      expect(sequenced[0].track.id).toBe(tracks[0].id);

      // Pinned tracks MUST be at their designated indices
      expect(sequenced[5].track.id).toBe(pinnedTrack5Id);
      expect(sequenced[5].isPinned).toBe(true);

      expect(sequenced[25].track.id).toBe(pinnedTrack25Id);
      expect(sequenced[25].isPinned).toBe(true);

      // Verify overall harmonic continuity
      let validTransitions = 0;
      for (let i = 1; i < sequenced.length; i++) {
        if (sequenced[i].scoreWithPrevious) {
          validTransitions++;
          expect(sequenced[i].scoreWithPrevious?.totalScore).toBeGreaterThanOrEqual(0.0);
        }
      }
      expect(validTransitions).toBeGreaterThan(45);
    });

    it('selects the single best next candidate from a pool', () => {
      const orchestrator = new EnergyFlowOrchestrator('building');
      const current = createMockTrack({ bpm: 125, camelotCode: '8A', energyLevel: 0.5 });

      const candidateA = createMockTrack({ id: 'cand-a', artist: 'Artist B', bpm: 125, camelotCode: '8A', energyLevel: 0.55 });
      const candidateB = createMockTrack({ id: 'cand-b', artist: 'Artist C', bpm: 160, camelotCode: '2B', energyLevel: 0.1 });

      const best = orchestrator.getNextBestCandidate(current, [candidateB, candidateA], 1, 10);
      expect(best).not.toBeNull();
      expect(best?.track.id).toBe('cand-a');
      expect(best?.score.totalScore).toBeGreaterThan(0.85);
    });
  });

  describe('P09-T003: Local User Preference Learning & Skip Tracker', () => {
    it('applies early skip penalty and decreases artist affinity in memory', async () => {
      const learner = new PreferenceLearner();
      const track = createMockTrack({ id: 'song-skip', artist: 'Hated Artist', duration: 200 });

      // Before skip
      expect(learner.getScoreAdjustment(track)).toBe(0);
      expect(learner.getArtistAffinity('Hated Artist')).toBe(0);

      // User skips within 15 seconds (< 30s early skip threshold)
      await learner.recordSkip(track, 15);

      const stats = learner.getTrackStats(track.id);
      expect(stats.skipCount).toBe(1);

      // Affinity and score adjustment should both be negative
      const affinity = learner.getArtistAffinity('Hated Artist');
      expect(affinity).toBeLessThan(0);

      const adjustment = learner.getScoreAdjustment(track);
      expect(adjustment).toBeLessThan(-0.1);
    });

    it('rewards completed plays and favorites with positive score boost', async () => {
      const learner = new PreferenceLearner();
      const track = createMockTrack({ id: 'song-hit', artist: 'Beloved Artist', duration: 180 });

      // Complete play
      await learner.recordCompletion(track, 180);
      expect(learner.getArtistAffinity('Beloved Artist')).toBeGreaterThan(0);

      // Like / favorite
      await learner.recordLike(track, true);
      const adjustment = learner.getScoreAdjustment(track);
      expect(adjustment).toBeGreaterThan(0.2);
    });

    it('persists play history events and loads stats from FluxoDatabase', () => {
      const db = new FluxoDatabase({ inMemory: true });
      const track = createMockTrack({ id: 'db-track-1', artist: 'DJ SQLite' });
      db.upsertTrack(track);

      // Record a skip
      db.recordPlayEvent({
        id: 'play-1',
        trackId: track.id,
        playedAt: Date.now(),
        durationPlayed: 20,
        completed: false,
        skippedAt: 20
      });

      const stats1 = db.getTrackFeedbackStats(track.id);
      expect(stats1.skipCount).toBe(1);
      expect(stats1.completedCount).toBe(0);
      expect(stats1.scoreAdjustment).toBeLessThan(0);

      // Record 3 completed plays
      for (let i = 2; i <= 4; i++) {
        db.recordPlayEvent({
          id: `play-${i}`,
          trackId: track.id,
          playedAt: Date.now() + i,
          durationPlayed: 200,
          completed: true
        });
      }

      const stats2 = db.getTrackFeedbackStats(track.id);
      expect(stats2.completedCount).toBe(3);
      expect(stats2.skipCount).toBe(1);

      // Artist affinity check
      const artistAffinity = db.getArtistAffinity('DJ SQLite');
      expect(artistAffinity).toBeGreaterThan(0);

      db.close();
    });
  });

  describe('P09-T004 & P09-T005: Full-Screen Party Mode UI & Transition Controls', () => {
    it('renders PartyModeView with active vibe profile, countdown, and queue match indicators', () => {
      const currentTrack = createMockTrack({
        title: 'Midnight Anthem',
        artist: 'Starlight',
        bpm: 124,
        camelotCode: '8A'
      });

      const upcomingItems: QueueItem[] = [
        {
          id: 'q-1',
          track: createMockTrack({ id: 'u1', title: 'Solar Flare', artist: 'Supernova', bpm: 124, camelotCode: '8A' }),
          isPinned: true,
          addedAt: Date.now()
        },
        {
          id: 'q-2',
          track: createMockTrack({ id: 'u2', title: 'Neon Highway', artist: 'Cyberwave', bpm: 125, camelotCode: '9A' }),
          isPinned: false,
          addedAt: Date.now() + 1
        }
      ];

      render(
        <PartyModeView
          currentTrack={currentTrack}
          upcomingTracks={upcomingItems}
          isPlaying={true}
          currentTime={150}
          duration={200}
          isTransitioning={false}
          onTriggerTransition={vi.fn()}
          activeProfile="building"
        />
      );

      // Verify track focus
      expect(screen.getByText('Midnight Anthem')).toBeDefined();
      expect(screen.getByText('Starlight')).toBeDefined();

      // Verify vibe selector card
      expect(screen.getByText('Rising Energy')).toBeDefined();
      expect(screen.getByText('Steady Flow')).toBeDefined();

      // Verify upcoming flow items
      expect(screen.getByText('Solar Flare')).toBeDefined();
      expect(screen.getByText('Neon Highway')).toBeDefined();

      // Verify countdown timer: (200 - 150 = 50s -> 0:50)
      expect(screen.getByText('0:50')).toBeDefined();
    });

    it('triggers emergency "MIX NOW" transition button and skip overrides', () => {
      const onTriggerTransition = vi.fn();
      const onSkipNext = vi.fn();
      const onSelectVibe = vi.fn();
      const onPinTrack = vi.fn();

      const currentTrack = createMockTrack({ title: 'Drop The Bass' });
      const upcomingItems: QueueItem[] = [
        {
          id: 'q-pin-test',
          track: createMockTrack({ id: 't-pin', title: 'Pinned Anthem' }),
          isPinned: false,
          addedAt: Date.now()
        }
      ];

      render(
        <PartyModeView
          currentTrack={currentTrack}
          upcomingTracks={upcomingItems}
          isPlaying={true}
          currentTime={120}
          duration={180}
          isTransitioning={false}
          onTriggerTransition={onTriggerTransition}
          onSkipNext={onSkipNext}
          onSelectVibe={onSelectVibe}
          onPinTrack={onPinTrack}
        />
      );

      // Emergency "MIX NOW" button
      const mixNowBtn = screen.getByRole('button', { name: /MIX NOW/i });
      fireEvent.click(mixNowBtn);
      expect(onTriggerTransition).toHaveBeenCalledTimes(1);

      // Emergency "SKIP" button
      const skipBtn = screen.getByRole('button', { name: /SKIP/i });
      fireEvent.click(skipBtn);
      expect(onSkipNext).toHaveBeenCalledTimes(1);

      // Selecting "Peak Hour" vibe
      const peakHourCard = screen.getByText('Peak Hour');
      fireEvent.click(peakHourCard);
      expect(onSelectVibe).toHaveBeenCalledWith('peak');

      // Toggling track pin
      const pinBtn = screen.getByTitle('Pin to position');
      fireEvent.click(pinBtn);
      expect(onPinTrack).toHaveBeenCalledWith('q-pin-test');
    });

    it('toggles fullscreen visualizer view on button click', () => {
      const { container } = render(
        <PartyModeView
          currentTrack={createMockTrack()}
          onTriggerTransition={vi.fn()}
        />
      );

      const fullscreenBtn = screen.getByTitle('Enter Fullscreen Party Mode');
      expect(container.querySelector('.party-fullscreen')).toBeNull();

      fireEvent.click(fullscreenBtn);
      expect(container.querySelector('.party-fullscreen')).not.toBeNull();

      const exitFullscreenBtn = screen.getByTitle('Exit Fullscreen');
      fireEvent.click(exitFullscreenBtn);
      expect(container.querySelector('.party-fullscreen')).toBeNull();
    });
  });
});
