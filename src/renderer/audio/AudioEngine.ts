/**
 * AudioEngine
 * Master DJ audio engine coordinating Deck A, Deck B, crossfader blending,
 * Linkwitz-Riley isolators, beat sync, and intelligent phrase-locked transitions.
 */
import { AudioContextManager } from './AudioContextManager';
import { DeckEngine } from './DeckEngine';
import { AudioDecoder } from './AudioDecoder';
import { TrackPreloader } from './TrackPreloader';
import { ProgressiveStreamDecoder } from './ProgressiveStreamDecoder';
import { TimeStretcher } from './TimeStretcher';
import { BeatSyncController } from './BeatSyncController';
import { TransitionEngine, type TransitionConfig } from './TransitionEngine';
import { FallbackCrossfadeEngine } from './FallbackCrossfadeEngine';
import { DynamicTransitionCoordinator, type TransitionRequest } from './DynamicTransitionCoordinator';
import type { TrackMetadata, TrackAnalysis } from '../../shared/types';

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  public readonly contextManager: AudioContextManager;
  public readonly deckA: DeckEngine;
  public readonly deckB: DeckEngine;
  public readonly decoder: AudioDecoder;
  public readonly preloader: TrackPreloader;
  public readonly progressiveDecoder: ProgressiveStreamDecoder;
  public readonly timeStretcher: TimeStretcher;
  public readonly beatSync: BeatSyncController;
  public readonly transitionEngine: TransitionEngine;
  public readonly fallbackEngine: FallbackCrossfadeEngine;
  public readonly transitionCoordinator: DynamicTransitionCoordinator;

  private _crossfaderPos = 0; // -1.0 (Deck A 100%) to +1.0 (Deck B 100%)
  private trackEndedListeners: Set<(deckId: 'A' | 'B', track: TrackMetadata | null) => void> = new Set();

  private constructor() {
    this.contextManager = AudioContextManager.getInstance();
    const context = this.contextManager.getContext();
    const masterBus = this.contextManager.getMasterBus();

    this.decoder = new AudioDecoder(context);
    this.deckA = new DeckEngine('A', context, masterBus.inputNode);
    this.deckB = new DeckEngine('B', context, masterBus.inputNode);
    this.preloader = new TrackPreloader(this.decoder);
    this.progressiveDecoder = new ProgressiveStreamDecoder(context);
    this.timeStretcher = new TimeStretcher();
    this.beatSync = new BeatSyncController();

    // Forward natural track-ended events from virtual decks
    this.deckA.onTrackEnded((deckId, track) => {
      for (const listener of this.trackEndedListeners) {
        try {
          listener(deckId, track);
        } catch (err) {
          console.error('[AudioEngine] deckA trackEnded listener error:', err);
        }
      }
    });

    this.deckB.onTrackEnded((deckId, track) => {
      for (const listener of this.trackEndedListeners) {
        try {
          listener(deckId, track);
        } catch (err) {
          console.error('[AudioEngine] deckB trackEnded listener error:', err);
        }
      }
    });

    this.transitionEngine = new TransitionEngine(
      (pos) => this.setCrossfader(pos),
      (id) => this.getDeck(id),
      this.beatSync
    );

    this.fallbackEngine = new FallbackCrossfadeEngine(
      (pos) => this.setCrossfader(pos),
      (id) => this.getDeck(id)
    );

    this.transitionCoordinator = new DynamicTransitionCoordinator(
      this.transitionEngine,
      this.fallbackEngine,
      this.beatSync,
      (id) => this.getDeck(id)
    );

    this.setCrossfader(0);

    // Global reference for diagnostics and inspection
    if (typeof window !== 'undefined') {
      (window as any).__fluxoAudioEngine = this;
    }
  }

  public onTrackEnded(listener: (deckId: 'A' | 'B', track: TrackMetadata | null) => void): () => void {
    this.trackEndedListeners.add(listener);
    return () => this.trackEndedListeners.delete(listener);
  }

  public getActiveDeck(activeDeckId: 'A' | 'B'): DeckEngine {
    return this.getDeck(activeDeckId);
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Loads encoded binary audio into specified deck
   */
  public async loadTrackToDeck(
    deckId: 'A' | 'B',
    arrayBuffer: ArrayBuffer,
    metadata: TrackMetadata
  ): Promise<void> {
    const audioBuffer = await this.decoder.decodeAudio(arrayBuffer);
    const targetDeck = deckId === 'A' ? this.deckA : this.deckB;
    targetDeck.loadTrack(audioBuffer, metadata);
  }

  /**
   * Sets crossfader position using an Equal-Power Crossfade Curve:
   * GainA = cos((pos + 1) * pi / 4)
   * GainB = sin((pos + 1) * pi / 4)
   * This guarantees constant acoustic loudness across the transition without volume dips.
   */
  public setCrossfader(position: number): void {
    this._crossfaderPos = Math.max(-1.0, Math.min(1.0, position));

    // Map -1..1 to 0..pi/2
    const normalized = (this._crossfaderPos + 1) / 2; // 0.0 to 1.0
    const angle = normalized * (Math.PI / 2);

    const gainA = Math.cos(angle);
    const gainB = Math.sin(angle);

    this.deckA.setVolume(gainA);
    this.deckB.setVolume(gainB);
  }

  public get crossfaderPos(): number {
    return this._crossfaderPos;
  }

  public getDeck(deckId: 'A' | 'B'): DeckEngine {
    return deckId === 'A' ? this.deckA : this.deckB;
  }

  /**
   * Syncs Deck B tempo and downbeat to Deck A (or vice versa)
   */
  public syncDecks(masterDeckId: 'A' | 'B' = 'A'): boolean {
    const master = masterDeckId === 'A' ? this.deckA : this.deckB;
    const target = masterDeckId === 'A' ? this.deckB : this.deckA;
    return this.beatSync.alignDownbeat(master, target);
  }

  /**
   * Initiates an automated DJ transition with intelligent fallback / upgrade
   */
  public triggerTransition(
    request: TransitionRequest,
    incomingAnalysis?: TrackAnalysis | null
  ): 'beatmatched' | 'fallback' {
    return this.transitionCoordinator.executeTransition(request, incomingAnalysis);
  }
}
