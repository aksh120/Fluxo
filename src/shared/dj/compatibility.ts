import type { TrackMetadata } from '../types';
import { CAMELOT_MAP } from '../analysis/KeyClassifier';

export type HarmonicRelation =
  | 'identical'    // Same key & mode (e.g. 8A -> 8A)
  | 'relative'     // Relative major/minor (e.g. 8A -> 8B)
  | 'adjacent'     // +/- 1 step on Camelot circle (e.g. 8A -> 9A, 8A -> 7A)
  | 'diagonal'     // +/- 1 step + mode flip (e.g. 8A -> 9B)
  | 'energy_boost' // +1 or +2 semitones / +7 Camelot (e.g. 8A -> 10A)
  | 'clash'        // Distant / clashing keys
  | 'unknown';      // Missing key metadata

export interface CompatibilityWeights {
  keyWeight: number;    // Default 0.45
  bpmWeight: number;    // Default 0.35
  energyWeight: number; // Default 0.20
}

export const DEFAULT_COMPATIBILITY_WEIGHTS: CompatibilityWeights = {
  keyWeight: 0.45,
  bpmWeight: 0.35,
  energyWeight: 0.20
};

export interface CompatibilityOptions {
  weights?: Partial<CompatibilityWeights>;
  targetEnergy?: number;
  penalizeSameArtist?: boolean;
  artistClashPenalty?: number;
  feedbackAdjustment?: number; // Preference boost/penalty (-0.5 to +0.5)
}

export interface CompatibilityScore {
  totalScore: number;        // 0.0 - 1.0 (Composite match rating)
  keyScore: number;          // 0.0 - 1.0
  bpmScore: number;          // 0.0 - 1.0
  energyScore: number;       // 0.0 - 1.0
  harmonicRelation: HarmonicRelation;
  bpmDeltaRatio: number;     // Absolute tempo difference ratio (|B2 - B1| / B1)
  effectiveBpm: number;      // Effective BPM after considering half/double time
  halfOrDoubleTime: boolean; // True if half or double time tempo match was used
  artistPenalty: number;     // Penalty applied if same artist back-to-back
  feedbackBoost: number;     // Positive/negative modifier from local learning
}

/**
 * Extracts and normalizes Camelot code (e.g. "8A", "8B", "11A")
 * If only musicalKey is provided (e.g. "Am", "C"), converts via CAMELOT_MAP.
 */
export function extractCamelotCode(track: TrackMetadata): { number: number; letter: 'A' | 'B' } | null {
  let code = track.camelotCode?.trim().toUpperCase();

  if (!code && track.musicalKey) {
    const mapped = CAMELOT_MAP[track.musicalKey.trim()];
    if (mapped) {
      code = mapped.toUpperCase();
    }
  }

  if (!code) return null;

  const match = code.match(/^([1-9]|1[0-2])([AB])$/);
  if (!match) return null;

  return {
    number: parseInt(match[1], 10),
    letter: match[2] as 'A' | 'B'
  };
}

/**
 * Calculates harmonic musical key compatibility score between two tracks
 */
export function calculateHarmonicScore(
  current: TrackMetadata,
  candidate: TrackMetadata
): { score: number; relation: HarmonicRelation } {
  const currentKey = extractCamelotCode(current);
  const candidateKey = extractCamelotCode(candidate);

  if (!currentKey || !candidateKey) {
    return { score: 0.5, relation: 'unknown' };
  }

  const numDiff = Math.abs(currentKey.number - candidateKey.number);
  const circularDistance = Math.min(numDiff, 12 - numDiff);
  const sameMode = currentKey.letter === candidateKey.letter;

  if (sameMode) {
    if (circularDistance === 0) {
      return { score: 1.0, relation: 'identical' };
    }
    if (circularDistance === 1) {
      return { score: 0.92, relation: 'adjacent' };
    }
    if (circularDistance === 2) {
      return { score: 0.65, relation: 'energy_boost' };
    }
    // Clashing keys on circle
    const penalty = (circularDistance - 2) * 0.1;
    return { score: Math.max(0.1, 0.45 - penalty), relation: 'clash' };
  } else {
    // Different mode (Major vs Minor)
    if (circularDistance === 0) {
      // Relative major/minor (e.g. 8A to 8B)
      return { score: 0.95, relation: 'relative' };
    }
    if (circularDistance === 1) {
      // Diagonal jump (e.g. 8A to 9B or 7B)
      return { score: 0.72, relation: 'diagonal' };
    }
    // Clashing mode and distant number
    const penalty = (circularDistance - 1) * 0.08;
    return { score: Math.max(0.05, 0.35 - penalty), relation: 'clash' };
  }
}

/**
 * Calculates tempo compatibility score between two tracks.
 * Seamlessly accounts for half-time / double-time mixing (e.g., 70 <-> 140 BPM).
 */
