/**
 * ITU-R BS.1770-4 / EBU R128 Loudness Meter & Normalizer
 * Calculates integrated LUFS (Loudness Units relative to Full Scale)
 * and normalizes multi-channel PCM buffers to user-specified target LUFS.
 */

export interface LoudnessMeasurement {
  integratedLufs: number;
  truePeakDb: number;
  truePeakLinear: number;
  durationSeconds: number;
  normalizationGainDb: number;
  normalizationGainLinear: number;
}

export class LufsMeter {
  /**
   * Measures integrated LUFS and peak across multi-channel PCM audio.
   */
  public static measure(
    channelData: Float32Array[],
    sampleRate: number,
    targetLufs = -14.0
  ): LoudnessMeasurement {
    const numChannels = channelData.length;
    if (numChannels === 0 || channelData[0].length === 0) {
      return {
        integratedLufs: -70.0,
        truePeakDb: -70.0,
        truePeakLinear: 0.0003,
        durationSeconds: 0,
        normalizationGainDb: 0,
        normalizationGainLinear: 1.0
      };
    }

    const numSamples = channelData[0].length;
    const durationSeconds = numSamples / sampleRate;

    // 1. Measure True Peak
    let maxPeak = 0;
    for (let c = 0; c < numChannels; c++) {
      const data = channelData[c];
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }
    const truePeakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -70.0;

    // 2. Apply K-Weighting Filter (Stage 1 High-Shelf + Stage 2 High-Pass)
    const filteredChannels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      filteredChannels.push(this.applyKWeighting(channelData[c], sampleRate));
    }

    // 3. Block-based Energy Calculation (400ms window, 100ms hop)
    const blockSize = Math.round(0.4 * sampleRate);
    const hopSize = Math.round(0.1 * sampleRate);
    const numBlocks = Math.max(1, Math.floor((numSamples - blockSize) / hopSize) + 1);

    const blockEnergies: number[] = new Array(numBlocks).fill(0);

    for (let b = 0; b < numBlocks; b++) {
      const startIdx = b * hopSize;
      let totalBlockSum = 0;

      for (let c = 0; c < numChannels; c++) {
        // Channel weighting: Left = 1.0, Right = 1.0, Center = 1.0
        const chWeight = 1.0;
        const channel = filteredChannels[c];
        let chSum = 0;

        for (let i = 0; i < blockSize; i++) {
          const sample = channel[startIdx + i] || 0;
          chSum += sample * sample;
        }

        totalBlockSum += chWeight * (chSum / blockSize);
      }

      blockEnergies[b] = totalBlockSum;
    }

    // 4. Absolute Threshold Gating (-70 LKFS)
    // -0.691 + 10 * log10(energy) > -70  =>  energy > 10^((-70 + 0.691) / 10)
    const absThresholdEnergy = Math.pow(10, (-70 + 0.691) / 10);
    const absoluteGatedEnergies: number[] = [];

    for (let b = 0; b < numBlocks; b++) {
      if (blockEnergies[b] > absThresholdEnergy) {
        absoluteGatedEnergies.push(blockEnergies[b]);
      }
    }

    if (absoluteGatedEnergies.length === 0) {
      return {
        integratedLufs: -70.0,
        truePeakDb,
        truePeakLinear: maxPeak,
        durationSeconds,
        normalizationGainDb: 0,
        normalizationGainLinear: 1.0
      };
    }

    // Average energy of absolute-gated blocks
    const avgAbsEnergy =
      absoluteGatedEnergies.reduce((acc, val) => acc + val, 0) /
      absoluteGatedEnergies.length;
    const absLufs = -0.691 + 10 * Math.log10(Math.max(1e-12, avgAbsEnergy));

    // 5. Relative Threshold Gating (-10 dB relative to absolute-gated average)
    const relThresholdLufs = absLufs - 10.0;
    const relThresholdEnergy = Math.pow(10, (relThresholdLufs + 0.691) / 10);
    const relativeGatedEnergies: number[] = [];

    for (let i = 0; i < absoluteGatedEnergies.length; i++) {
      if (absoluteGatedEnergies[i] > relThresholdEnergy) {
        relativeGatedEnergies.push(absoluteGatedEnergies[i]);
      }
    }

