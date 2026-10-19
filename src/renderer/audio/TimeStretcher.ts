/**
 * TimeStretcher
 * High-performance WSOLA (Waveform Similarity Overlap-Add) time-stretching
 * and pitch-shifting DSP engine.
 *
 * Allows independent tempo scaling (±20% or 0.8x to 1.2x) and key transposition
 * (±6 semitones) in real-time or offline processing without pitch artifacts.
 */

export interface TimeStretchOptions {
  tempoScale?: number; // 0.5 to 2.0 (1.0 = native tempo)
  semitones?: number; // -12 to +12 semitones (0 = native pitch)
  windowSize?: number; // Overlap-add window size (samples), default 2048
  searchRange?: number; // WSOLA search offset range, default 512
}

export class TimeStretcher {
  private readonly windowSize: number;
  private readonly searchRange: number;
  private readonly hanningWindow: Float32Array;

  constructor(options?: { windowSize?: number; searchRange?: number }) {
    this.windowSize = options?.windowSize ?? 2048;
    this.searchRange = options?.searchRange ?? 512;

    // Precompute Hanning window coefficients
    this.hanningWindow = new Float32Array(this.windowSize);
    for (let i = 0; i < this.windowSize; i++) {
      this.hanningWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.windowSize - 1)));
    }
  }

  /**
   * Stretches or pitch-shifts a Web Audio AudioBuffer, returning a new AudioBuffer
   */
  public processAudioBuffer(
    buffer: AudioBuffer,
    options: TimeStretchOptions,
    context: BaseAudioContext
  ): AudioBuffer {
    const tempoScale = Math.max(0.5, Math.min(2.0, options.tempoScale ?? 1.0));
    const semitones = Math.max(-12, Math.min(12, options.semitones ?? 0));

    // If no processing needed, return clone or original
    if (Math.abs(tempoScale - 1.0) < 0.001 && Math.abs(semitones) < 0.01) {
      return buffer;
    }

    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const processedChannels: Float32Array[] = [];

    for (let c = 0; c < numChannels; c++) {
      const channelData = buffer.getChannelData(c);
      const stretched = this.processChannel(channelData, tempoScale, semitones);
      processedChannels.push(stretched);
    }

    const outputLength = processedChannels[0].length;
    const outBuffer = context.createBuffer(numChannels, outputLength, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      outBuffer.copyToChannel(processedChannels[c], c);
    }

    return outBuffer;
  }

  /**
   * Processes a single Float32Array channel
   */
  public processChannel(
    input: Float32Array,
    tempoScale: number,
    semitones = 0
  ): Float32Array {
    let current = input;

    // If pitch shifting requested, resample first
    if (Math.abs(semitones) > 0.01) {
      const pitchRatio = Math.pow(2, semitones / 12);
      current = this.resample(current, pitchRatio);
      // Adjust tempoScale to counter the tempo change induced by resampling
      tempoScale = tempoScale / pitchRatio;
    }

    // If tempo scale is 1.0, return current resampled data
    if (Math.abs(tempoScale - 1.0) < 0.001) {
      return current;
    }

    return this.wsola(current, tempoScale);
  }

  /**
   * WSOLA time-stretching core algorithm
   */
  private wsola(input: Float32Array, tempoScale: number): Float32Array {
    const W = this.windowSize;
    const Hs = Math.floor(W / 2); // Synthesis hop (fixed at 50% overlap)
    const Ha = Math.floor(Hs * tempoScale); // Nominal analysis hop
    const searchRange = this.searchRange;

    const inputLen = input.length;
    if (inputLen < W + searchRange) {
      return input.slice();
    }

    // Estimate output length based on tempoScale
    const estimatedOutLen = Math.floor(inputLen / tempoScale);
    const output = new Float32Array(estimatedOutLen + W);
    const norm = new Float32Array(estimatedOutLen + W);

    let inPos = 0;
    let outPos = 0;

    // Copy first frame directly
    for (let i = 0; i < W; i++) {
      const w = this.hanningWindow[i];
      output[outPos + i] += input[inPos + i] * w;
      norm[outPos + i] += w;
    }

    outPos += Hs;
    let k = 1;

    while (Math.floor(k * Ha) + W <= inputLen && outPos + W <= output.length) {
      const nominalInPos = Math.floor(k * Ha);
      // Find best match in input near nominalInPos using normalized cross-correlation
      const bestOffset = this.findBestOffset(input, nominalInPos, output, outPos, W, searchRange);
      const actualInPos = nominalInPos + bestOffset;

      // Overlap-add windowed frame
      for (let i = 0; i < W; i++) {
        const w = this.hanningWindow[i];
        output[outPos + i] += input[actualInPos + i] * w;
        norm[outPos + i] += w;
      }

      outPos += Hs;
      k++;
    }

    // Normalize output by accumulated window weights to prevent modulation
    for (let i = 0; i < outPos; i++) {
      if (norm[i] > 1e-4) {
        output[i] /= norm[i];
      }
    }

    return output.slice(0, outPos);
  }

  /**
   * Finds the offset in input around inPos that maximizes similarity with the output buffer
   */
  private findBestOffset(
    input: Float32Array,
    inPos: number,
    output: Float32Array,
    outPos: number,
    windowSize: number,
    searchRange: number
  ): number {
    let bestCorr = -Infinity;
    let bestOffset = 0;
    const step = 4; // Sub-sample search decimation for speed

    const startOffset = Math.max(-searchRange, -inPos);
    const endOffset = Math.min(searchRange, input.length - inPos - windowSize);

    for (let offset = startOffset; offset <= endOffset; offset += step) {
      let corr = 0;
      let energyIn = 0;

      for (let i = 0; i < windowSize; i += 4) {
        const sOut = output[outPos + i];
        const sIn = input[inPos + offset + i];
        corr += sOut * sIn;
        energyIn += sIn * sIn;
      }

      // Normalized cross correlation
      const denom = Math.sqrt(energyIn) + 1e-5;
      const normCorr = corr / denom;

      if (normCorr > bestCorr) {
        bestCorr = normCorr;
        bestOffset = offset;
      }
    }

    return bestOffset;
  }

  /**
   * High-quality linear interpolated resampling for pitch shifting
   */
  private resample(input: Float32Array, ratio: number): Float32Array {
    const inLen = input.length;
    const outLen = Math.floor(inLen / ratio);
    const output = new Float32Array(outLen);

    for (let i = 0; i < outLen; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;

      if (idx + 1 < inLen) {
        output[i] = input[idx] * (1 - frac) + input[idx + 1] * frac;
      } else if (idx < inLen) {
        output[i] = input[idx];
      }
    }

    return output;
  }
}
