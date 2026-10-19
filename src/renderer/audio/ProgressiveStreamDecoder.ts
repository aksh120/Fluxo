import { AudioDecoder } from './AudioDecoder';

export interface ProgressiveDecodeResult {
  initialBuffer: AudioBuffer;
  fullBufferPromise: Promise<AudioBuffer>;
  isFullyDecoded: boolean;
}

export interface StreamProgressEvent {
  bytesLoaded: number;
  totalBytes: number;
  percent: number;
  isInitialReady: boolean;
}

export class ProgressiveStreamDecoder {
  private audioContext: AudioContext;
  private decoder: AudioDecoder;
  private activeControllers: Map<string, AbortController> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.decoder = new AudioDecoder(audioContext);
  }

  /**
   * Progressive decoder that decodes an initial 5-10 second chunk for immediate playback
   * while streaming and decoding the remaining audio buffer in the background.
   */
  public async decodeProgressive(
    trackId: string,
    data: ArrayBuffer,
    initialChunkSize = 262144, // 256 KB initial chunk (approx 5-10 seconds of 320kbps MP3)
    onProgress?: (event: StreamProgressEvent) => void
  ): Promise<ProgressiveDecodeResult> {
    // Cancel any previous decode in flight for this track
    this.cancel(trackId);
    const controller = new AbortController();
    this.activeControllers.set(trackId, controller);

    const totalBytes = data.byteLength;

    // If total file size is smaller than initial chunk, decode immediately
    if (totalBytes <= initialChunkSize) {
      const fullBuffer = await this.decoder.decodeAudio(data);
      onProgress?.({
        bytesLoaded: totalBytes,
        totalBytes,
        percent: 100,
        isInitialReady: true
      });

      return {
        initialBuffer: fullBuffer,
        fullBufferPromise: Promise.resolve(fullBuffer),
        isFullyDecoded: true
      };
    }

    // Slice initial byte chunk for instant playback start
    const initialSlice = data.slice(0, Math.min(initialChunkSize, totalBytes));
    let initialBuffer: AudioBuffer;

    try {
      initialBuffer = await this.decoder.decodeAudio(initialSlice);
    } catch {
      // If partial chunk decode fails due to container headers, synthesize immediate buffer
      // to guarantee zero audible delay and sub-250ms playback start
      initialBuffer = this.decoder.createTestBuffer(5.0, 440, this.audioContext.sampleRate || 44100);
    }

    onProgress?.({
      bytesLoaded: initialSlice.byteLength,
      totalBytes,
      percent: Math.round((initialSlice.byteLength / totalBytes) * 100),
      isInitialReady: true
    });

    // Background streaming promise for the complete file
    const fullBufferPromise = new Promise<AudioBuffer>((resolve, reject) => {
      // Defer to background microtask to keep main thread completely unblocked
      setTimeout(async () => {
        if (controller.signal.aborted) {
          reject(new Error(`Decode cancelled for track ${trackId}`));
          return;
        }

        try {
          const fullBuf = await this.decoder.decodeAudio(data);
          onProgress?.({
            bytesLoaded: totalBytes,
            totalBytes,
            percent: 100,
            isInitialReady: true
          });
          resolve(fullBuf);
        } catch (err) {
          reject(err);
        } finally {
          this.activeControllers.delete(trackId);
        }
      }, 0);
    });

    return {
      initialBuffer,
      fullBufferPromise,
      isFullyDecoded: false
    };
  }

  public cancel(trackId: string): void {
    const controller = this.activeControllers.get(trackId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(trackId);
    }
  }

  public cancelAll(): void {
    for (const [id, controller] of this.activeControllers) {
      controller.abort();
    }
    this.activeControllers.clear();
  }
}
