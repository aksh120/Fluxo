/**
 * TransitionPlanner.ts
 * Professional AI DJ Transition Planning Engine
 * Evaluates track pairs and selects optimal mixing strategies across 9 transition families:
 * A. phrase_beatmix (Phrase-aligned beatmix)
 * B. bass_swap (Bass swap)
 * C. vocal_crossover (Vocal crossover)
 * D. instrumental_handoff (Instrumental handoff)
 * E. breakdown_build (Breakdown-to-build-up)
 * F. drop_transition (Drop transition)
 * G. echo_out (Echo-out or filter transition)
 * H. fallback_crossfade (Intelligent crossfade fallback)
 * I. creative_mashup (Creative mashup)
 */

import type { Track, TrackAnalysis } from '../../shared/types';
import type { VocalAnalysisResult } from '../../shared/analysis/VocalActivityDetector';
import { calculateHarmonicScore } from '../../shared/dj/compatibility';

export type TransitionFamily =
  | 'phrase_beatmix'
  | 'bass_swap'
  | 'vocal_crossover'
  | 'instrumental_handoff'
  | 'breakdown_build'
  | 'drop_transition'
  | 'echo_out'
  | 'fallback_crossfade'
  | 'creative_mashup';

export interface TransitionInspectableFactors {
  tempoScore: number;       // 0.0 to 1.0 (BPM shift feasibility & half/double time)
  keyScore: number;         // 0.0 to 1.0 (Camelot Wheel harmonic match)
  phraseScore: number;      // 0.0 to 1.0 (Downbeat & 4/8/16 bar phrase alignment)
  vocalScore: number;       // 0.0 to 1.0 (Collision safety & crossover viability)
  energyScore: number;      // 0.0 to 1.0 (Loudness & RMS continuity)
  stemAvailability: boolean;// True if separated stems exist for at least one track
}

export interface TransitionTimingPlan {
  transitionStartA: number;    // In seconds on Track A
  transitionEndA: number;      // In seconds on Track A
  startOffsetB: number;        // Track B initial playhead position
  durationBars: number;        // 4, 8, 16, or 32 bars
  durationSeconds: number;     // In seconds
  bassSwapTimeA?: number;      // Timestamp on Track A for bass swap
  vocalHandoffTimeA?: number;   // Timestamp on Track A for vocal handoff
}

export interface TransitionPlan {
  family: TransitionFamily;
  confidence: number;          // Overall confidence score 0.0 to 1.0
  factors: TransitionInspectableFactors;
  timing: TransitionTimingPlan;
  explanation: string;         // Human-readable, DJ-grade explanation
  isFallback: boolean;
}

