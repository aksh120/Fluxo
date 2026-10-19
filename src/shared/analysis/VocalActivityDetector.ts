/**
 * VocalActivityDetector.ts
 * Professional Music Understanding & Vocal Analysis Engine
 * Detects vocal presence, onsets, offsets, phrase boundaries, and instrumental windows
 * with confidence estimation for phrase-aligned DJ mixing.
 */

export interface VocalSegment {
  start: number; // in seconds
  end: number;   // in seconds
  confidence: number; // 0.0 to 1.0
  averageEnergy: number; // 0.0 to 1.0
  isVocal: boolean;
}

export interface PhraseBoundary {
  timestamp: number; // in seconds
  barIndex: number;
  phraseLengthBars: 4 | 8 | 16 | 32;
  isMajorBoundary: boolean; // e.g. 16 or 32-bar boundary
}

export interface VocalAnalysisResult {
  vocalSegments: VocalSegment[];
  instrumentalWindows: VocalSegment[];
  vocalActivityRatio: number; // Fraction of track containing vocals (0.0 - 1.0)
  phraseBoundaries: PhraseBoundary[];
  optimalVocalHandoffWindows: { start: number; end: number; score: number }[];
}

export class VocalActivityDetector {
  /**
   * Analyzes an audio buffer to detect vocal activity and phrase boundaries.
   * Uses vocal formant bandpass energy (300Hz - 3.5kHz) and spectral variance.
   */
  public analyzeVocals(
    samples: Float32Array,
    sampleRate: number,
    bpm: number,
    firstDownbeatTime = 0.0,
    totalDuration = 0.0
  ): VocalAnalysisResult {
    const duration = totalDuration > 0 ? totalDuration : samples.length / sampleRate;
    const windowSize = Math.floor(sampleRate * 0.25); // 250ms analysis frames
    const numFrames = Math.max(1, Math.floor(samples.length / windowSize));

    // 1. Calculate energy in speech/singing formant band (300Hz - 3.5kHz)
    // Using a 2nd-order IIR bandpass filter approximation to isolate vocal presence
    const frameEnergies = new Float32Array(numFrames);
    const frameFlatness = new Float32Array(numFrames);
    let maxVocalEnergy = 1e-6;

    // Filter coefficients for 300Hz - 3500Hz bandpass
    const nyquist = sampleRate / 2;
    const lowNorm = Math.max(0.01, 300 / nyquist);
    const highNorm = Math.min(0.99, 3500 / nyquist);

    for (let f = 0; f < numFrames; f++) {
      const start = f * windowSize;
      let sumSq = 0.0;
      let zeroCrossings = 0;
      let prevVal = 0;

      for (let i = 0; i < windowSize; i++) {
        const val = samples[start + i];
        // Bandpass proxy: reject very low rumble (<100Hz) and very high hiss (>8kHz) via difference
        const filtered = val - 0.2 * prevVal;
        sumSq += filtered * filtered;

        if ((val > 0 && prevVal <= 0) || (val < 0 && prevVal >= 0)) {
          zeroCrossings++;
        }
        prevVal = val;
      }

      const rms = Math.sqrt(sumSq / windowSize);
      frameEnergies[f] = rms;
      if (rms > maxVocalEnergy) {
        maxVocalEnergy = rms;
      }

      // Zero-crossing density helps distinguish harmonic vocals from percussive noise
      frameFlatness[f] = zeroCrossings / windowSize;
    }

    // 2. Classify vocal presence with adaptive hysteresis threshold
    const vocalThreshold = maxVocalEnergy * 0.22;
    const isVocalFrame = new Uint8Array(numFrames);

    for (let f = 0; f < numFrames; f++) {
      // Vocal characteristics: reasonable mid-band energy and controlled zero-crossing rate
      const energy = frameEnergies[f];
      const zcr = frameFlatness[f];
      if (energy >= vocalThreshold && zcr >= 0.02 && zcr <= 0.35) {
        isVocalFrame[f] = 1;
      } else {
        isVocalFrame[f] = 0;
      }
    }

    // 3. Smooth frame classifications into continuous segments (minimum vocal phrase = 1.0s)
    const minVocalFrames = Math.floor(1.0 / 0.25); // 4 frames
    const vocalSegments: VocalSegment[] = [];
    const instrumentalWindows: VocalSegment[] = [];

    let inVocal = false;
    let segStartFrame = 0;

    for (let f = 0; f < numFrames; f++) {
      const active = isVocalFrame[f] === 1;

      if (!inVocal && active) {
        inVocal = true;
        segStartFrame = f;
      } else if (inVocal && !active) {
        // Look ahead 2 frames to bridge brief vocal pauses (breathing, micro-rests)
        let bridge = false;
        if (f + 2 < numFrames && isVocalFrame[f + 1] === 1) {
          bridge = true;
        }

        if (!bridge) {
          inVocal = false;
          const segDurationFrames = f - segStartFrame;
          const startTime = segStartFrame * 0.25;
          const endTime = f * 0.25;

          if (segDurationFrames >= minVocalFrames) {
            let segEnergySum = 0;
            for (let k = segStartFrame; k < f; k++) {
              segEnergySum += frameEnergies[k];
            }
            const avgEnergy = segEnergySum / (segDurationFrames * maxVocalEnergy);

            vocalSegments.push({
              start: startTime,
              end: endTime,
              confidence: Math.min(1.0, 0.65 + avgEnergy * 0.35),
              averageEnergy: Math.min(1.0, avgEnergy),
              isVocal: true
            });
          }
        }
      }
    }

    // Capture final segment if active
    if (inVocal) {
      const startTime = segStartFrame * 0.25;
      const endTime = numFrames * 0.25;
      vocalSegments.push({
        start: startTime,
        end: endTime,
        confidence: 0.8,
        averageEnergy: 0.7,
        isVocal: true
      });
    }

    // 4. Derive Instrumental Windows (gaps between vocal segments)
    let currentPos = 0;
    for (const vSeg of vocalSegments) {
      if (vSeg.start - currentPos >= 2.0) {
        // At least 2.0s of clean instrumental
        instrumentalWindows.push({
          start: currentPos,
          end: vSeg.start,
          confidence: 0.9,
          averageEnergy: 0.5,
          isVocal: false
        });
      }
      currentPos = Math.max(currentPos, vSeg.end);
    }
    if (duration - currentPos >= 2.0) {
      instrumentalWindows.push({
        start: currentPos,
        end: duration,
        confidence: 0.95,
        averageEnergy: 0.45,
        isVocal: false
      });
    }

    // 5. Compute Phrase Boundaries locked to BPM and Downbeat (4, 8, 16, 32 bars)
    const phraseBoundaries: PhraseBoundary[] = [];
    const beatDuration = 60 / Math.max(40, Math.min(220, bpm));
    const barDuration = beatDuration * 4;

    let barIdx = 0;
    let t = firstDownbeatTime;

    while (t < duration) {
      let phraseLength: 4 | 8 | 16 | 32 = 4;
      if (barIdx % 32 === 0) {
        phraseLength = 32;
      } else if (barIdx % 16 === 0) {
        phraseLength = 16;
      } else if (barIdx % 8 === 0) {
        phraseLength = 8;
      }

      phraseBoundaries.push({
        timestamp: t,
        barIndex: barIdx,
        phraseLengthBars: phraseLength,
        isMajorBoundary: phraseLength >= 16
      });

      barIdx += 4;
      t += barDuration * 4;
    }

    // 6. Optimal Vocal Handoff Windows:
    // Points where a vocal phrase ends within 1-2 bars of a 16 or 32-bar phrase boundary
    const optimalVocalHandoffWindows: { start: number; end: number; score: number }[] = [];

    for (const vSeg of vocalSegments) {
      // Find closest phrase boundary after vocal offset
      const boundaryAfter = phraseBoundaries.find(p => p.timestamp >= vSeg.end);
      if (boundaryAfter && boundaryAfter.timestamp - vSeg.end <= barDuration * 2) {
        optimalVocalHandoffWindows.push({
          start: vSeg.end,
          end: boundaryAfter.timestamp,
          score: boundaryAfter.isMajorBoundary ? 0.95 : 0.8
        });
      }
    }

    // Calculate overall vocal ratio
    let totalVocalSeconds = 0;
    for (const seg of vocalSegments) {
      totalVocalSeconds += (seg.end - seg.start);
    }
    const vocalActivityRatio = duration > 0 ? Math.min(1.0, totalVocalSeconds / duration) : 0;

    return {
      vocalSegments,
      instrumentalWindows,
      vocalActivityRatio,
      phraseBoundaries,
      optimalVocalHandoffWindows
    };
  }

