export interface BpmAnalysisResult {
  bpm: number;
  confidence: number;
  onsetEnvelope: Float32Array;
  frameRate: number; // Onsets per second
}

export class OnsetBpmDetector {
  private minBpm: number;
  private maxBpm: number;

  constructor(minBpm = 60, maxBpm = 200) {
    this.minBpm = minBpm;
    this.maxBpm = maxBpm;
  }

  /**
   * Computes onset detection function (ODF) via frame-by-frame energy flux.
   */
  public computeOnsetEnvelope(
    samples: Float32Array,
    sampleRate: number,
    windowSize = 1024,
    hopSize = 512
  ): { onsetEnvelope: Float32Array; frameRate: number } {
    const numFrames = Math.max(1, Math.floor((samples.length - windowSize) / hopSize));
    const onsetEnvelope = new Float32Array(numFrames);
    const frameRate = sampleRate / hopSize;

    let prevEnergy = 0.0;

    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      let energy = 0.0;

      for (let i = 0; i < windowSize; i++) {
        const s = samples[start + i];
        energy += s * s;
      }

      // Root mean square energy
      const rms = Math.sqrt(energy / windowSize);

      // Half-wave rectified spectral energy flux: H(x) = (x + |x|) / 2
      const flux = rms - prevEnergy;
      onsetEnvelope[f] = flux > 0 ? flux : 0.0;
      prevEnergy = rms;
    }

    return { onsetEnvelope, frameRate };
  }

  /**
   * Estimates track BPM via autocorrelation lag analysis on onset envelope.
   */
  public estimateBpm(
    samples: Float32Array,
    sampleRate: number
  ): BpmAnalysisResult {
    const { onsetEnvelope, frameRate } = this.computeOnsetEnvelope(samples, sampleRate);
    const numFrames = onsetEnvelope.length;

    // Convert BPM search range to frame lags: lag = frameRate * (60 / BPM)
    const minLag = Math.floor((60 / this.maxBpm) * frameRate);
    const maxLag = Math.ceil((60 / this.minBpm) * frameRate);

    // Autocorrelation computation
    let bestLag = minLag;
    let maxCorr = -Infinity;
    const correlations = new Float32Array(maxLag + 1);

    for (let lag = minLag; lag <= maxLag && lag < numFrames; lag++) {
      let sum = 0.0;
      const count = numFrames - lag;
      for (let i = 0; i < count; i++) {
        sum += onsetEnvelope[i] * onsetEnvelope[i + lag];
      }
      const normCorr = count > 0 ? sum / count : 0;
      correlations[lag] = normCorr;

      if (normCorr > maxCorr) {
        maxCorr = normCorr;
        bestLag = lag;
      }
    }

    // Refine peak with parabolic interpolation
    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const alpha = correlations[bestLag - 1];
      const beta = correlations[bestLag];
      const gamma = correlations[bestLag + 1];
      const denom = alpha - 2 * beta + gamma;
      if (denom !== 0) {
        refinedLag = bestLag + (alpha - gamma) / (2 * denom);
      }
    }

    let estimatedBpm = (60 * frameRate) / refinedLag;

    // Octave error correction: DJ / electronic sweet spot is 85-165 BPM
    if (estimatedBpm < 85) {
      const halfLag = Math.round(refinedLag / 2);
      if (halfLag >= minLag && correlations[halfLag] >= maxCorr * 0.65) {
        estimatedBpm *= 2;
      }
    } else if (estimatedBpm > 170) {
      const doubleLag = Math.round(refinedLag * 2);
      if (doubleLag <= maxLag && correlations[doubleLag] >= maxCorr * 0.65) {
        estimatedBpm /= 2;
      }
    }

    // Round to 1 decimal place
    const finalBpm = Math.round(estimatedBpm * 10) / 10;

    // Confidence metric based on peak prominence relative to median correlation
    let sumCorr = 0;
    let validCount = 0;
    for (let l = minLag; l <= maxLag; l++) {
      sumCorr += correlations[l];
      validCount++;
    }
    const avgCorr = validCount > 0 ? sumCorr / validCount : 0.001;
    const confidence = Math.min(1.0, Math.max(0.1, (maxCorr - avgCorr) / (maxCorr + 1e-6)));

    return {
      bpm: finalBpm,
      confidence,
      onsetEnvelope,
      frameRate
    };
  }
}
