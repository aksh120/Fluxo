import type { CuePoint } from '../types';

export interface SongSection {
  type: 'intro' | 'verse' | 'drop' | 'breakdown' | 'outro';
  startTime: number;
  duration: number;
  energyScore: number;
}

export interface StructureAnalysisResult {
  sections: SongSection[];
  suggestedCuePoints: CuePoint[];
  dropTime: number; // Primary drop timestamp
  outroTime: number; // Mix-out transition trigger timestamp
}

export class StructureEstimator {
  /**
   * Estimates song structure, drop location, and outro transition landmarks
   */
  public estimateStructure(
    samples: Float32Array,
    sampleRate: number,
    trackId: string,
    totalDuration: number
  ): StructureAnalysisResult {
    const segmentDuration = 2.0; // 2-second segments
    const segmentSamples = Math.floor(sampleRate * segmentDuration);
    const numSegments = Math.max(1, Math.floor(samples.length / segmentSamples));

    const segmentEnergies = new Float32Array(numSegments);
    let maxEnergy = -Infinity;
    let maxEnergyIdx = 0;

    for (let s = 0; s < numSegments; s++) {
      const start = s * segmentSamples;
      let sumSq = 0.0;
      for (let i = 0; i < segmentSamples; i++) {
        const val = samples[start + i];
        sumSq += val * val;
      }
      const rms = Math.sqrt(sumSq / segmentSamples);
      segmentEnergies[s] = rms;

      if (rms > maxEnergy) {
        maxEnergy = rms;
        maxEnergyIdx = s;
      }
    }

    // 1. Estimate Intro: from 0s to first point energy exceeds 60% of max, or default 16s/32s
    let introEndIdx = Math.floor(16 / segmentDuration); // Default 16s
    for (let s = 0; s < numSegments; s++) {
      if (segmentEnergies[s] >= maxEnergy * 0.65) {
        introEndIdx = Math.max(4, s);
        break;
      }
    }
    const introDuration = Math.min(totalDuration * 0.3, introEndIdx * segmentDuration);

    // 2. Estimate Drop (highest energy build): around maxEnergyIdx
    const dropTime = Math.max(introDuration, maxEnergyIdx * segmentDuration);

    // 3. Estimate Outro: point near the end (last 15-20% of track) where energy drops significantly
    let outroStartIdx = Math.floor(numSegments * 0.85); // Default last 15%
    for (let s = numSegments - 1; s >= Math.floor(numSegments * 0.6); s--) {
      if (segmentEnergies[s] >= maxEnergy * 0.6) {
        outroStartIdx = s + 1;
        break;
      }
    }
    const outroTime = Math.min(totalDuration - 5, Math.max(totalDuration * 0.75, outroStartIdx * segmentDuration));

    // Construct structured sections
    const sections: SongSection[] = [
      {
        type: 'intro',
        startTime: 0,
        duration: introDuration,
        energyScore: 0.35
      },
      {
        type: 'drop',
        startTime: dropTime,
        duration: Math.max(15, (outroTime - dropTime) * 0.5),
        energyScore: 0.95
      },
      {
        type: 'outro',
        startTime: outroTime,
        duration: totalDuration - outroTime,
        energyScore: 0.4
      }
    ];

    // Generate suggested CuePoints
    const suggestedCuePoints: CuePoint[] = [
      {
        id: `cue_${trackId}_intro`,
        trackId,
        name: 'Intro Mix In',
        timestamp: 0,
        type: 'intro',
        color: '#00F2FE'
      },
      {
        id: `cue_${trackId}_drop`,
        trackId,
        name: 'Main Drop',
        timestamp: dropTime,
        type: 'drop',
        color: '#FF007A'
      },
      {
        id: `cue_${trackId}_outro`,
        trackId,
        name: 'Outro Mix Out',
        timestamp: outroTime,
        type: 'outro',
        color: '#A855F7'
      }
    ];

    return {
      sections,
      suggestedCuePoints,
      dropTime,
      outroTime
    };
  }
}
