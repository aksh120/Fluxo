import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface EncodeRequest {
  channelData: Float32Array[];
  sampleRate: number;
  outputPath: string;
  format: 'mp3' | 'wav' | 'flac';
  bitrateKbps?: number;
  targetLufs?: number;
}

export interface EncodeResult {
  success: boolean;
  outputPath: string;
  duration: number;
  fileSize: number;
  error?: string;
}

export class FFmpegEncoder {
  private activeProcess: ChildProcess | null = null;
  private isCancelled = false;

  /**
   * Discovers the best available FFmpeg binary on the system.
   * Priority:
   * 1. FLUXO_FFMPEG_PATH environment variable override
   * 2. Packaged Electron resources directory (process.resourcesPath/bin/ffmpeg.exe)
   * 3. Local repository resources directory (resources/bin/ffmpeg.exe)
   * 4. Standard host path (C:\ffmpeg\bin\ffmpeg.exe)
   * 5. System PATH fallback ('ffmpeg')
   */
  public static getFfmpegPath(): string {
    if (process.env.FLUXO_FFMPEG_PATH && fs.existsSync(process.env.FLUXO_FFMPEG_PATH)) {
      return process.env.FLUXO_FFMPEG_PATH;
    }

    if (process.resourcesPath) {
      const packagedBin = path.join(process.resourcesPath, 'bin', 'ffmpeg.exe');
      if (fs.existsSync(packagedBin)) {
        return packagedBin;
      }
    }

    const localDevBin = path.join(process.cwd(), 'resources', 'bin', 'ffmpeg.exe');
    if (fs.existsSync(localDevBin)) {
      return localDevBin;
    }

    const standardHostPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
    if (fs.existsSync(standardHostPath)) {
      return standardHostPath;
    }

    return 'ffmpeg';
  }

