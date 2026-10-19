import fs from 'node:fs';
import path from 'node:path';

export interface WaveformData {
  sampleRate: number;
  duration: number;
  pointsPerSecond: number;
  length: number;
  minPeaks: Float32Array;
  maxPeaks: Float32Array;
}

export class WaveformPeakGenerator {
  public static readonly MAGIC = 0x50584c46; // 'FLXP' in little-endian

  /**
   * Generates min/max peak buffer at 100 points per second from mono/stereo PCM data.
   */
  public generatePeaks(
    channelData: Float32Array,
    sampleRate: number,
    pointsPerSecond = 100
  ): WaveformData {
    const totalSamples = channelData.length;
    const duration = totalSamples / sampleRate;
    const totalPoints = Math.max(1, Math.floor(duration * pointsPerSecond));
    const samplesPerPoint = Math.max(1, Math.floor(totalSamples / totalPoints));

    const minPeaks = new Float32Array(totalPoints);
    const maxPeaks = new Float32Array(totalPoints);

    for (let p = 0; p < totalPoints; p++) {
      const start = p * samplesPerPoint;
      const end = Math.min(start + samplesPerPoint, totalSamples);

      let min = 0.0;
      let max = 0.0;

      for (let i = start; i < end; i++) {
        const val = channelData[i];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      minPeaks[p] = min;
      maxPeaks[p] = max;
    }

    return {
      sampleRate,
      duration,
      pointsPerSecond,
      length: totalPoints,
      minPeaks,
      maxPeaks
    };
  }

  /**
   * Serializes WaveformData into a compact binary buffer
   */
  public serialize(data: WaveformData): Buffer {
    const headerSize = 20; // 5 x 4 bytes (magic, sampleRate, duration, pointsPerSecond, length)
    const payloadSize = data.length * 4 * 2; // minPeaks + maxPeaks (Float32)
    const buffer = Buffer.alloc(headerSize + payloadSize);

    // Header
    buffer.writeUInt32LE(WaveformPeakGenerator.MAGIC, 0);
    buffer.writeUInt32LE(data.sampleRate, 4);
    buffer.writeFloatLE(data.duration, 8);
    buffer.writeUInt32LE(data.pointsPerSecond, 12);
    buffer.writeUInt32LE(data.length, 16);

    // Min peaks
    let offset = headerSize;
    for (let i = 0; i < data.length; i++) {
      buffer.writeFloatLE(data.minPeaks[i], offset);
      offset += 4;
    }

    // Max peaks
    for (let i = 0; i < data.length; i++) {
      buffer.writeFloatLE(data.maxPeaks[i], offset);
      offset += 4;
    }

    return buffer;
  }

  /**
   * Deserializes a binary buffer back into WaveformData
   */
  public deserialize(buffer: Buffer): WaveformData {
    if (buffer.length < 20) {
      throw new Error('Invalid waveform peaks buffer: too short');
    }

    const magic = buffer.readUInt32LE(0);
    if (magic !== WaveformPeakGenerator.MAGIC) {
      throw new Error('Invalid waveform peaks magic header');
    }

    const sampleRate = buffer.readUInt32LE(4);
    const duration = buffer.readFloatLE(8);
    const pointsPerSecond = buffer.readUInt32LE(12);
    const length = buffer.readUInt32LE(16);

    const minPeaks = new Float32Array(length);
    const maxPeaks = new Float32Array(length);

    let offset = 20;
    for (let i = 0; i < length; i++) {
      minPeaks[i] = buffer.readFloatLE(offset);
      offset += 4;
    }

    for (let i = 0; i < length; i++) {
      maxPeaks[i] = buffer.readFloatLE(offset);
      offset += 4;
    }

    return {
      sampleRate,
      duration,
      pointsPerSecond,
      length,
      minPeaks,
      maxPeaks
    };
  }

  /**
   * Saves waveform peaks to a .peaks cache file on disk
   */
  public async saveToFile(filePath: string, data: WaveformData): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    const buf = this.serialize(data);
    await fs.promises.writeFile(filePath, buf);
  }

  /**
   * Reads waveform peaks from a .peaks file on disk
   */
  public async loadFromFile(filePath: string): Promise<WaveformData | null> {
    if (!fs.existsSync(filePath)) return null;
    const buf = await fs.promises.readFile(filePath);
    return this.deserialize(buf);
  }
}
