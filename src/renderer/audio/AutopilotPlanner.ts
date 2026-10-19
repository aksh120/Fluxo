/**
 * AutopilotPlanner.ts
 * Autonomous Set & Energy Arc Planning Engine for Fluxo Autopilot.
 * Evaluates candidate tracks across the user's accessible library using
 * multi-factor musical compatibility and energy progression models.
 */

import type { TrackMetadata, TrackAnalysis } from '../../shared/types';
import {
  TransitionPlanner,
  type PlannedTransition,
  type TransitionFactors
} from './TransitionPlanner';
import type {
  AutopilotConfig,
  AutopilotEnergyProfile,
  PlannedSetItem
} from './AutopilotTypes';
import { calculateHarmonicScore } from '../../shared/dj/compatibility';

export class AutopilotPlanner {
  private transitionPlanner: TransitionPlanner;

  constructor() {
    this.transitionPlanner = new TransitionPlanner();
  }

  /**
   * Computes target energy levels for each position in the set arc.
   */
  public calculateEnergyArcTargets(profile: AutopilotEnergyProfile, length: number): number[] {
    const targets: number[] = [];
    if (length <= 0) return targets;

    for (let i = 0; i < length; i++) {
      const progress = length === 1 ? 0.5 : i / (length - 1);
      let target: number;

      switch (profile) {
        case 'warmup':
          // Starts gentle (0.30), gradually warms up to 0.55
          target = 0.3 + 0.25 * progress;
          break;
        case 'building':
          // Starts moderate (0.45), builds steadily to peak energy (0.88)
          target = 0.45 + 0.43 * Math.pow(progress, 0.9);
          break;
        case 'steady':
          // Consistent driving groove around 0.65 - 0.75
          target = 0.68 + 0.07 * Math.sin(progress * Math.PI * 2);
          break;
        case 'peak':
          // Sustained high-energy party delivery (0.85 - 0.95)
          target = 0.88 + 0.07 * Math.sin(progress * Math.PI * 3);
          break;
        case 'continuous':
          // Rolling dynamic energy waves (0.70 - 0.88)
          target = 0.78 + 0.1 * Math.sin(progress * Math.PI * 4);
          break;
        case 'winddown':
          // Graceful gradual descent from 0.85 down to 0.35
          target = 0.85 - 0.5 * progress;
          break;
        default:
          target = 0.65;
      }
      targets.push(Math.max(0.1, Math.min(1.0, Number(target.toFixed(3)))));
    }

    return targets;
  }

  /**
   * Plans or regenerates the upcoming set sequence while preserving user-locked tracks.
   */
  public planSetSequence(
    currentTrack: TrackMetadata | null,
    library: TrackMetadata[],
    analyses: Map<string, TrackAnalysis>,
    config: AutopilotConfig,
    existingQueue: PlannedSetItem[] = [],
    recentlyPlayedTrackIds: string[] = [],
    targetQueueLength: number = 8
  ): PlannedSetItem[] {
    if (!library || library.length === 0) {
      return [];
    }

    // Filter out excluded tracks or excluded folders
    const eligibleLibrary = library.filter((trk) => {
      if (config.excludedTrackIds.includes(trk.id)) return false;
      if (config.excludedFolders.some((f) => trk.filePath.toLowerCase().startsWith(f.toLowerCase()))) {
        return false;
      }
      return true;
    });

    if (eligibleLibrary.length === 0) return [];

    const energyTargets = this.calculateEnergyArcTargets(config.energyProfile, targetQueueLength);
    const newQueue: PlannedSetItem[] = [];

    // Track IDs already allocated in the new queue or recent history
    const allocatedTrackIds = new Set<string>();
    if (currentTrack) allocatedTrackIds.add(currentTrack.id);

    // Repetition tolerance window
    const recentWindow = recentlyPlayedTrackIds.slice(-config.repetitionToleranceTracks);
    for (const id of recentWindow) {
      allocatedTrackIds.add(id);
    }

    // First, preserve locked items from existing queue in their positions
    for (let pos = 0; pos < targetQueueLength; pos++) {
      const existing = existingQueue[pos];
      if (existing && existing.isLocked && existing.track) {
        newQueue[pos] = existing;
        allocatedTrackIds.add(existing.track.id);
      }
    }

    let previousTrack = currentTrack;

    // Fill unfilled positions
    for (let pos = 0; pos < targetQueueLength; pos++) {
      if (newQueue[pos]) {
        // Locked item was already placed; update reference track for next transition
        previousTrack = newQueue[pos].track;
        continue;
      }

      const targetEnergy = energyTargets[pos] ?? 0.65;

      // Filter available candidates
      let candidatePool = eligibleLibrary.filter((t) => !allocatedTrackIds.has(t.id));

      // If library size is smaller than repetition window, loosen repetition restriction
      if (candidatePool.length === 0) {
        candidatePool = eligibleLibrary.filter(
          (t) => t.id !== previousTrack?.id && !newQueue.some((q) => q && q.track.id === t.id)
        );
      }
      if (candidatePool.length === 0) {
        candidatePool = eligibleLibrary;
      }

      // Score candidates against previous track and target energy
      let bestCandidate: TrackMetadata = candidatePool[0];
      let bestScore = -Infinity;
      let bestPlan: PlannedTransition | null = null;

      for (const candidate of candidatePool) {
        const evaluation = this.evaluateCandidate(
          previousTrack,
          candidate,
          targetEnergy,
          analyses,
          config
        );

        if (evaluation.score > bestScore) {
          bestScore = evaluation.score;
          bestCandidate = candidate;
          bestPlan = evaluation.transitionPlan;
        }
      }

      const candidateAnalysis = analyses.get(bestCandidate.id) ?? null;
      const readinessStatus: PlannedSetItem['readinessStatus'] = candidateAnalysis
        ? candidateAnalysis.stemsPath
          ? 'ready'
          : 'fallback_ready'
        : 'pending';

      const setItem: PlannedSetItem = {
        id: `autopilot-item-${Date.now()}-${pos}-${bestCandidate.id}`,
        track: bestCandidate,
        analysis: candidateAnalysis,
        isLocked: false,
        plannedTransition: bestPlan,
        readinessStatus,
        targetEnergyLevel: targetEnergy
      };

      newQueue[pos] = setItem;
      allocatedTrackIds.add(bestCandidate.id);
      previousTrack = bestCandidate;
    }

    return newQueue;
  }

