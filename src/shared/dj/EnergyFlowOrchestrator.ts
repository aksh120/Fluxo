import type { TrackMetadata } from '../types';
import { calculateTrackCompatibility, CompatibilityScore } from './compatibility';

export type EnergyProfileType = 'steady' | 'building' | 'wave' | 'peak';

export interface EnergyProfileConfig {
  type: EnergyProfileType;
  name: string;
  description: string;
  iconName: string;
  calculateTargetEnergy: (index: number, totalTracks: number) => number;
}

export const ENERGY_PROFILES: Record<EnergyProfileType, EnergyProfileConfig> = {
  steady: {
    type: 'steady',
    name: 'Steady Flow',
    description: 'Maintains uniform tempo and balanced dancefloor energy with subtle variations',
    iconName: 'Radio',
    calculateTargetEnergy: () => 0.55
  },
  building: {
    type: 'building',
    name: 'Rising Energy',
    description: 'Progressively elevates tempo, density, and energy to build up to a climax',
    iconName: 'Flame',
    calculateTargetEnergy: (index: number, totalTracks: number) => {
      if (totalTracks <= 1) return 0.70;
      const progress = index / Math.max(1, totalTracks - 1);
      // Linear ramp from 0.35 to 0.95
      return 0.35 + progress * 0.60;
    }
  },
  wave: {
    type: 'wave',
    name: 'Dynamic Waves',
    description: 'Alternates between energetic crescendos and melodic recovery valleys',
    iconName: 'Sparkles',
    calculateTargetEnergy: (index: number) => {
      // Periodic wave cycle with a period of ~5 tracks
      const cyclePos = (index % 5) / 5;
      return 0.55 + 0.30 * Math.sin(cyclePos * 2 * Math.PI);
    }
  },
  peak: {
    type: 'peak',
    name: 'Peak Hour',
    description: 'Sustained high-tempo and maximum intensity for peak-time dancefloor momentum',
    iconName: 'Zap',
    calculateTargetEnergy: () => 0.90
  }
};

export interface SequencedTrackItem {
  track: TrackMetadata;
  targetEnergy: number;
  isPinned: boolean;
  scoreWithPrevious?: CompatibilityScore;
}

export interface SequencingOptions {
  profile?: EnergyProfileType;
  pinnedTrackIds?: Set<string>;
  preserveFirstTrack?: boolean;
  penalizeSameArtist?: boolean;
}

export class EnergyFlowOrchestrator {
  private activeProfile: EnergyProfileType = 'building';

  constructor(initialProfile: EnergyProfileType = 'building') {
    this.activeProfile = initialProfile;
  }

  public getActiveProfile(): EnergyProfileType {
    return this.activeProfile;
  }

  public setActiveProfile(profile: EnergyProfileType): void {
    this.activeProfile = profile;
  }

  /**
   * Calculates the target energy for a given step index within a playlist.
   */
  public getTargetEnergy(index: number, totalTracks: number, profile: EnergyProfileType = this.activeProfile): number {
    const config = ENERGY_PROFILES[profile] || ENERGY_PROFILES.building;
    return config.calculateTargetEnergy(index, totalTracks);
  }

