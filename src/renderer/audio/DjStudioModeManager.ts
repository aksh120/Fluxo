/**
 * DjStudioModeManager.ts
 * Multi-Mode Orchestrator for Fluxo DJ Studio
 * Manages 3 distinct operating levels:
 * - Automatic DJ: Hands-off intelligent sequencing, phrase detection, and automatic transition execution.
 * - Assisted DJ: Proposes optimal transition point & family; user previews, tweaks, or triggers.
 * - Manual DJ: Direct hands-on control over decks, pitch faders, Linkwitz-Riley EQ, loops, and crossfader.
 */

import type { TransitionPlan, TransitionFamily } from './TransitionPlanner';

export type DjOperatingMode = 'automatic' | 'assisted' | 'manual';

export interface DjModeManagerOptions {
  onAutoTriggerTransition: (plan: TransitionPlan) => void;
  onStatusUpdate?: (status: string) => void;
  onModeChange?: (mode: DjOperatingMode) => void;
}

export class DjStudioModeManager {
  private _mode: DjOperatingMode = 'automatic';
  private _isAutoMixEnabled = true;
  private _hasTriggeredForCurrentTrack = false;
  private _currentPlan: TransitionPlan | null = null;

  constructor(private readonly options: DjModeManagerOptions) {}

  public get mode(): DjOperatingMode {
    return this._mode;
  }

  public setMode(newMode: DjOperatingMode): void {
    if (this._mode !== newMode) {
      this._mode = newMode;
      if (this.options.onModeChange) {
        this.options.onModeChange(newMode);
      }
      this.updateStatus();
    }
  }

  public get isAutoMixEnabled(): boolean {
    return this._isAutoMixEnabled;
  }

  public setAutoMixEnabled(enabled: boolean): void {
    this._isAutoMixEnabled = enabled;
    this.updateStatus();
  }

  public setPlan(plan: TransitionPlan | null): void {
    this._currentPlan = plan;
    this._hasTriggeredForCurrentTrack = false;
    this.updateStatus();
  }

  /**
   * Called every 100-250ms during playback clock loop
   */
  public checkPlaybackProgress(
    activeTrackCurrentTime: number,
    activeTrackDuration: number
  ): void {
    if (this._mode !== 'automatic' || !this._isAutoMixEnabled || !this._currentPlan) {
      return;
    }

    if (this._hasTriggeredForCurrentTrack) {
      return;
    }

    // Trigger transition when playhead reaches planned transitionStartA
    // (with a small 0.25s tolerance window)
    const triggerTime = this._currentPlan.timing.transitionStartA;
    if (activeTrackCurrentTime >= triggerTime && triggerTime > 0) {
      this._hasTriggeredForCurrentTrack = true;
      if (this.options.onStatusUpdate) {
        this.options.onStatusUpdate(`Auto DJ: Executing ${this._currentPlan.family.replace('_', ' ')} transition`);
      }
      this.options.onAutoTriggerTransition(this._currentPlan);
    }
  }

  /**
   * Resets trigger state when a new track starts
   */
  public resetTrack(): void {
    this._hasTriggeredForCurrentTrack = false;
  }

  private updateStatus(): void {
    if (!this.options.onStatusUpdate) return;

    if (this._mode === 'automatic') {
      this.options.onStatusUpdate(
        this._isAutoMixEnabled
          ? 'Auto DJ Active • Monitoring phrases for automated handoff'
          : 'Auto DJ Paused'
      );
    } else if (this._mode === 'assisted') {
      this.options.onStatusUpdate('Assisted DJ • Plan ready. Click Execute or Audition to preview.');
    } else {
      this.options.onStatusUpdate('Manual DJ • Decks and crossfader under direct tactile control.');
    }
  }
}