export class TransitionPlanner {
  /**
   * Plans the most musical, seamless DJ transition between Track A and Track B.
   */
  public planTransition(
    trackA: Track,
    analysisA: TrackAnalysis | null,
    trackB: Track,
    analysisB: TrackAnalysis | null,
    vocalA?: VocalAnalysisResult | null,
    vocalB?: VocalAnalysisResult | null,
    hasStemsA = false,
    hasStemsB = false,
    forceFamily?: TransitionFamily
  ): TransitionPlan {
    // 1. Fallback evaluation if analysis is missing
    if (!analysisA || !analysisB || !trackA.bpm || !trackB.bpm) {
      return this.buildFallbackPlan(trackA, trackB);
    }

    const bpmA = trackA.bpm;
    const bpmB = trackB.bpm;

    // 2. Tempo compatibility score (supports 1x, 0.5x half-time, 2.0x double-time)
    const tempoRatio = bpmB / bpmA;
    let tempoScore = 0.5;
    if (Math.abs(tempoRatio - 1.0) <= 0.08) {
      tempoScore = 1.0 - Math.abs(tempoRatio - 1.0) / 0.08 * 0.2; // 0.8 - 1.0
    } else if (Math.abs(tempoRatio - 0.5) <= 0.05 || Math.abs(tempoRatio - 2.0) <= 0.1) {
      tempoScore = 0.85; // Half/double-time match
    } else if (Math.abs(tempoRatio - 1.0) <= 0.16) {
      tempoScore = 0.65;
    } else {
      tempoScore = 0.3; // Significant tempo jump
    }

    // 3. Harmonic Key compatibility score
    let keyScore = 0.5;
    if (analysisA.key && analysisB.key) {
      const harm = calculateHarmonicScore(
        { camelotCode: analysisA.key, title: trackA.title, artist: trackA.artist },
        { camelotCode: analysisB.key, title: trackB.title, artist: trackB.artist }
      );
      keyScore = harm.score;
    }

    // 4. Energy continuity score
    const energyA = analysisA.energy ?? 0.5;
    const energyB = analysisB.energy ?? 0.5;
    const energyDelta = Math.abs(energyA - energyB);
    const energyScore = Math.max(0.2, 1.0 - energyDelta * 1.2);

    // 5. Phrase alignment calculation
    const beatDurationA = 60 / bpmA;
    const barDurationA = beatDurationA * 4;
    const phraseScore = (analysisA.beatGrid && analysisB.beatGrid) ? 0.95 : 0.7;

    // 6. Vocal activity evaluation
    const vocalRatioA = vocalA?.vocalActivityRatio ?? 0.4;
    const vocalRatioB = vocalB?.vocalActivityRatio ?? 0.4;
    const stemAvailability = hasStemsA || hasStemsB;

    let vocalScore = 0.75;
    if (vocalRatioA > 0.6 && vocalRatioB > 0.6 && !stemAvailability) {
      vocalScore = 0.35; // High collision risk without stem isolation
    } else if (stemAvailability) {
      vocalScore = 0.95; // Stems eliminate vocal competition!
    }

    const factors: TransitionInspectableFactors = {
      tempoScore,
      keyScore,
      phraseScore,
      vocalScore,
      energyScore,
      stemAvailability
    };

    // Calculate duration in bars & seconds (default 16 bars for standard phrasing, 8 for quick, 32 for slow)
    let durationBars = 16;
    if (tempoScore < 0.5) durationBars = 8; // Quick exit on large tempo clash
    const durationSeconds = durationBars * barDurationA;

    // Determine transition window on Track A (usually around outroTime or 75% through track)
    const outroTimeA = analysisA.outroTime ?? Math.max(0, trackA.duration - durationSeconds - 5);
    const transitionStartA = Math.max(0, outroTimeA);
    const transitionEndA = Math.min(trackA.duration, transitionStartA + durationSeconds);
    const bassSwapTimeA = transitionStartA + (durationSeconds * 0.5);

    // 7. Select optimal Transition Family
    let family: TransitionFamily = forceFamily ?? 'phrase_beatmix';
    let explanation = '';
    let confidence = 0.8;

    if (!forceFamily) {
      // Decision Matrix:
      if (tempoScore < 0.45) {
        // Large tempo divergence: Echo-Out or Filter Sweep avoids dissonance
        family = 'echo_out';
        explanation = `Echo-out wash transition applied due to significant tempo difference (${Math.round(bpmA)} → ${Math.round(bpmB)} BPM).`;
        confidence = 0.82;
      } else if (stemAvailability && vocalRatioA > 0.3 && keyScore >= 0.7) {
        // Vocal Crossover: Song A vocal over Song B instrumental, then phrase handoff
        family = 'vocal_crossover';
        explanation = 'Incoming instrumental begins underneath active vocal phrase. Outgoing vocal continues for 8 bars with mid-frequency masking suppression before handoff to Song B.';
        confidence = 0.94;
      } else if (analysisB.dropTime && analysisB.dropTime > 10 && energyB >= 0.75 && energyA <= 0.6) {
        // Breakdown to Build-up / Drop transition
        family = 'breakdown_build';
        explanation = `Transitioning from Track A's quieter section directly into Track B's build-up and drop at ${Math.round(analysisB.dropTime)}s.`;
        confidence = 0.88;
      } else if (vocalRatioA < 0.2 && vocalRatioB < 0.2) {
        // Both instrumental sections
        family = 'instrumental_handoff';
        explanation = 'Seamless instrumental groove handoff preserving steady rhythmic percussion without vocal distraction.';
        confidence = 0.92;
      } else if (keyScore >= 0.75 && tempoScore >= 0.8) {
        // Harmonically compatible bass swap
        family = 'bass_swap';
        explanation = `Phrase-locked bass swap on the downbeat at bar ${durationBars / 2}. Low-end frequencies cleanly swapped to eliminate kick drum collision.`;
        confidence = 0.95;
      } else {
        // Standard phrase beatmix
        family = 'phrase_beatmix';
        explanation = `16-bar phrase-aligned beatmix matching tempos (${Math.round(bpmB)} BPM) with smooth equal-power crossfade.`;
        confidence = 0.85;
      }
    } else {
      explanation = `Manual selection: ${family} transition scheduled over ${durationBars} bars.`;
      confidence = 0.9;
    }

    const timing: TransitionTimingPlan = {
      transitionStartA,
      transitionEndA,
      startOffsetB: 0,
      durationBars,
      durationSeconds,
      bassSwapTimeA,
      vocalHandoffTimeA: family === 'vocal_crossover' ? transitionStartA + (durationSeconds * 0.5) : undefined
    };

    return {
      family,
      confidence,
      factors,
      timing,
      explanation,
      isFallback: false
    };
  }

  /**
   * Fast fallback plan when deep analysis is unavailable.
   */
  private buildFallbackPlan(trackA: Track, trackB: Track): TransitionPlan {
    const durationSeconds = 8.0;
    const transitionStartA = Math.max(0, trackA.duration - durationSeconds - 2.0);
    const transitionEndA = trackA.duration;

    return {
      family: 'fallback_crossfade',
      confidence: 0.6,
      factors: {
        tempoScore: 0.5,
        keyScore: 0.5,
        phraseScore: 0.5,
        vocalScore: 0.5,
        energyScore: 0.5,
        stemAvailability: false
      },
      timing: {
        transitionStartA,
        transitionEndA,
        startOffsetB: 0,
        durationBars: 4,
        durationSeconds
      },
      explanation: 'Intelligent frequency-aware fallback crossfade active while deep background audio analysis processes.',
      isFallback: true
    };
  }
}