  /**
   * Evaluates a candidate next track relative to the active track and target energy.
   */
  public evaluateCandidate(
    fromTrack: TrackMetadata | null,
    toTrack: TrackMetadata,
    targetEnergy: number,
    analyses: Map<string, TrackAnalysis>,
    config: AutopilotConfig
  ): { score: number; transitionPlan: PlannedTransition | null } {
    if (!fromTrack) {
      // Starting track evaluation: score closeness to target energy
      const toAnalysis = analyses.get(toTrack.id);
      const toEnergy = toAnalysis?.energyLevel ?? 0.5;
      const energyCloseness = 1.0 - Math.abs(toEnergy - targetEnergy);
      return {
        score: energyCloseness * 100,
        transitionPlan: null
      };
    }

    const fromAnalysis = analyses.get(fromTrack.id);
    const toAnalysis = analyses.get(toTrack.id);

    // 1. Plan transition using TransitionPlanner
    const plan = this.transitionPlanner.planTransition(
      fromTrack,
      fromAnalysis ?? null,
      toTrack,
      toAnalysis ?? null,
      null,
      null,
      Boolean(fromAnalysis?.stemsPath),
      Boolean(toAnalysis?.stemsPath)
    );

    // 2. Energy Arc Fit (Closeness to target energy)
    const toEnergy = toAnalysis?.energyLevel ?? 0.5;
    const energyDelta = Math.abs(toEnergy - targetEnergy);
    const energyScore = Math.max(0, 1.0 - energyDelta * 1.5);

    // 3. Harmonic score
    let harmonicScore = 0.5;
    if (fromAnalysis?.camelotCode && toAnalysis?.camelotCode) {
      const harmResult = calculateHarmonicScore(
        { camelotCode: fromAnalysis.camelotCode, title: fromTrack.title, artist: fromTrack.artist },
        { camelotCode: toAnalysis.camelotCode, title: toTrack.title, artist: toTrack.artist }
      );
      harmonicScore = harmResult.score > 1.0 ? harmResult.score / 100.0 : harmResult.score;
    }

    // 4. Vocal Preference weighting
    let vocalFitBonus = 0;
    if (config.vocalPreferenceRatio > 0.6 && plan.family === 'vocal_crossover') {
      vocalFitBonus = 0.15 * config.vocalPreferenceRatio;
    } else if (config.vocalPreferenceRatio < 0.3 && plan.family === 'instrumental_handoff') {
      vocalFitBonus = 0.15 * (1.0 - config.vocalPreferenceRatio);
    }

    // Composite total score (0 to 100)
    const compositeScore =
      (plan.confidence * 100) * 0.45 +
      energyScore * 30 +
      harmonicScore * 15 +
      vocalFitBonus * 10;

    return {
      score: Number(compositeScore.toFixed(2)),
      transitionPlan: plan
    };
  }
}
