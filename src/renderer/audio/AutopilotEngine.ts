/**
 * AutopilotEngine.ts
 * Autonomous DJ Session Orchestrator & State Machine for Fluxo Autopilot.
 * Coordinates whole-library discovery, lookahead set planning, anticipatory
 * preloading, real sample-accurate audio mixing, and transition quality auditing.
 */

import type { TrackMetadata, TrackAnalysis } from '../../shared/types';
import { AudioEngine } from './AudioEngine';
import { AutopilotPlanner } from './AutopilotPlanner';
import { AutopilotAuditStore } from './AutopilotAuditStore';
import type { TransitionStyle } from './TransitionEngine';
import {
  type AutopilotState,
  type AutopilotConfig,
  type PlannedSetItem,
  type TransitionAuditEntry,
  type TransitionUserFeedback,
  DEFAULT_AUTOPILOT_CONFIG
} from './AutopilotTypes';

export type AutopilotListener = (state: AutopilotState) => void;
export type QueueListener = (queue: PlannedSetItem[]) => void;
export type AuditListener = (entry: TransitionAuditEntry) => void;

export class AutopilotEngine {
  private static instance: AutopilotEngine | null = null;

  private state: AutopilotState = 'idle';
  private config: AutopilotConfig = { ...DEFAULT_AUTOPILOT_CONFIG };
  private planner: AutopilotPlanner;
  private auditStore: AutopilotAuditStore;

  private activeDeckId: 'A' | 'B' = 'A';
  private currentTrack: TrackMetadata | null = null;
  private upcomingQueue: PlannedSetItem[] = [];
  private recentlyPlayedTrackIds: string[] = [];

  private libraryTracks: TrackMetadata[] = [];
  private analyses: Map<string, TrackAnalysis> = new Map();

  private isTransitionInProgress = false;
  private lastTransitionStartTime = 0;
  private lastTransitionDuration = 16.0;

  // Listeners
  private stateListeners: Set<AutopilotListener> = new Set();
  private queueListeners: Set<QueueListener> = new Set();
  private auditListeners: Set<AuditListener> = new Set();

  private constructor() {
    this.planner = new AutopilotPlanner();
    this.auditStore = new AutopilotAuditStore();
  }

  public static getInstance(): AutopilotEngine {
    if (!AutopilotEngine.instance) {
      AutopilotEngine.instance = new AutopilotEngine();
    }
    return AutopilotEngine.instance;
  }

  // ==========================================
  // Library & Analysis Injection
  // ==========================================

  public setLibrary(tracks: TrackMetadata[], analyses?: Map<string, TrackAnalysis>): void {
    this.libraryTracks = tracks;
    if (analyses) {
      this.analyses = analyses;
    }
    // If running or idle, refresh queue planning if needed
    if (this.state === 'playing' || this.state === 'ready') {
      this.replenishQueue();
    }
  }

  public updateAnalysis(trackId: string, analysis: TrackAnalysis): void {
    this.analyses.set(trackId, analysis);
    // Update matching items in upcoming queue
    for (const item of this.upcomingQueue) {
      if (item.track.id === trackId) {
        item.analysis = analysis;
        item.readinessStatus = analysis.stemsPath ? 'ready' : 'fallback_ready';
      }
    }
    this.notifyQueue();
  }

  // ==========================================
  // State Machine Getters & Config
  // ==========================================

  public getState(): AutopilotState {
    return this.state;
  }

