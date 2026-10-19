/**
 * FallbackCrossfadeEngine
 * Frequency-aware 8-second graceful fallback crossfader.
 *
 * Used when deep beat-grid analysis is still pending to avoid trainwrecks
 * by progressively dipping low and high frequencies while ramping gains.
 */
import type { DeckEngine } from './DeckEngine';

export interface FallbackCrossfadeConfig {
  fromDeck: 'A' | 'B';
  toDeck: 'A' | 'B';
  durationSeconds?: number; // Default 8.0 seconds
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

export class FallbackCrossfadeEngine {
  private _isActive = false;
  private _progress = 0.0;
  private _currentConfig: FallbackCrossfadeConfig | null = null;
  private startTime = 0;
  private durationSeconds = 8.0;
  private animationFrameId: number | null = null;

  constructor(
    private readonly setCrossfader: (pos: number) => void,
    private readonly getDeck: (deckId: 'A' | 'B') => DeckEngine
  ) {}

  public get isActive(): boolean {
    return this._isActive;
  }

  public get progress(): number {
    return this._progress;
  }

  public startFallback(config: FallbackCrossfadeConfig): void {
    if (this._isActive) {
      this.cancel();
    }

    this._isActive = true;
    this._progress = 0.0;
    this._currentConfig = config;
    this.durationSeconds = config.durationSeconds ?? 8.0;

    const fromDeck = this.getDeck(config.fromDeck);
    const toDeck = this.getDeck(config.toDeck);

    // Initial crossfader placement
    const initialPos = config.fromDeck === 'A' ? -1.0 : 1.0;
    this.setCrossfader(initialPos);

    if (!toDeck.isPlaying) {
      toDeck.play();
    }

    this.startTime = performance.now();
    this.tick();
  }

  private tick = (): void => {
    if (!this._isActive || !this._currentConfig) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    const progress = Math.min(1.0, elapsed / this.durationSeconds);
    this._progress = progress;

    const config = this._currentConfig;
    const fromDeck = this.getDeck(config.fromDeck);
    const toDeck = this.getDeck(config.toDeck);

    const startPos = config.fromDeck === 'A' ? -1.0 : 1.0;
    const targetPos = config.fromDeck === 'A' ? 1.0 : -1.0;

    // 1. Equal-power crossfader ramp
    const currentCrossfader = startPos + (targetPos - startPos) * progress;
    this.setCrossfader(currentCrossfader);

    // 2. Frequency-aware rolloff:
    // At 30% progress (e.g. ~2.5s into an 8s crossfade), dip low frequencies on outgoing deck to avoid bass clashes
    if (progress > 0.3) {
      const lowAtten = Math.max(0.0, 1.0 - ((progress - 0.3) / 0.4)); // ramps from 1.0 to 0.0 between 0.3 and 0.7
      fromDeck.setLowGain(lowAtten);
    }

    // At 50% progress, gently taper mid frequencies on outgoing deck
    if (progress > 0.5) {
      const midAtten = Math.max(0.2, 1.0 - ((progress - 0.5) / 0.5));
      fromDeck.setMidGain(midAtten);
    }

    if (config.onProgress) {
      config.onProgress(progress);
    }

    if (progress >= 1.0) {
      this.complete();
    } else {
      this.animationFrameId = requestAnimationFrame(this.tick);
    }
  };

  public complete(): void {
    if (!this._currentConfig) return;

    const config = this._currentConfig;
    const fromDeck = this.getDeck(config.fromDeck);
    const toDeck = this.getDeck(config.toDeck);

    const targetPos = config.fromDeck === 'A' ? 1.0 : -1.0;
    this.setCrossfader(targetPos);

    fromDeck.pause();
    fromDeck.setLowGain(1.0);
    fromDeck.setMidGain(1.0);
    fromDeck.setHighGain(1.0);

    toDeck.setLowGain(1.0);
    toDeck.setMidGain(1.0);
    toDeck.setHighGain(1.0);

    this._isActive = false;
    this._progress = 1.0;

    if (config.onComplete) {
      config.onComplete();
    }
  }

  public cancel(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this._isActive = false;
    this._progress = 0.0;
    this._currentConfig = null;
  }
}