  /**
   * Checks whether a valid FFmpeg binary is accessible.
   */
  public static isAvailable(): boolean {
    const resolvedPath = FFmpegEncoder.getFfmpegPath();
    if (resolvedPath !== 'ffmpeg') {
      return fs.existsSync(resolvedPath);
    }
    try {
      const { execSync } = require('node:child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Encodes multi-channel Float32Array PCM into MP3, FLAC, or WAV.
   */
  public async encode(request: EncodeRequest): Promise<EncodeResult> {
    this.isCancelled = false;
    const { channelData, sampleRate, outputPath, format, bitrateKbps = 320 } = request;

    if (!channelData || channelData.length === 0 || channelData[0].length === 0) {
      throw new Error('No audio PCM data provided for encoding.');
    }

    const numSamples = channelData[0].length;
    const duration = numSamples / sampleRate;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Direct RIFF/WAVE encoding if format is 'wav'
    if (format === 'wav') {
      return this.writeWavDirect(channelData, sampleRate, outputPath, duration);
    }

    // Interleave Float32 samples into a single Buffer
    const interleavedBuffer = this.interleaveFloat32(channelData);

    const ffmpegPath = FFmpegEncoder.getFfmpegPath();

    return new Promise<EncodeResult>((resolve, reject) => {
      const args: string[] = [
        '-y',
        '-f', 'f32le',
        '-ar', sampleRate.toString(),
        '-ac', '2',
        '-i', 'pipe:0'
      ];

      if (format === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, '-compression_level', '2');
      } else if (format === 'flac') {
        args.push('-c:a', 'flac', '-compression_level', '5');
      }

      args.push(outputPath);

      try {
        const child = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        this.activeProcess = child;

        let stderrOutput = '';

        child.stderr?.on('data', (chunk) => {
          stderrOutput += chunk.toString();
        });

        child.on('error', (err) => {
          this.activeProcess = null;
          // If FFmpeg is missing, fall back to writing lossless WAV
          console.warn(`FFmpeg spawn error (${err.message}). Falling back to direct WAV export.`);
          const fallbackWavPath = outputPath.replace(/\.[^.]+$/, '.wav');
          this.writeWavDirect(channelData, sampleRate, fallbackWavPath, duration)
            .then(resolve)
            .catch(reject);
        });

        child.on('close', (code) => {
          this.activeProcess = null;
          if (this.isCancelled) {
            // Clean up partially written file
            if (fs.existsSync(outputPath)) {
              try { fs.unlinkSync(outputPath); } catch {}
            }
            return resolve({
              success: false,
              outputPath,
              duration,
              fileSize: 0,
              error: 'Export was cancelled by user.'
            });
          }

          if (code === 0 && fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            resolve({
              success: true,
              outputPath,
              duration: Math.round(duration * 100) / 100,
              fileSize: stats.size
            });
          } else {
            // Fall back to direct WAV if FFmpeg execution returned an error code
            console.warn(`FFmpeg exited with code ${code}. Stderr: ${stderrOutput.slice(-300)}`);
            const fallbackWavPath = outputPath.replace(/\.[^.]+$/, '.wav');
            this.writeWavDirect(channelData, sampleRate, fallbackWavPath, duration)
              .then(resolve)
              .catch(reject);
          }
        });

        // Write interleaved PCM data to stdin and end stream
        child.stdin?.write(interleavedBuffer, () => {
          child.stdin?.end();
        });
      } catch (err) {
        // Fall back to direct WAV export on any exception
        const fallbackWavPath = outputPath.replace(/\.[^.]+$/, '.wav');
        this.writeWavDirect(channelData, sampleRate, fallbackWavPath, duration)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  public cancel(): void {
    this.isCancelled = true;
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {
        // Safe process termination
      }
      this.activeProcess = null;
    }
  }

  /**
   * Interleaves stereo Float32Array into little-endian float bytes.
   */
  private interleaveFloat32(channelData: Float32Array[]): Buffer {
    const left = channelData[0];
    const right = channelData.length > 1 ? channelData[1] : left;
    const numSamples = left.length;
    const buffer = Buffer.alloc(numSamples * 2 * 4); // 2 channels * 4 bytes/float

    for (let i = 0; i < numSamples; i++) {
      buffer.writeFloatLE(left[i] || 0, i * 8);
      buffer.writeFloatLE(right[i] || 0, i * 8 + 4);
    }

    return buffer;
  }

  /**
   * Writes a canonical 16-bit PCM RIFF/WAVE file directly without external dependencies.
   */
  private writeWavDirect(
    channelData: Float32Array[],
    sampleRate: number,
    outputPath: string,
    duration: number
  ): Promise<EncodeResult> {
    return new Promise((resolve, reject) => {
      try {
        const left = channelData[0];
        const right = channelData.length > 1 ? channelData[1] : left;
        const numSamples = left.length;
        const bytesPerSample = 2; // 16-bit
        const numChannels = 2;
        const dataLength = numSamples * numChannels * bytesPerSample;
        const headerLength = 44;
        const totalLength = headerLength + dataLength;

        const buffer = Buffer.alloc(totalLength);

        // RIFF header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(totalLength - 8, 4);
        buffer.write('WAVE', 8);

        // "fmt " subchunk
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
        buffer.writeUInt16LE(1, 20); // AudioFormat: 1 = PCM
        buffer.writeUInt16LE(numChannels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
        buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
        buffer.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample

        // "data" subchunk
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataLength, 40);

        // Interleave 16-bit samples
        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
          const sL = Math.max(-1.0, Math.min(1.0, left[i] || 0));
          const sR = Math.max(-1.0, Math.min(1.0, right[i] || 0));

          const intL = sL < 0 ? sL * 32768 : sL * 32767;
          const intR = sR < 0 ? sR * 32768 : sR * 32767;

          buffer.writeInt16LE(Math.round(intL), offset);
          buffer.writeInt16LE(Math.round(intR), offset + 2);
          offset += 4;
        }

        fs.writeFileSync(outputPath, buffer);
        const stats = fs.statSync(outputPath);

        resolve({
          success: true,
          outputPath,
          duration: Math.round(duration * 100) / 100,
          fileSize: stats.size
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
