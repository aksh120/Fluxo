/**
 * AudioDecoder
 * High-speed decoding of binary audio files (MP3, WAV, FLAC, AAC, Opus) into PCM AudioBuffers
 */

export class AudioDecoder {
  private readonly context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Decodes an ArrayBuffer of encoded audio into a Float32 PCM AudioBuffer
   */
  public async decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Cannot decode empty or zero-byte audio file');
    }
    if (arrayBuffer.byteLength < 32) {
      throw new Error('Corrupt audio file: truncated stream header (< 32 bytes)');
    }

    // Clone arrayBuffer if detached buffer risk exists
    const bufferCopy = arrayBuffer.slice(0);

    return new Promise((resolve, reject) => {
      this.context.decodeAudioData(
        bufferCopy,
        (decodedBuffer) => {
          resolve(decodedBuffer);
        },
        (error) => {
          reject(new Error(`Failed to decode audio: ${error?.message || 'Unsupported format'}`));
        }
      );
    });
  }

  /**
   * Creates a synthetic test AudioBuffer (e.g., sine wave or silence) for testing and calibration
   */
  public createTestBuffer(durationSeconds = 1.0, frequency = 440, sampleRate = 44100): AudioBuffer {
    const frameCount = Math.floor(sampleRate * durationSeconds);
    const buffer = this.context.createBuffer(2, frameCount, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < frameCount; i++) {
      const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
      left[i] = sample;
      right[i] = sample;
    }

    return buffer;
  }
}
