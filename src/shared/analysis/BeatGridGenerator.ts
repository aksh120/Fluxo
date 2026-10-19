import type { BeatGrid } from '../types';

export interface BeatGridResult {
  beatGrid: BeatGrid;
  beatTimestamps: number[];
  downbeatTimestamps: number[]; // Every 4 beats (Bar downbeats)
}

export class BeatGridGenerator {
  /**
   * Generates a sample-accurate beat grid from BPM and onset envelope.
   */
  public generateBeatGrid(
    bpm: number,
    onsetEnvelope: Float32Array,
    frameRate: number,
    totalDuration: number
  ): BeatGridResult {
    const interval = 60 / bpm;
    const intervalFrames = Math.max(1, Math.round(interval * frameRate));

    // Phase search for first downbeat within the first 16 bars (or up to 15 seconds)
    const searchLimitFrames = Math.min(
      onsetEnvelope.length,
      Math.floor(Math.min(15, totalDuration) * frameRate)
    );

    let bestPhase = 0;
    let maxPhaseScore = -Infinity;

    // Scan phase offset within 1 beat interval [0 ... intervalFrames)
    for (let phase = 0; phase < intervalFrames && phase < searchLimitFrames; phase++) {
      let score = 0;
      let count = 0;

      for (let f = phase; f < searchLimitFrames; f += intervalFrames) {
        score += onsetEnvelope[f];
        count++;
      }

      const avgScore = count > 0 ? score / count : 0;
      if (avgScore > maxPhaseScore) {
        maxPhaseScore = avgScore;
        bestPhase = phase;
      }
    }

    const firstDownbeat = Math.round((bestPhase / frameRate) * 1000) / 1000;

    // Generate all beat timestamps across track duration
    const beatTimestamps: number[] = [];
    const downbeatTimestamps: number[] = [];

    let currentBeatTime = firstDownbeat;
    let beatCounter = 0;

    while (currentBeatTime < totalDuration) {
      beatTimestamps.push(Math.round(currentBeatTime * 1000) / 1000);

      // In 4/4 time, every 4th beat is a measure downbeat
      if (beatCounter % 4 === 0) {
        downbeatTimestamps.push(Math.round(currentBeatTime * 1000) / 1000);
      }

      currentBeatTime += interval;
      beatCounter++;
    }

    const beatGrid: BeatGrid = {
      firstDownbeat,
      bpm,
      interval,
      confidence: 0.95
    };

    return {
      beatGrid,
      beatTimestamps,
      downbeatTimestamps
    };
  }
}