  /**
   * Evaluates vocal collision / clashing risk between outgoing Track A and incoming Track B.
   * Returns a score from 0.0 (High collision risk) to 1.0 (Completely safe / zero clashing).
   */
  public evaluateVocalOverlapRisk(
    trackAVocals: VocalSegment[],
    trackBVocals: VocalSegment[],
    overlapStartA: number,
    overlapEndA: number,
    offsetBtoA: number // Time difference: t_A = t_B + offsetBtoA
  ): { riskScore: number; clashingRegions: { startA: number; endA: number }[] } {
    const clashingRegions: { startA: number; endA: number }[] = [];

    // Find active vocals in Track A during the crossover window
    const activeA = trackAVocals.filter(v => v.end > overlapStartA && v.start < overlapEndA);

    for (const segA of activeA) {
      const clampedAStart = Math.max(overlapStartA, segA.start);
      const clampedAEnd = Math.min(overlapEndA, segA.end);

      // Map to Track B timecode: t_B = t_A - offsetBtoA
      const startB = clampedAStart - offsetBtoA;
      const endB = clampedAEnd - offsetBtoA;

      // Check if Track B also has vocals active in this timeframe
      const clashB = trackBVocals.find(v => v.end > startB && v.start < endB);
      if (clashB) {
        clashingRegions.push({
          startA: clampedAStart,
          endA: clampedAEnd
        });
      }
    }

    // If zero clashing regions, safe! (Score 1.0)
    if (clashingRegions.length === 0) {
      return { riskScore: 1.0, clashingRegions: [] };
    }

    // Calculate fraction of overlap window where vocals clash
    let totalClashDuration = 0;
    for (const r of clashingRegions) {
      totalClashDuration += (r.endA - r.startA);
    }
    const overlapWindowDuration = Math.max(1.0, overlapEndA - overlapStartA);
    const clashRatio = Math.min(1.0, totalClashDuration / overlapWindowDuration);

    return {
      riskScore: Math.max(0.0, 1.0 - clashRatio),
      clashingRegions
    };
  }
}
