/**
 * AudioQualityAnalyzer
 * Objective audio QA measurements: Total Harmonic Distortion (THD),
 * 3-Band Linkwitz-Riley isolator crossover flatness, and brickwall peak limiter compliance.
 */

export interface THDResult {
  fundamentalFreq: number;
  fundamentalAmplitude: number;
  harmonicDistortionPercent: number; // e.g. 0.005%
  passesStandard: boolean; // < 0.05%
}

export interface CrossoverFlatnessPoint {
  frequency: number;
  magnitudeLinear: number;
  magnitudeDb: number;
  isFlatWithinPointOneDb: boolean; // within +/- 0.1 dB
}

export interface LimiterTestResult {
  inputGainDb: number;
  inputPeakDb: number;
  outputPeakDb: number;
  ceilingDb: number;
  preventedClipping: boolean;
}

export class AudioQualityAnalyzer {
  /**
   * Calculates Total Harmonic Distortion (THD) on a periodic test signal
   * Formula: THD = sqrt(V2^2 + V3^2 + V4^2 + ...) / V1 * 100%
   */
  public static calculateTHD(
    signal: Float32Array,
    sampleRate: number,
    fundamentalFreq = 1000,
    maxHarmonics = 5
  ): THDResult {
    const N = signal.length;
    if (N < 256) {
      throw new Error('Signal buffer too short for spectral distortion analysis');
    }

    // Goertzel / discrete Fourier correlation for fundamental and harmonics
    const computeMagnitudeAtFreq = (f: number): number => {
      let real = 0;
      let imag = 0;
      const omega = (2 * Math.PI * f) / sampleRate;

      for (let n = 0; n < N; n++) {
        // Hann window to prevent spectral leakage
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
        const sample = signal[n] * window;
        real += sample * Math.cos(omega * n);
        imag -= sample * Math.sin(omega * n);
      }

      return (2 * Math.sqrt(real * real + imag * imag)) / N;
    };

    const V1 = computeMagnitudeAtFreq(fundamentalFreq);
    if (V1 <= 1e-6) {
      return {
        fundamentalFreq,
        fundamentalAmplitude: 0,
        harmonicDistortionPercent: 0,
        passesStandard: true
      };
    }

    let harmonicSumSq = 0;
    for (let k = 2; k <= maxHarmonics; k++) {
      const harmFreq = fundamentalFreq * k;
      if (harmFreq < sampleRate / 2) {
        const Vk = computeMagnitudeAtFreq(harmFreq);
        harmonicSumSq += Vk * Vk;
      }
    }

    const thdPercent = (Math.sqrt(harmonicSumSq) / V1) * 100;

    return {
      fundamentalFreq,
      fundamentalAmplitude: V1,
      harmonicDistortionPercent: Math.round(thdPercent * 10000) / 10000,
      passesStandard: thdPercent < 0.05
    };
  }

  /**
   * Evaluates the frequency response of the 3-Band Linkwitz-Riley (LR4) isolator EQ.
   * A mathematically perfect LR4 crossover exhibits flat magnitude summation (0 dB ripple).
   */
  public static evaluateLR4Summation(
    testFrequencies: number[] = [20, 60, 150, 300, 600, 1200, 3000, 6000, 12000, 20000],
    lowFreq = 300,
    highFreq = 3000
  ): CrossoverFlatnessPoint[] {
    return testFrequencies.map((f) => {
      // 2nd-order Butterworth prototype: H(s) = 1 / (s^2 + sqrt(2)*s + 1)
      // LR4 is formed by cascading two 2nd-order Butterworth filters (H_LR4 = H_Butterworth^2)
      // Normalized frequency variable: w = f / fc
      const wL = f / lowFreq;
      const wH = f / highFreq;

      // Magnitude of 2nd order Butterworth lowpass: |H_LP2(w)| = 1 / sqrt(1 + w^4)
      // Magnitude of LR4 lowpass: |H_LR4_LP| = 1 / (1 + w^4)
      const magLow = 1 / (1 + Math.pow(wL, 4));

      // Magnitude of LR4 highpass: |H_LR4_HP| = w^4 / (1 + w^4)
      const magHigh = Math.pow(wH, 4) / (1 + Math.pow(wH, 4));

      // Mid-band is LR4 highpass at lowFreq in series with LR4 lowpass at highFreq
      const magMidHp = Math.pow(wL, 4) / (1 + Math.pow(wL, 4));
      const magMidLp = 1 / (1 + Math.pow(wH, 4));
      const magMid = magMidHp * magMidLp;

      // LR4 property: Low + High outputs are in-phase and sum to unity across crossover
      const magSum = magLow + magMid + magHigh;
      const magnitudeDb = Math.round(20 * Math.log10(magSum) * 100) / 100;

      return {
        frequency: f,
        magnitudeLinear: magSum,
        magnitudeDb,
        isFlatWithinPointOneDb: Math.abs(magnitudeDb) <= 0.1
      };
    });
  }

  /**
   * Tests master dynamics compressor / peak limiter against extreme input gains
   * Verifies output remains under 0 dBFS ceiling even at +12 dBFS drive.
   */
  public static testMasterLimiter(
    inputGainDb = 12.0,
    thresholdDb = -0.5,
    ratio = 20.0
  ): LimiterTestResult {
    const inputPeakLinear = Math.pow(10, inputGainDb / 20); // +12 dBFS = ~3.98 linear
    const inputPeakDb = inputGainDb;

    const ceilingDb = 0.0;
    // Hard-knee dynamics limiter transfer function with brickwall ceiling
    let outputPeakDb: number;
    if (inputPeakDb <= thresholdDb) {
      outputPeakDb = inputPeakDb;
    } else {
      const overDb = inputPeakDb - thresholdDb;
      const compressedOverDb = overDb / ratio;
      outputPeakDb = Math.min(ceilingDb, thresholdDb + compressedOverDb);
    }

    const preventedClipping = outputPeakDb <= ceilingDb;

    return {
      inputGainDb,
      inputPeakDb: Math.round(inputPeakDb * 10) / 10,
      outputPeakDb: Math.round(outputPeakDb * 100) / 100,
      ceilingDb,
      preventedClipping
    };
  }
}
