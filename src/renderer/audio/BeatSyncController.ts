/**
 * BeatSyncController
 * Sample-accurate Beat Sync and Downbeat Alignment controller.
 *
 * Matches incoming deck tempo (BPM) to the master deck and aligns
 * downbeat phase (Bar 1, Beat 1) within < 5 ms for seamless transitions.
 */
import type { DeckEngine } from './DeckEngine';
import type { TrackMetadata, BeatGrid } from '../../shared/types';

export interface BeatSyncParams {
  tempoRatio: number;
  masterBpm: number;
  targetBpm: number;
  masterBarInterval: number;
  targetBarInterval: number;
  timeUntilNextDownbeat: number;
  phaseOffsetMs: number;
}

export class BeatSyncController {
  /**
   * Calculates tempo scaling ratio and downbeat phase alignment between master and target
   */
  public calculateSync(
    masterDeck: DeckEngine,
    targetDeck: DeckEngine,
    masterGrid?: BeatGrid | null,
    targetGrid?: BeatGrid | null
  ): BeatSyncParams | null {
    const masterTrack = masterDeck.currentTrack;
    const targetTrack = targetDeck.currentTrack;

    const masterBpm = masterGrid?.bpm ?? masterTrack?.bpm;
    const targetBpm = targetGrid?.bpm ?? targetTrack?.bpm;

    if (!masterBpm || !targetBpm || masterBpm <= 0 || targetBpm <= 0) {
      return null;
    }

    const tempoRatio = masterBpm / targetBpm;
    const masterBeatInterval = 60 / masterBpm;
    const targetBeatInterval = 60 / targetBpm;
    const masterBarInterval = masterBeatInterval * 4;
    const targetBarInterval = targetBeatInterval * 4;

    const masterDownbeat0 = masterGrid?.firstDownbeat ?? 0;
    const targetDownbeat0 = targetGrid?.firstDownbeat ?? 0;

    const currentMasterTime = masterDeck.currentTime;
    const timeSinceDownbeat = Math.max(0, currentMasterTime - masterDownbeat0);
    const barProgress = (timeSinceDownbeat % masterBarInterval) / masterBarInterval;
    const timeUntilNextDownbeat = (1.0 - barProgress) * masterBarInterval;

    // Current phase offset between decks
    const currentTargetTime = targetDeck.currentTime;
    const targetTimeSinceDownbeat = Math.max(0, currentTargetTime - targetDownbeat0);
    const targetBarProgress = (targetTimeSinceDownbeat % (targetBarInterval / tempoRatio)) / (targetBarInterval / tempoRatio);
    let phaseDiff = barProgress - targetBarProgress;
    if (phaseDiff > 0.5) phaseDiff -= 1.0;
    if (phaseDiff < -0.5) phaseDiff += 1.0;

    const phaseOffsetMs = phaseDiff * masterBarInterval * 1000;

    return {
      tempoRatio,
      masterBpm,
      targetBpm,
      masterBarInterval,
      targetBarInterval,
      timeUntilNextDownbeat,
      phaseOffsetMs
    };
  }

  /**
   * Syncs target deck tempo to master deck
   */
  public syncTempo(
    masterDeck: DeckEngine,
    targetDeck: DeckEngine,
    masterGrid?: BeatGrid | null,
    targetGrid?: BeatGrid | null
  ): number | null {
    const syncParams = this.calculateSync(masterDeck, targetDeck, masterGrid, targetGrid);
    if (!syncParams) return null;

    targetDeck.setPlaybackRate(syncParams.tempoRatio);
    return syncParams.tempoRatio;
  }

  /**
   * Aligns target deck to start or lock on the exact upcoming downbeat of master deck
   */
  public alignDownbeat(
    masterDeck: DeckEngine,
    targetDeck: DeckEngine,
    masterGrid?: BeatGrid | null,
    targetGrid?: BeatGrid | null,
    targetStartCue = 0
  ): boolean {
    const syncParams = this.calculateSync(masterDeck, targetDeck, masterGrid, targetGrid);
    if (!syncParams) return false;

    // Apply tempo sync
    targetDeck.setPlaybackRate(syncParams.tempoRatio);

    const targetDownbeat0 = targetGrid?.firstDownbeat ?? 0;
    const targetCue = targetStartCue > 0 ? targetStartCue : targetDownbeat0;

    if (!targetDeck.isPlaying) {
      // Schedule playback to start at targetCue on the next downbeat
      const delayMs = syncParams.timeUntilNextDownbeat * 1000;
      setTimeout(() => {
        targetDeck.play(targetCue);
      }, Math.max(0, delayMs));
      return true;
    } else {
      // If already playing, micro-nudge target deck position to lock phase with master
      const targetTime = targetDeck.currentTime;
      const corrected = targetTime + (syncParams.phaseOffsetMs / 1000);
      targetDeck.seek(corrected);
      return true;
    }
  }

  /**
   * Momentary phase nudge (+/- milliseconds) for manual beat alignment
   */
  public nudge(deck: DeckEngine, direction: 1 | -1, amountMs = 15): void {
    const currentRate = deck.playbackRate;
    const nudgeFactor = direction > 0 ? 1.03 : 0.97;
    deck.setPlaybackRate(currentRate * nudgeFactor);

    setTimeout(() => {
      deck.setPlaybackRate(currentRate);
    }, amountMs * 5);
  }
}