export function calculateBpmScore(
  currentBpm: number | undefined,
  candidateBpm: number | undefined
): { score: number; deltaRatio: number; effectiveBpm: number; halfOrDoubleTime: boolean } {
  if (!currentBpm || !candidateBpm || currentBpm <= 0 || candidateBpm <= 0) {
    return {
      score: 0.5,
      deltaRatio: 0,
      effectiveBpm: candidateBpm || currentBpm || 120,
      halfOrDoubleTime: false
    };
  }

  // Evaluate normal, double-time, and half-time alternatives
  const multipliers = [1.0, 2.0, 0.5];
  let bestDeltaRatio = Infinity;
  let bestEffectiveBpm = candidateBpm;
  let isHalfOrDouble = false;

  for (const m of multipliers) {
    const candidateEffective = candidateBpm * m;
    const deltaRatio = Math.abs(candidateEffective - currentBpm) / currentBpm;
    if (deltaRatio < bestDeltaRatio) {
      bestDeltaRatio = deltaRatio;
      bestEffectiveBpm = candidateEffective;
      isHalfOrDouble = m !== 1.0;
    }
  }

  // Piecewise continuous scoring curve:
  // <= 2% difference: perfect tempo lock (1.0)
  // <= 6% difference: 1.0 -> 0.85 (smooth pitch bend range)
  // <= 12% difference: 0.85 -> 0.50
  // <= 25% difference: 0.50 -> 0.10
  // > 25% difference: heavy tempo clash
  let score: number;
  if (bestDeltaRatio <= 0.02) {
    score = 1.0;
  } else if (bestDeltaRatio <= 0.06) {
    score = 1.0 - ((bestDeltaRatio - 0.02) / 0.04) * 0.15;
  } else if (bestDeltaRatio <= 0.12) {
    score = 0.85 - ((bestDeltaRatio - 0.06) / 0.06) * 0.35;
  } else if (bestDeltaRatio <= 0.25) {
    score = 0.50 - ((bestDeltaRatio - 0.12) / 0.13) * 0.40;
  } else {
    score = Math.max(0.0, 0.10 - (bestDeltaRatio - 0.25) * 0.4);
  }

  return {
    score: Math.max(0.0, Math.min(1.0, score)),
    deltaRatio: bestDeltaRatio,
    effectiveBpm: Math.round(bestEffectiveBpm * 100) / 100,
    halfOrDoubleTime: isHalfOrDouble
  };
}

/**
 * Calculates energy compatibility score.
 * If targetEnergy is provided, scores candidate against target;
 * otherwise scores candidate against current track's energy.
 */
export function calculateEnergyScore(
  candidateEnergy: number | undefined,
  currentEnergy: number | undefined,
  targetEnergy?: number
): number {
  const candidate = candidateEnergy !== undefined ? candidateEnergy : 0.5;

  if (targetEnergy !== undefined) {
    const delta = Math.abs(candidate - targetEnergy);
    return Math.max(0.0, Math.min(1.0, 1.0 - delta * 1.5));
  }

  const current = currentEnergy !== undefined ? currentEnergy : 0.5;
  const delta = Math.abs(candidate - current);
  return Math.max(0.0, Math.min(1.0, 1.0 - delta * 1.3));
}

/**
 * Computes composite compatibility score ($0.0 - 1.0$) between current and candidate track.
 */
export function calculateTrackCompatibility(
  current: TrackMetadata,
  candidate: TrackMetadata,
  options: CompatibilityOptions = {}
): CompatibilityScore {
  const weights: CompatibilityWeights = {
    ...DEFAULT_COMPATIBILITY_WEIGHTS,
    ...options.weights
  };

  // 1. Harmonic score
  const harmonic = calculateHarmonicScore(current, candidate);

  // 2. BPM score
  const bpm = calculateBpmScore(current.bpm, candidate.bpm);

  // 3. Energy score
  const energyScore = calculateEnergyScore(
    candidate.energyLevel,
    current.energyLevel,
    options.targetEnergy
  );

  // 4. Artist clash penalty
  let artistPenalty = 0;
  if (options.penalizeSameArtist ?? true) {
    const curArtist = current.artist?.trim().toLowerCase();
    const candArtist = candidate.artist?.trim().toLowerCase();
    if (
      curArtist &&
      candArtist &&
      curArtist === candArtist &&
      curArtist !== 'unknown artist'
    ) {
      artistPenalty = options.artistClashPenalty ?? 0.25;
    }
  }

  // 5. Local feedback boost / penalty
  const feedbackBoost = options.feedbackAdjustment ?? 0;

  // Composite weighted sum
  const rawScore =
    harmonic.score * weights.keyWeight +
    bpm.score * weights.bpmWeight +
    energyScore * weights.energyWeight +
    feedbackBoost -
    artistPenalty;

  const totalScore = Math.max(0.0, Math.min(1.0, Math.round(rawScore * 1000) / 1000));

  return {
    totalScore,
    keyScore: Math.round(harmonic.score * 1000) / 1000,
    bpmScore: Math.round(bpm.score * 1000) / 1000,
    energyScore: Math.round(energyScore * 1000) / 1000,
    harmonicRelation: harmonic.relation,
    bpmDeltaRatio: Math.round(bpm.deltaRatio * 1000) / 1000,
    effectiveBpm: bpm.effectiveBpm,
    halfOrDoubleTime: bpm.halfOrDoubleTime,
    artistPenalty,
    feedbackBoost
  };
}

/**
 * Ranks an array of candidate tracks by compatibility with current track
 */
export function rankCandidates(
  current: TrackMetadata,
  candidates: TrackMetadata[],
  options: CompatibilityOptions = {}
): Array<{ track: TrackMetadata; score: CompatibilityScore }> {
  return candidates
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate) => ({
      track: candidate,
      score: calculateTrackCompatibility(current, candidate, options)
    }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore);
}