  /**
   * Sequences an array of tracks according to the chosen energy profile
   * while strictly preserving the positions of pinned tracks.
   */
  public sequenceTracks(
    tracks: TrackMetadata[],
    options: SequencingOptions = {}
  ): SequencedTrackItem[] {
    if (!tracks || tracks.length <= 1) {
      return tracks.map((t, idx) => ({
        track: t,
        targetEnergy: this.getTargetEnergy(idx, tracks.length, options.profile || this.activeProfile),
        isPinned: options.pinnedTrackIds?.has(t.id) ?? false
      }));
    }

    const profile = options.profile || this.activeProfile;
    const pinnedIds = options.pinnedTrackIds || new Set<string>();
    const total = tracks.length;

    // Track slots for the final sequenced output
    const output: Array<SequencedTrackItem | null> = new Array(total).fill(null);

    // Identify pinned tracks and preserve their exact slots
    const unplacedUnpinned: TrackMetadata[] = [];
    tracks.forEach((track, originalIndex) => {
      if (pinnedIds.has(track.id)) {
        output[originalIndex] = {
          track,
          targetEnergy: this.getTargetEnergy(originalIndex, total, profile),
          isPinned: true
        };
      } else {
        unplacedUnpinned.push(track);
      }
    });

    // If first track is preserved (e.g. currently playing track) and not already pinned:
    if ((options.preserveFirstTrack ?? true) && output[0] === null && tracks.length > 0) {
      const first = tracks[0];
      output[0] = {
        track: first,
        targetEnergy: this.getTargetEnergy(0, total, profile),
        isPinned: false
      };
      const idxInUnplaced = unplacedUnpinned.findIndex((t) => t.id === first.id);
      if (idxInUnplaced !== -1) {
        unplacedUnpinned.splice(idxInUnplaced, 1);
      }
    }

    // Sequentially fill empty slots using compatibility scoring & target energy
    let previousTrack: TrackMetadata | null = output[0]?.track ?? null;

    for (let slot = 0; slot < total; slot++) {
      if (output[slot] !== null) {
        // Slot is already occupied by a pinned track (or preserved first track)
        const currentItem = output[slot]!;
        if (slot > 0 && previousTrack) {
          currentItem.scoreWithPrevious = calculateTrackCompatibility(
            previousTrack,
            currentItem.track,
            {
              targetEnergy: currentItem.targetEnergy,
              penalizeSameArtist: options.penalizeSameArtist ?? true
            }
          );
        }
        previousTrack = currentItem.track;
        continue;
      }

      if (unplacedUnpinned.length === 0) {
        break;
      }

      const targetEnergy = this.getTargetEnergy(slot, total, profile);

      if (!previousTrack) {
        // No previous track: pick the candidate closest to target energy
        let bestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < unplacedUnpinned.length; i++) {
          const e = unplacedUnpinned[i].energyLevel ?? 0.5;
          const diff = Math.abs(e - targetEnergy);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
          }
        }
        const selected = unplacedUnpinned.splice(bestIdx, 1)[0];
        output[slot] = {
          track: selected,
          targetEnergy,
          isPinned: false
        };
        previousTrack = selected;
      } else {
        // Find candidate with the highest composite compatibility score targeting targetEnergy
        let bestIdx = 0;
        let bestScore: CompatibilityScore | null = null;
        let maxTotal = -1;

        for (let i = 0; i < unplacedUnpinned.length; i++) {
          const candidate = unplacedUnpinned[i];
          const score = calculateTrackCompatibility(previousTrack, candidate, {
            targetEnergy,
            penalizeSameArtist: options.penalizeSameArtist ?? true
          });

          if (score.totalScore > maxTotal) {
            maxTotal = score.totalScore;
            bestScore = score;
            bestIdx = i;
          }
        }

        const selected = unplacedUnpinned.splice(bestIdx, 1)[0];
        output[slot] = {
          track: selected,
          targetEnergy,
          isPinned: false,
          scoreWithPrevious: bestScore || undefined
        };
        previousTrack = selected;
      }
    }

    // Return all filled slots
    return output.filter((item): item is SequencedTrackItem => item !== null);
  }

  /**
   * Selects the single best next track from a pool of unplayed candidates
   * given the current track, current step, and energy profile.
   */
  public getNextBestCandidate(
    currentTrack: TrackMetadata,
    candidates: TrackMetadata[],
    stepIndex: number,
    totalTracks: number,
    profile: EnergyProfileType = this.activeProfile
  ): { track: TrackMetadata; score: CompatibilityScore } | null {
    if (!candidates || candidates.length === 0) return null;

    const targetEnergy = this.getTargetEnergy(stepIndex, totalTracks, profile);
    let bestCandidate: TrackMetadata | null = null;
    let bestScore: CompatibilityScore | null = null;
    let maxTotal = -1;

    for (const candidate of candidates) {
      if (candidate.id === currentTrack.id) continue;

      const score = calculateTrackCompatibility(currentTrack, candidate, {
        targetEnergy
      });

      if (score.totalScore > maxTotal) {
        maxTotal = score.totalScore;
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate || !bestScore) return null;

    return {
      track: bestCandidate,
      score: bestScore
    };
  }
}
