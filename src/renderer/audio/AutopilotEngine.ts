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
export type TrackChangeListener = (track: TrackMetadata | null, activeDeckId: 'A' | 'B') => void;

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
  private monitorIntervalId: any = null;

  // Listeners
  private stateListeners: Set<AutopilotListener> = new Set();
  private queueListeners: Set<QueueListener> = new Set();
  private auditListeners: Set<AuditListener> = new Set();
  private trackChangeListeners: Set<TrackChangeListener> = new Set();

  private constructor() {
    this.planner = new AutopilotPlanner();
    this.auditStore = new AutopilotAuditStore();

    try {
      const engine = AudioEngine.getInstance();
      engine.onTrackEnded((deckId, track) => {
        this.handleTrackEnded(deckId, track);
      });
    } catch {
      // In headless / mock test environments
    }
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
    this.stopAutonomousMonitor();
    this.state = 'idle';
    this.activeDeckId = 'A';
    this.currentTrack = null;
    this.upcomingQueue = [];
    this.recentlyPlayedTrackIds = [];
    this.isTransitionInProgress = false;
    this.notifyQueue();
    this.notifyTrackChange();
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

  private notifyTrackChange(): void {
    for (const listener of this.trackChangeListeners) {
      try {
        listener(this.currentTrack, this.activeDeckId);
      } catch (err) {
        console.error('[AutopilotDiagnostic] trackChange listener error:', err);
      }
    }
  }

  // ==========================================
  // Autonomous Playback & Event Monitoring
  // ==========================================

  public startAutonomousMonitor(): void {
    if (this.monitorIntervalId) return;
    console.log('[AutopilotDiagnostic] Starting autonomous playback monitor ticker (200ms)...');
    this.monitorIntervalId = setInterval(() => {
      if (this.state !== 'playing' || this.isTransitionInProgress) return;
      try {
        const engine = AudioEngine.getInstance();
        const activeDeck = this.activeDeckId === 'A' ? engine.deckA : engine.deckB;
        const currentTime = activeDeck.currentTime;
        const duration = activeDeck.duration;
        if (duration > 0 && currentTime > 0) {
          this.checkAutoTransition(currentTime, duration);
        }
      } catch {
        // Headless / non-audio environment
      }
    }, 200);
  }

  public stopAutonomousMonitor(): void {
    if (this.monitorIntervalId) {
      console.log('[AutopilotDiagnostic] Stopping autonomous playback monitor ticker.');
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
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

    console.log(`[AutopilotDiagnostic] startSession: Initial track selected "${startingTrack.title}" (ID: ${startingTrack.id}) on Deck A`);

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
      if (!deckA.getState().currentTrack || deckA.getState().currentTrack?.id !== startingTrack.id || !deckA.hasBuffer()) {
        if (typeof window !== 'undefined' && window.fluxoAPI) {
          console.log(`[AutopilotDiagnostic] startSession: Loading and decoding "${startingTrack.title}" onto Deck A...`);
          const buffer = await window.fluxoAPI.readAudioFile(startingTrack.filePath);
          await engine.loadTrackToDeck('A', buffer, startingTrack);
        }
      }

      deckA.play();
      this.setState('playing');
      this.notifyTrackChange();
      this.startAutonomousMonitor();

      console.log(`[AutopilotDiagnostic] startSession: Deck A playing. Scheduling background preload of upcoming track on Deck B...`);
      // 3. Preload upcoming next track onto Deck B in background
      this.prepareNextTrack();
    } catch (err) {
      console.warn('[AutopilotDiagnostic] Autopilot immediate start encountered audio load deferral:', err);
      // In environments where AudioContext is deferred or simulated, maintain session state
      this.setState('playing');
      this.notifyTrackChange();
      this.startAutonomousMonitor();
    }
  }

  /**
   * Stops session safely.
   */
  public stopSession(safe: boolean = true): void {
    this.stopAutonomousMonitor();
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
    this.stopAutonomousMonitor();
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
    this.startAutonomousMonitor();
  }

  /**
   * Prepares the upcoming track onto the inactive deck.
   * Returns true if standby deck has a valid, ready AudioBuffer.
   */
  public async prepareNextTrack(): Promise<boolean> {
    if (this.upcomingQueue.length === 0) return false;
    const nextItem = this.upcomingQueue[0];
    const inactiveDeckId = this.activeDeckId === 'A' ? 'B' : 'A';

    try {
      const engine = AudioEngine.getInstance();
      const inactiveDeck = inactiveDeckId === 'A' ? engine.deckA : engine.deckB;

      // Skip reload if already loaded with matching AudioBuffer
      if (inactiveDeck.getState().currentTrack?.id === nextItem.track.id && inactiveDeck.hasBuffer()) {
        console.log(`[AutopilotDiagnostic] prepareNextTrack: Standby Deck ${inactiveDeckId} already loaded with valid AudioBuffer for "${nextItem.track.title}".`);
        nextItem.readinessStatus = nextItem.analysis?.stemsPath ? 'ready' : 'fallback_ready';
        this.notifyQueue();
        return true;
      }

      console.log(`[AutopilotDiagnostic] prepareNextTrack: Preloading and decoding "${nextItem.track.title}" onto standby Deck ${inactiveDeckId}...`);
      if (typeof window !== 'undefined' && window.fluxoAPI) {
        const buffer = await window.fluxoAPI.readAudioFile(nextItem.track.filePath);
        await engine.loadTrackToDeck(inactiveDeckId, buffer, nextItem.track);
        console.log(`[AutopilotDiagnostic] prepareNextTrack: Standby Deck ${inactiveDeckId} ready. Buffer duration: ${inactiveDeck.duration.toFixed(2)}s.`);
        nextItem.readinessStatus = nextItem.analysis?.stemsPath ? 'ready' : 'fallback_ready';
        this.notifyQueue();
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[AutopilotDiagnostic] Anticipatory preload error for "${nextItem.track.title}":`, err);
      return false;
    }
  }

  /**
   * Evaluates remaining track duration and executes transition within the planned window.
   */
  public checkAutoTransition(currentTime: number, duration: number): void {
    if (this.state !== 'playing' || this.isTransitionInProgress) return;
    if (duration <= 0 || currentTime <= 0) return;

    const remainingTime = duration - currentTime;
    const nextItem = this.upcomingQueue[0];
    if (!nextItem) return;

    const planned = nextItem.plannedTransition;
    const triggerWindow = planned ? Math.max(16, (planned.timing?.durationSeconds ?? 16.0) + 4.0) : 20.0;

    if (remainingTime <= triggerWindow) {
      console.log(`[AutopilotDiagnostic] checkAutoTransition: remainingTime=${remainingTime.toFixed(2)}s <= triggerWindow=${triggerWindow.toFixed(2)}s. Triggering autonomous transition before track ends!`);
      this.executeAutonomousTransition();
    }
  }

  /**
   * Executes autonomous phrase-aligned transition between active and standby decks.
   */
  public async executeAutonomousTransition(isEmergencyFallback: boolean = false): Promise<void> {
    if (this.isTransitionInProgress || this.upcomingQueue.length === 0) return;

    this.isTransitionInProgress = true;
    this.setState('transitioning');
    this.lastTransitionStartTime = Date.now();

    const incomingItem = this.upcomingQueue[0];
    const fromDeckId = this.activeDeckId;
    const toDeckId = this.activeDeckId === 'A' ? 'B' : 'A';

    console.log(`[AutopilotDiagnostic] executeAutonomousTransition: Deck ${fromDeckId} -> Deck ${toDeckId} for track "${incomingItem.track.title}" (emergencyFallback=${isEmergencyFallback})`);

    try {
      const engine = AudioEngine.getInstance();
      const incomingDeck = toDeckId === 'A' ? engine.deckA : engine.deckB;

      // 1. Verify incoming deck has valid decoded buffer ready before crossfader moves
      if (!incomingDeck.hasBuffer() || incomingDeck.getState().currentTrack?.id !== incomingItem.track.id) {
        console.log(`[AutopilotDiagnostic] Standby Deck ${toDeckId} buffer missing or mismatched. Urgently preparing before starting transition...`);
        const ready = await this.prepareNextTrack();
        if (!ready && !incomingDeck.hasBuffer()) {
          console.warn(`[AutopilotDiagnostic] Failed to prepare standby track "${incomingItem.track.title}". Recovering with next queue candidate...`);
          this.handleTrackLoadFailure(incomingItem);
          return;
        }
      }

      // 2. Select transition style
      const plan = incomingItem.plannedTransition;
      let style: TransitionStyle = 'smooth_blend';
      if (isEmergencyFallback) {
        style = 'fallback_crossfade';
      } else if (plan) {
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

      // 3. Start incoming deck audio rendering
      console.log(`[AutopilotDiagnostic] Starting playback on standby Deck ${toDeckId}...`);
      incomingDeck.play(0);

      const durationBars = isEmergencyFallback ? 4 : (plan ? (plan.timing?.durationBars ?? 16) : 16);
      this.lastTransitionDuration = isEmergencyFallback ? 4.0 : (plan ? (plan.timing?.durationSeconds ?? 16.0) : 16.0);

      // 4. Start transition curves
      engine.transitionEngine.startTransition({
        style,
        fromDeck: fromDeckId,
        toDeck: toDeckId,
        durationBars,
        onComplete: () => {
          console.log(`[AutopilotDiagnostic] Transition from Deck ${fromDeckId} -> Deck ${toDeckId} completed successfully.`);
          this.completeAutonomousTransition(fromDeckId, toDeckId, incomingItem, isEmergencyFallback);
        }
      });
    } catch (err) {
      console.warn('[AutopilotDiagnostic] Transition execution caught error, executing safe completion:', err);
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
      console.log(`[AutopilotDiagnostic] completeAutonomousTransition: Outgoing Deck ${fromDeckId} paused and reset.`);
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

    console.log(`[AutopilotDiagnostic] Active deck switched to Deck ${toDeckId}. Current track now: "${toTrack.title}".`);

    // Notify track and active deck change to listeners
    this.notifyTrackChange();

    // Pop the incoming item from the queue
    this.upcomingQueue.shift();

    // Replenish lookahead queue back to 8 tracks
    this.replenishQueue();
    this.setState('playing');

    // Preload next upcoming track onto the newly inactive deck
    this.prepareNextTrack();
  }

  /**
   * Handles natural track end from DeckEngine EOF.
   * Guarantees that music never stops when a song runs out of buffered audio.
   */
  public handleTrackEnded(deckId: 'A' | 'B', track: TrackMetadata | null): void {
    console.log(`[AutopilotDiagnostic] handleTrackEnded detected on Deck ${deckId}. Autopilot activeDeck: ${this.activeDeckId}, state: ${this.state}`);
    if (deckId !== this.activeDeckId) {
      // Inactive deck ended (e.g. outgoing deck finishing fadeout or preview), ignore
      return;
    }
    if (this.state !== 'playing' && this.state !== 'transitioning') {
      return;
    }

    if (this.isTransitionInProgress) {
      console.log(`[AutopilotDiagnostic] Outgoing track reached EOF while transition is already in progress. Completing transition immediately.`);
      const toDeckId = this.activeDeckId === 'A' ? 'B' : 'A';
      const incomingItem = this.upcomingQueue[0];
      if (incomingItem) {
        this.completeAutonomousTransition(this.activeDeckId, toDeckId, incomingItem, true);
      }
      return;
    }

    // Natural track completion before transition window!
    console.log(`[AutopilotDiagnostic] Outgoing track reached EOF before anticipatory transition. Executing emergency fallback transition to next track immediately.`);
    this.executeAutonomousTransition(true);
  }

  /**
   * Handles track decoding or reading failure with bounded recovery.
   */
  private handleTrackLoadFailure(failedItem: PlannedSetItem): void {
    console.warn(`[AutopilotDiagnostic] Handling track load failure for "${failedItem.track.title}" (ID: ${failedItem.track.id})`);
    this.upcomingQueue.shift();
    this.replenishQueue();
    this.isTransitionInProgress = false;

    if (this.upcomingQueue.length > 0) {
      console.log(`[AutopilotDiagnostic] Retrying transition with next candidate: "${this.upcomingQueue[0].track.title}"`);
      this.executeAutonomousTransition(true);
    } else {
      console.error('[AutopilotDiagnostic] No more tracks available in queue for recovery. Setting state to error.');
      this.setState('error');
    }
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

  public onTrackChange(listener: TrackChangeListener): () => void {
    this.trackChangeListeners.add(listener);
    return () => this.trackChangeListeners.delete(listener);
  }
}