    const finalEnergy =
      relativeGatedEnergies.length > 0
        ? relativeGatedEnergies.reduce((acc, val) => acc + val, 0) /
          relativeGatedEnergies.length
        : avgAbsEnergy;

    const integratedLufs = -0.691 + 10 * Math.log10(Math.max(1e-12, finalEnergy));

    // 6. Calculate Normalization Gain Offset
    // Target LUFS (e.g. -14.0) vs measured integrated LUFS
    let gainDb = targetLufs - integratedLufs;
    let gainLinear = Math.pow(10, gainDb / 20);

    // True Peak limiter ceiling: -1.0 dBTP (0.891 linear)
    const peakCeilingLinear = Math.pow(10, -1.0 / 20);
    if (maxPeak * gainLinear > peakCeilingLinear && maxPeak > 0) {
      gainLinear = peakCeilingLinear / maxPeak;
      gainDb = 20 * Math.log10(gainLinear);
    }

    return {
      integratedLufs: Math.round(integratedLufs * 10) / 10,
      truePeakDb: Math.round(truePeakDb * 10) / 10,
      truePeakLinear: maxPeak,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      normalizationGainDb: Math.round(gainDb * 10) / 10,
      normalizationGainLinear: gainLinear
    };
  }

  /**
   * Normalizes audio channels in-place to target LUFS with True Peak limiting.
   */
  public static normalize(
    channelData: Float32Array[],
    sampleRate: number,
    targetLufs = -14.0
  ): LoudnessMeasurement {
    const measurement = this.measure(channelData, sampleRate, targetLufs);
    const gain = measurement.normalizationGainLinear;

    // Apply linear gain factor across all channels
    for (let c = 0; c < channelData.length; c++) {
      const channel = channelData[c];
      for (let i = 0; i < channel.length; i++) {
        channel[i] = Math.max(-1.0, Math.min(1.0, channel[i] * gain));
      }
    }

    return measurement;
  }

  /**
   * K-Weighting IIR Biquad Filters (Stage 1 High-Shelf + Stage 2 High-Pass)
   * Coefficients derived for 44.1kHz / 48kHz per ITU-R BS.1770-4 standard.
   */
  private static applyKWeighting(input: Float32Array, sampleRate: number): Float32Array {
    const output = new Float32Array(input.length);

    // Stage 1: High shelf filter (~1500 Hz, +4 dB)
    // Approximate biquad coefficients for 44.1k/48k
    const dbGain = 3.99984385397;
    const f0 = 1681.9744509555319;
    const Q = 0.7071752369554193;
    const K = Math.tan((Math.PI * f0) / sampleRate);
    const Vh = Math.pow(10, dbGain / 20);
    const Vb = Math.pow(Vh, 0.499666774155);

    const a0 = 1 + (K / Q) + K * K;
    const b0 = (Vh + Vb * (K / Q) + K * K) / a0;
    const b1 = (2 * (K * K - Vh)) / a0;
    const b2 = (Vh - Vb * (K / Q) + K * K) / a0;
    const a1 = (2 * (K * K - 1)) / a0;
    const a2 = (1 - (K / Q) + K * K) / a0;

    // Temporary stage 1 buffer
    const stage1 = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < input.length; i++) {
      const x0 = input[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      stage1[i] = y0;
    }

    // Stage 2: High pass filter (f0 = 38 Hz, Q = 0.5)
    const fhp = 38.13547087613982;
    const Qhp = 0.5003270373253953;
    const Khp = Math.tan((Math.PI * fhp) / sampleRate);
    const a0hp = 1 + (Khp / Qhp) + Khp * Khp;
    const b0hp = 1 / a0hp;
    const b1hp = -2 / a0hp;
    const b2hp = 1 / a0hp;
    const a1hp = (2 * (Khp * Khp - 1)) / a0hp;
    const a2hp = (1 - (Khp / Qhp) + Khp * Khp) / a0hp;

    x1 = 0; x2 = 0; y1 = 0; y2 = 0;
    for (let i = 0; i < stage1.length; i++) {
      const x0 = stage1[i];
      const y0 = b0hp * x0 + b1hp * x1 + b2hp * x2 - a1hp * y1 - a2hp * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      output[i] = y0;
    }

    return output;
  }
}
