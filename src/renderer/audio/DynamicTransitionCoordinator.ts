/**
 * DynamicTransitionCoordinator
 * Seamlessly manages and dynamically upgrades in-flight transitions.
 *
 * If a track is transitioned while deep beat-grid analysis is still pending,
 * it runs the safe FallbackCrossfadeEngine. If deep analysis completes before the
 * point-of-no-return (progress < 70%), it dynamically promotes the fallback crossfade
 * into a phase-locked, beatmatched phrase transition without restarting audio.
 */
import type { TransitionEngine, TransitionStyle } from './TransitionEngine';
import type { FallbackCrossfadeEngine } from './FallbackCrossfadeEngine';
import type { BeatSyncController } from './BeatSyncController';
import type { DeckEngine } from './DeckEngine';
import type { TrackAnalysis } from '../../shared/types';

export interface TransitionRequest {
  fromDeck: 'A' | 'B';
  toDeck: 'A' | 'B';
  preferredStyle?: TransitionStyle;
  durationBars?: number;
  onUpgraded?: () => void;
  onComplete?: () => void;
}

export class DynamicTransitionCoordinator {
  private _isUpgraded = false;
  private _currentRequest: TransitionRequest | null = null;

  constructor(
    private readonly transitionEngine: TransitionEngine,
    private readonly fallbackEngine: FallbackCrossfadeEngine,
    private readonly beatSync: BeatSyncController,
    private readonly getDeck: (deckId: 'A' | 'B') => DeckEngine
  ) {}

  public get isTransitionActive(): boolean {
    return this.transitionEngine.isActive || this.fallbackEngine.isActive;
  }

  public get isUpgraded(): boolean {
    return this._isUpgraded;
  }

  /**
   * Initiates a transition, choosing either phrase-locked TransitionEngine or
   * FallbackCrossfadeEngine based on incoming track analysis readiness.
   */
  public executeTransition(
    request: TransitionRequest,
    incomingAnalysis?: TrackAnalysis | null
  ): 'beatmatched' | 'fallback' {
    this._currentRequest = request;
    this._isUpgraded = false;

    const isDeepReady = incomingAnalysis?.status === 'deep_ready' && (incomingAnalysis.bpm ?? 0) > 0;

    if (isDeepReady) {
      // Incoming track has full deep analysis: start immediate phrase-locked transition
      const masterDeck = this.getDeck(request.fromDeck);
      const targetDeck = this.getDeck(request.toDeck);

      // Perform tempo sync and downbeat alignment
      this.beatSync.syncTempo(masterDeck, targetDeck, null, incomingAnalysis?.beatGrid);

      this.transitionEngine.startTransition({
        style: request.preferredStyle ?? 'bass_swap',
        fromDeck: request.fromDeck,
        toDeck: request.toDeck,
        durationBars: request.durationBars ?? 16,
        masterBpm: masterDeck.currentTrack?.bpm,
        onComplete: request.onComplete
      });

      return 'beatmatched';
    } else {
      // Deep analysis pending: start safe fallback crossfade
      this.fallbackEngine.startFallback({
        fromDeck: request.fromDeck,
        toDeck: request.toDeck,
        durationSeconds: 8.0,
        onComplete: request.onComplete
      });

      return 'fallback';
    }
  }

  /**
   * Called when deep analysis completes. If fallback is active and has not
   * passed the point of no return (progress < 0.7), dynamically upgrades it!
   */
  public notifyAnalysisReady(analysis: TrackAnalysis): boolean {
    if (!this.fallbackEngine.isActive || !this._currentRequest) {
      return false;
    }

    // Point of no return check: must have enough time left to lock downbeat
    if (this.fallbackEngine.progress >= 0.7) {
      return false; // Let fallback finish gracefully
    }

    const request = this._currentRequest;
    const masterDeck = this.getDeck(request.fromDeck);
    const targetDeck = this.getDeck(request.toDeck);

    // Cancel fallback without resetting crossfader position
    this.fallbackEngine.cancel();

    // Sync tempo and phase on-the-fly
    if (analysis.bpm) {
      this.beatSync.syncTempo(masterDeck, targetDeck, null, analysis.beatGrid);
      this.beatSync.alignDownbeat(masterDeck, targetDeck, null, analysis.beatGrid);
    }

    // Upgrade to phrase-locked transition for the remaining bars
    this.transitionEngine.startTransition({
      style: request.preferredStyle ?? 'blend',
      fromDeck: request.fromDeck,
      toDeck: request.toDeck,
      durationBars: 8,
      masterBpm: masterDeck.currentTrack?.bpm ?? analysis.bpm,
      onComplete: request.onComplete
    });

    this._isUpgraded = true;
    if (request.onUpgraded) {
      request.onUpgraded();
    }

    return true;
  }

  public cancel(): void {
    this.transitionEngine.cancelTransition();
    this.fallbackEngine.cancel();
    this._currentRequest = null;
    this._isUpgraded = false;
  }
}