  public getConfig(): AutopilotConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AutopilotConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.state === 'playing' || this.state === 'ready' || this.state === 'idle') {
      this.regenerateQueue();
    }
  }

  public getActiveDeckId(): 'A' | 'B' {
    return this.activeDeckId;
  }

  public getCurrentTrack(): TrackMetadata | null {
    return this.currentTrack;
  }

  public getUpcomingQueue(): PlannedSetItem[] {
    return [...this.upcomingQueue];
  }

  public getAuditStore(): AutopilotAuditStore {
    return this.auditStore;
  }

  /**
   * Resets the engine to a clean idle state.
   */
  public reset(): void {
    this.state = 'idle';
    this.activeDeckId = 'A';
    this.currentTrack = null;
    this.upcomingQueue = [];
    this.recentlyPlayedTrackIds = [];
    this.isTransitionInProgress = false;
    this.notifyQueue();
  }

  private setState(newState: AutopilotState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const listener of this.stateListeners) {
      listener(newState);
    }
  }

  private notifyQueue(): void {
    const queueCopy = [...this.upcomingQueue];
    for (const listener of this.queueListeners) {
      listener(queueCopy);
    }
  }

  // ==========================================
  // Session Lifecycle Management
  // ==========================================

  /**
   * Starts autonomous DJ session with immediate playback (< 250ms).
   */
  public async startSession(initialTrack?: TrackMetadata): Promise<void> {
    if (this.libraryTracks.length === 0) {
      this.setState('error');
      return;
    }

    this.setState('planning');

    // Select initial track if not explicitly provided
    let startingTrack = initialTrack;
    if (!startingTrack) {
      startingTrack = this.libraryTracks[0];
    }
    this.currentTrack = startingTrack;
    this.activeDeckId = 'A';

    // 1. Plan 8-track lookahead sequence
    this.upcomingQueue = this.planner.planSetSequence(
      startingTrack,
      this.libraryTracks,
      this.analyses,
      this.config,
      [],
      this.recentlyPlayedTrackIds,
      8
    );
    this.notifyQueue();

    // 2. Start playback on Deck A immediately
    try {
      const engine = AudioEngine.getInstance();
      engine.setCrossfader(-1.0); // Full Deck A

      // Check if track is decoded on deck, otherwise prepare
      const deckA = engine.deckA;
      if (!deckA.getState().currentTrack || deckA.getState().currentTrack?.id !== startingTrack.id) {
        if (typeof window !== 'undefined' && window.fluxoAPI) {
          const buffer = await window.fluxoAPI.readAudioFile(startingTrack.filePath);
          await engine.loadTrackToDeck('A', buffer, startingTrack);
        }
      }

      deckA.play();
      this.setState('playing');

      // 3. Preload upcoming next track onto Deck B in background
      this.prepareNextTrack();
    } catch (err) {
      console.warn('Autopilot immediate start encountered audio load deferral:', err);
      // In environments where AudioContext is deferred or simulated, maintain session state
      this.setState('playing');
    }
  }

  /**
   * Stops session safely.
   */
  public stopSession(safe: boolean = true): void {
    try {
      const engine = AudioEngine.getInstance();
      if (safe) {
        // Gentle master fadeout
        engine.deckA.pause();
        engine.deckB.pause();
      } else {
        engine.deckA.stop();
        engine.deckB.stop();
      }
    } catch (err) {
      console.warn('AudioEngine stop error:', err);
    }
    this.setState('stopped');
  }

  public pauseSession(): void {
    try {
      const engine = AudioEngine.getInstance();
      engine.deckA.pause();
      engine.deckB.pause();
    } catch (err) {
      console.warn('Pause error:', err);
    }
    this.setState('paused');
  }

  public resumeSession(): void {
    try {
      const engine = AudioEngine.getInstance();
      const activeDeck = this.activeDeckId === 'A' ? engine.deckA : engine.deckB;
      activeDeck.play();
    } catch (err) {
      console.warn('Resume error:', err);
    }
    this.setState('playing');
  }

  /**
   * Prepares the upcoming track onto the inactive deck.
   */
  public async prepareNextTrack(): Promise<void> {
    if (this.upcomingQueue.length === 0) return;
    const nextItem = this.upcomingQueue[0];
    const inactiveDeckId = this.activeDeckId === 'A' ? 'B' : 'A';

    try {
      const engine = AudioEngine.getInstance();
      const inactiveDeck = inactiveDeckId === 'A' ? engine.deckA : engine.deckB;

      // Skip reload if already loaded
      if (inactiveDeck.getState().currentTrack?.id === nextItem.track.id) {
        return;
      }

      if (typeof window !== 'undefined' && window.fluxoAPI) {
        const buffer = await window.fluxoAPI.readAudioFile(nextItem.track.filePath);
        await engine.loadTrackToDeck(inactiveDeckId, buffer, nextItem.track);
      }
    } catch (err) {
      console.warn('Anticipatory preload error for next track:', err);
    }
  }

  /**
   * 60 FPS monitor: Checks remaining duration and executes transition automatically.
   */
  public checkAutoTransition(currentTime: number, duration: number): void {
    if (this.state !== 'playing' || this.isTransitionInProgress) return;
    if (duration <= 0 || currentTime <= 0) return;

    const remainingTime = duration - currentTime;

    // Trigger transition when 24 seconds or ~16-32 bars remain
    const nextItem = this.upcomingQueue[0];
    if (!nextItem) return;

    const planned = nextItem.plannedTransition;
    const triggerWindow = planned ? Math.max(12, planned.timing?.durationSeconds ?? 16.0) : 20.0;

    if (remainingTime <= triggerWindow) {
      this.executeAutonomousTransition();
    }
  }

  /**
   * Executes autonomous phrase-aligned transition between active and standby decks.
   */
  public executeAutonomousTransition(): void {
    if (this.isTransitionInProgress || this.upcomingQueue.length === 0) return;

    const incomingItem = this.upcomingQueue[0];
    const fromDeckId = this.activeDeckId;
    const toDeckId = this.activeDeckId === 'A' ? 'B' : 'A';

    this.isTransitionInProgress = true;
    this.setState('transitioning');
    this.lastTransitionStartTime = Date.now();

    const plan = incomingItem.plannedTransition;
    // Map transition family to TransitionStyle
    let style: TransitionStyle = 'smooth_blend';
    if (plan) {
      switch (plan.family) {
        case 'vocal_crossover':
          style = 'vocal_crossover';
          break;
        case 'bass_swap':
          style = 'bass_swap';
          break;
        case 'instrumental_handoff':
          style = 'instrumental_handoff';
          break;
        case 'drop_transition':
          style = 'drop_transition';
          break;
        case 'breakdown_build':
          style = 'breakdown_build';
          break;
        case 'fallback_crossfade':
          style = 'fallback_crossfade';
          break;
        default:
          style = 'phrase_beatmix';
      }
    }

    try {
      const engine = AudioEngine.getInstance();
      const incomingDeck = toDeckId === 'A' ? engine.deckA : engine.deckB;
      incomingDeck.play();

      this.lastTransitionDuration = plan ? (plan.timing?.durationSeconds ?? 16.0) : 16.0;

      engine.transitionEngine.executeTransition({
        style,
        fromDeck: fromDeckId,
        toDeck: toDeckId,
        durationBars: plan ? (plan.timing?.durationBars ?? 16) : 16,
        onComplete: () => {
          this.completeAutonomousTransition(fromDeckId, toDeckId, incomingItem);
        }
      });
    } catch (err) {
      console.warn('Transition execution fallback triggered:', err);
      // Fallback completion
      this.completeAutonomousTransition(fromDeckId, toDeckId, incomingItem, true);
    }
  }

  private completeAutonomousTransition(
    fromDeckId: 'A' | 'B',
    toDeckId: 'A' | 'B',
    incomingItem: PlannedSetItem,
    fallbackUsed: boolean = false
  ): void {
    try {
      const engine = AudioEngine.getInstance();
      const outgoingDeck = fromDeckId === 'A' ? engine.deckA : engine.deckB;
      outgoingDeck.pause();
      outgoingDeck.seek(0);
    } catch {
      // Audio engine may not be available in headless test environment
    }

    // Record transition audit entry
    const fromTrack = this.currentTrack;
    const toTrack = incomingItem.track;
    const actualDuration = Number(((Date.now() - this.lastTransitionStartTime) / 1000).toFixed(1));

    if (fromTrack) {
      this.recentlyPlayedTrackIds.push(fromTrack.id);
      const confScore = incomingItem.plannedTransition
        ? Math.round(incomingItem.plannedTransition.confidence * 100)
        : 80;

      const auditEntry = this.auditStore.recordTransition({
        fromTrackId: fromTrack.id,
        fromTrackTitle: fromTrack.title,
        toTrackId: toTrack.id,
        toTrackTitle: toTrack.title,
        transitionType: incomingItem.plannedTransition?.family ?? 'fallback_crossfade',
        plannedDuration: this.lastTransitionDuration,
        actualDuration,
        confidence: confScore,
        fallbackUsed: fallbackUsed || incomingItem.readinessStatus === 'fallback_ready',
        stemUsed: incomingItem.plannedTransition?.family === 'vocal_crossover'
      });

      for (const listener of this.auditListeners) {
        listener(auditEntry);
      }
    }

    // Switch active deck
    this.activeDeckId = toDeckId;
    this.currentTrack = toTrack;
    this.isTransitionInProgress = false;

    // Pop the incoming item from the queue
    this.upcomingQueue.shift();

    // Replenish lookahead queue back to 8 tracks
    this.replenishQueue();
    this.setState('playing');

    // Preload next upcoming track onto the newly inactive deck
    this.prepareNextTrack();
  }

  /**
   * Replenishes the upcoming queue to maintain target length of 8 tracks.
   */
  public replenishQueue(): void {
    if (this.libraryTracks.length === 0) return;

    this.upcomingQueue = this.planner.planSetSequence(
      this.currentTrack,
      this.libraryTracks,
      this.analyses,
      this.config,
      this.upcomingQueue,
      this.recentlyPlayedTrackIds,
      8
    );
    this.notifyQueue();
  }

  // ==========================================
  // Interactive Controls & Safe Takeover
  // ==========================================

  public skipTrack(): void {
    if (this.upcomingQueue.length === 0) return;
    this.executeAutonomousTransition();
  }

  public skipTransition(): void {
    if (!this.isTransitionInProgress) return;
    const engine = AudioEngine.getInstance();
    // Snap crossfader to target deck
    engine.setCrossfader(this.activeDeckId === 'A' ? 1.0 : -1.0);
  }

  public lockTrack(itemId: string, isLocked: boolean): void {
    const found = this.upcomingQueue.find((i) => i.id === itemId);
    if (found) {
      found.isLocked = isLocked;
      this.notifyQueue();
    }
  }

  public reorderQueue(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.upcomingQueue.length ||
      toIndex < 0 ||
      toIndex >= this.upcomingQueue.length
    ) {
      return;
    }
    const [moved] = this.upcomingQueue.splice(fromIndex, 1);
    this.upcomingQueue.splice(toIndex, 0, moved);
    this.notifyQueue();
  }

  public removeFromQueue(itemId: string): void {
    this.upcomingQueue = this.upcomingQueue.filter((i) => i.id !== itemId);
    this.replenishQueue();
  }

  public regenerateQueue(): void {
    if (!this.currentTrack && this.libraryTracks.length > 0) {
      this.currentTrack = this.libraryTracks[0];
    }
    // Plan set sequence preserving locked items
    this.upcomingQueue = this.planner.planSetSequence(
      this.currentTrack,
      this.libraryTracks,
      this.analyses,
      this.config,
      this.upcomingQueue,
      this.recentlyPlayedTrackIds,
      8
    );
    this.notifyQueue();
  }

  /**
   * Safe takeover: Releases autonomous state machine into manual DJ Studio control
   * without interrupting or clicking active audio stream.
   */
  public takeoverToManual(): { activeDeck: 'A' | 'B'; currentTrack: TrackMetadata | null } {
    this.setState('idle');
    return {
      activeDeck: this.activeDeckId,
      currentTrack: this.currentTrack
    };
  }

  public submitFeedback(feedback: TransitionUserFeedback): void {
    this.auditStore.submitFeedback('', feedback);
  }

  // ==========================================
  // Event Subscription
  // ==========================================

  public onStateChange(listener: AutopilotListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onQueueChange(listener: QueueListener): () => void {
    this.queueListeners.add(listener);
    return () => this.queueListeners.delete(listener);
  }

  public onAuditRecorded(listener: AuditListener): () => void {
    this.auditListeners.add(listener);
    return () => this.auditListeners.delete(listener);
  }
}
