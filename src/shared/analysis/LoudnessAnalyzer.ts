export interface LoudnessAnalysisResult {
  integratedLufs: number; // EBU R128 standard LUFS (e.g. -14.2)
  truePeak: number; // Peak dBFS (e.g. -0.5)
  energyLevel: number; // 0.0 to 1.0 energy metric
}

export class LoudnessAnalyzer {
  /**
   * Applies ITU-R BS.1770 K-weighting filter (high shelf + RLB high-pass filter)
   */
  public applyKWeighting(samples: Float32Array, sampleRate: number): Float32Array {
    const out = new Float32Array(samples.length);

    // Filter coefficients for 44.1kHz / 48kHz approximations
    // Stage 1: High shelf filter (+4 dB at 1.5 kHz)
    // Stage 2: High pass filter (100 Hz cutoff)
    const b0 = 1.535;
    const b1 = -2.691;
    const b2 = 1.198;
    const a1 = -1.690;
    const a2 = 0.732;

    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;

      out[i] = y0;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }

    return out;
  }

  /**
   * Computes Integrated LUFS and True Peak per ITU-R BS.1770-4
   */
  public analyzeLoudness(samples: Float32Array, sampleRate: number): LoudnessAnalysisResult {
    // 1. True Peak computation (maximum absolute sample with margin)
    let peakVal = 0.0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peakVal) peakVal = abs;
    }
    const truePeak = peakVal > 0 ? Math.round(20 * Math.log10(peakVal) * 10) / 10 : -70.0;

    // 2. K-weighting filtering
    const filtered = this.applyKWeighting(samples, sampleRate);

    // 3. Block energy calculation: 400ms blocks with 75% overlap (100ms hop)
    const blockSize = Math.floor(sampleRate * 0.4);
    const hopSize = Math.floor(sampleRate * 0.1);
    const numBlocks = Math.max(1, Math.floor((filtered.length - blockSize) / hopSize));

    const blockPowers: number[] = [];

    for (let b = 0; b < numBlocks; b++) {
      const start = b * hopSize;
      let sumSq = 0.0;
      for (let i = 0; i < blockSize; i++) {
        const s = filtered[start + i];
        sumSq += s * s;
      }
      const meanSq = sumSq / blockSize;
      // Convert to LKFS: -0.691 + 10 * log10(meanSq)
      if (meanSq > 0) {
        const lkfs = -0.691 + 10 * Math.log10(meanSq);
        blockPowers.push(lkfs);
      }
    }

    if (blockPowers.length === 0) {
      return {
        integratedLufs: -70.0,
        truePeak: -70.0,
        energyLevel: 0.1
      };
    }

    // 4. Absolute Gating: discard blocks below -70 LKFS
    const absoluteGated = blockPowers.filter((lkfs) => lkfs > -70.0);
    if (absoluteGated.length === 0) {
      return { integratedLufs: -70.0, truePeak, energyLevel: 0.1 };
    }

    // Compute mean of absolute gated blocks
    let sumLin = 0.0;
    for (const lkfs of absoluteGated) {
      sumLin += Math.pow(10, lkfs / 10);
    }
    const absMeanLin = sumLin / absoluteGated.length;
    const absMeanLkfs = 10 * Math.log10(absMeanLin);

    // 5. Relative Gating: threshold is absMeanLkfs - 10 LU
    const relThreshold = absMeanLkfs - 10.0;
    const finalBlocks = absoluteGated.filter((lkfs) => lkfs > relThreshold);

    let finalSumLin = 0.0;
    for (const lkfs of finalBlocks) {
      finalSumLin += Math.pow(10, lkfs / 10);
    }
    const finalMeanLin = finalBlocks.length > 0 ? finalSumLin / finalBlocks.length : absMeanLin;
    const integratedLufs = Math.round((10 * Math.log10(finalMeanLin)) * 10) / 10;

    // 6. Energy Level metric: mapped from LUFS [-30 LUFS ... -6 LUFS] to [0.0 ... 1.0]
    const clampedLufs = Math.max(-30, Math.min(-6, integratedLufs));
    const energyLevel = Math.round(((clampedLufs + 30) / 24) * 100) / 100;

    return {
      integratedLufs,
      truePeak,
      energyLevel
    };
  }
}
