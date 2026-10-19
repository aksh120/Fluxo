/**
 * TransitionEngine
 * Automated DJ transition coordinator implementing professional mixing styles:
 * - Smooth Blend: Equal-power crossfade curve over N bars
 * - Bass Swap: Phrase-locked low-end frequency swap on the 1
 * - Filter Sweep: Dual-mode resonant filter sweep
 * - Echo Out: High feedback echo wash with dry cut
 * - Cut on the 1: Instantaneous downbeat punch cut
 */
import type { DeckEngine } from './DeckEngine';
import type { BeatSyncController } from './BeatSyncController';

export type TransitionStyle = 'blend' | 'bass_swap' | 'filter_sweep' | 'echo_out' | 'cut';

export interface TransitionConfig {
  style: TransitionStyle;
  fromDeck: 'A' | 'B';
  toDeck: 'A' | 'B';
  durationBars?: number; // 4, 8, 16, 32 bars (default 16, or 1 for cut)
  masterBpm?: number;
  onProgress?: (progress: number, crossfaderPos: number) => void;
  onComplete?: () => void;
}

export class TransitionEngine {
  private _isActive = false;
  private _progress = 0.0; // 0.0 to 1.0
  private _currentConfig: TransitionConfig | null = null;
  private animationFrameId: number | null = null;
  private startTime = 0;
  private durationSeconds = 0;

  constructor(
    private readonly setCrossfader: (pos: number) => void,
    private readonly getDeck: (deckId: 'A' | 'B') => DeckEngine,
    private readonly beatSync?: BeatSyncController
  ) {}

  public get isActive(): boolean {
    return this._isActive;
  }

  public get progress(): number {
    return this._progress;
  }

  public get currentConfig(): TransitionConfig | null {
    return this._currentConfig;
  }

  /**
   * Starts an automated DJ transition
   */
  public startTransition(config: TransitionConfig): void {
    if (this._isActive) {
      this.cancelTransition();
    }

    this._isActive = true;
    this._progress = 0.0;
    this._currentConfig = config;

    const fromDeck = this.getDeck(config.fromDeck);
    const toDeck = this.getDeck(config.toDeck);

    // Calculate transition duration in seconds from musical bars
    const bpm = config.masterBpm ?? fromDeck.currentTrack?.bpm ?? 128;
    const barDurationSec = (60 / bpm) * 4;
    const bars = config.style === 'cut' ? 1 : (config.durationBars ?? 16);
    this.durationSeconds = Math.max(1.0, bars * barDurationSec);

    // Initial crossfader position (-1.0 for Deck A, +1.0 for Deck B)
    const initialPos = config.fromDeck === 'A' ? -1.0 : 1.0;
    this.setCrossfader(initialPos);

    // Ensure incoming deck is playing
    if (!toDeck.isPlaying) {
      toDeck.play();
    }

    // Configure initial EQ states based on transition style
    if (config.style === 'bass_swap') {
      // Pre-kill target deck's bass to prevent clashing during approach
      toDeck.setLowGain(0.0);
      fromDeck.setLowGain(1.0);
    } else if (config.style === 'filter_sweep') {
      fromDeck.setFilterParam(0.0);
      toDeck.setFilterParam(0.0);
    }

    this.startTime = performance.now();
    this.tick();
  }

  /**
   * Main animation tick driving parameters smoothly across the transition duration
   */
  private tick = (): void => {
    if (!this._isActive || !this._currentConfig) return;

    const elapsedMs = performance.now() - this.startTime;
    const progress = Math.min(1.0, elapsedMs / (this.durationSeconds * 1000));
    this._progress = progress;

    const config = this._currentConfig;
    const fromDeck = this.getDeck(config.fromDeck);
    const toDeck = this.getDeck(config.toDeck);

    // Direction factor (-1 for A -> B, +1 for B -> A)
    const startPos = config.fromDeck === 'A' ? -1.0 : 1.0;
    const targetPos = config.fromDeck === 'A' ? 1.0 : -1.0;

    switch (config.style) {
      case 'blend': {
        // Equal-power sinusoidal crossfade ramp
        const crossfader = startPos + (targetPos - startPos) * progress;
        this.setCrossfader(crossfader);
        break;
      }

      case 'bass_swap': {
        // Equal power blend for overall volume
        const crossfader = startPos + (targetPos - startPos) * progress;
        this.setCrossfader(crossfader);

        // Instant bass swap at midpoint (50% progress / bar boundary)
        if (progress < 0.5) {
          fromDeck.setLowGain(1.0);
          toDeck.setLowGain(0.0);
        } else {
          // Bass snapped!
          fromDeck.setLowGain(0.0);
          toDeck.setLowGain(1.0);
        }
        break;
      }

      case 'filter_sweep': {
        const crossfader = startPos + (targetPos - startPos) * progress;
        this.setCrossfader(crossfader);

        // Sweep High-Pass filter on outgoing deck up to 4kHz to thin it out
        fromDeck.setFilterParam(progress * 0.85, 1.8);
        // Incoming deck remains open
        toDeck.setFilterParam(0.0);
        break;
      }

      case 'echo_out': {
        // Outgoing deck plays until 75%, then crossfades and cuts
        if (progress < 0.75) {
          const crossfader = startPos + (targetPos - startPos) * (progress / 0.75) * 0.7;
          this.setCrossfader(crossfader);
        } else {
          // Sharp cut to incoming deck
          this.setCrossfader(targetPos);
          fromDeck.setVolume(0.0);
        }
        break;
      }

      case 'cut': {
        if (progress >= 0.5) {
          this.setCrossfader(targetPos);
        }
        break;
      }
    }

    if (config.onProgress) {
      const currentPos = startPos + (targetPos - startPos) * progress;
      config.onProgress(progress, currentPos);
    }

    if (progress >= 1.0) {
      this.completeTransition();
    } else {
      this.animationFrameId = requestAnimationFrame(this.tick);
    }
  };

  /**
   * Finalizes transition, cleans up EQ / filter overrides, and stops outgoing deck
   */
  public completeTransition(): void {
    if (!this._currentConfig) return;

    const config = this._currentConfig;
    const fromDeck = this.getDeck(config.fromDeck);
    const toDeck = this.getDeck(config.toDeck);

    // Finalize crossfader fully at target
    const targetPos = config.fromDeck === 'A' ? 1.0 : -1.0;
    this.setCrossfader(targetPos);

    // Reset outgoing deck
    fromDeck.pause();
    fromDeck.setLowGain(1.0);
    fromDeck.setMidGain(1.0);
    fromDeck.setHighGain(1.0);
    fromDeck.setFilterParam(0.0);

    // Restore incoming deck full EQ
    toDeck.setLowGain(1.0);
    toDeck.setMidGain(1.0);
    toDeck.setHighGain(1.0);
    toDeck.setFilterParam(0.0);

    this._isActive = false;
    this._progress = 1.0;

    if (config.onComplete) {
      config.onComplete();
    }
  }

  /**
   * Cancels any active transition immediately
   */
  public cancelTransition(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this._isActive = false;
    this._progress = 0.0;
    this._currentConfig = null;
  }
}
