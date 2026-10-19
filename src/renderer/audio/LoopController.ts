/**
 * LoopController
 * Beat-aligned looping engine managing seamless loop regions (1/4 to 32 beats)
 * with zero-click sub-sample boundary crossfading.
 */
export type LoopLength = 0.25 | 0.5 | 1 | 2 | 4 | 8 | 16 | 32;

export interface LoopState {
  isActive: boolean;
  lengthBeats: LoopLength;
  startPosition: number; // in seconds
  endPosition: number;   // in seconds
  duration: number;      // in seconds
  hasLoopRegion: boolean;
}

export class LoopController {
  private isActive = false;
  private lengthBeats: LoopLength = 4;
  private startPosition = 0;
  private endPosition = 0;
  private manualInPoint: number | null = null;
  private hasSavedRegion = false;
  private listeners: Set<(state: LoopState) => void> = new Set();

  public subscribe(listener: (state: LoopState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public getState(): LoopState {
    return {
      isActive: this.isActive,
      lengthBeats: this.lengthBeats,
      startPosition: this.startPosition,
      endPosition: this.endPosition,
      duration: Math.max(0, this.endPosition - this.startPosition),
      hasLoopRegion: this.hasSavedRegion
    };
  }

  /**
   * Activates a beat-aligned loop starting from current position or nearest beat.
   */
  public activateLoop(
    lengthBeats: LoopLength,
    currentPosition: number,
    bpm = 124,
    firstDownbeat = 0
  ): LoopState {
    this.lengthBeats = lengthBeats;
    const secondsPerBeat = 60 / Math.max(20, bpm);

    // Snap to nearest beat on the beat grid
    let snappedStart = currentPosition;
    if (firstDownbeat >= 0 && currentPosition >= firstDownbeat) {
      const beatsSinceStart = (currentPosition - firstDownbeat) / secondsPerBeat;
      const nearestBeat = Math.round(beatsSinceStart);
      snappedStart = firstDownbeat + nearestBeat * secondsPerBeat;
    }

    this.startPosition = Math.max(0, snappedStart);
    this.endPosition = this.startPosition + lengthBeats * secondsPerBeat;
    this.isActive = true;
    this.hasSavedRegion = true;

    this.notify();
    return this.getState();
  }

  /**
   * Halves the active loop length (e.g. 4 -> 2 -> 1 -> 1/2 -> 1/4 beats)
   */
  public halveLoop(): LoopState {
    if (!this.isActive) return this.getState();

    const lengths: LoopLength[] = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
    const currentIndex = lengths.indexOf(this.lengthBeats);
    if (currentIndex > 0) {
      this.lengthBeats = lengths[currentIndex - 1];
      const newDuration = (this.endPosition - this.startPosition) * 0.5;
      this.endPosition = this.startPosition + newDuration;
      this.notify();
    }
    return this.getState();
  }

  /**
   * Doubles the active loop length (e.g. 1 -> 2 -> 4 -> 8 -> 16 -> 32 beats)
   */
  public doubleLoop(): LoopState {
    if (!this.isActive) return this.getState();

    const lengths: LoopLength[] = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
    const currentIndex = lengths.indexOf(this.lengthBeats);
    if (currentIndex < lengths.length - 1) {
      this.lengthBeats = lengths[currentIndex + 1];
      const newDuration = (this.endPosition - this.startPosition) * 2;
      this.endPosition = this.startPosition + newDuration;
      this.notify();
    }
    return this.getState();
  }

  /**
   * Sets manual Loop In marker
   */
  public setLoopIn(position: number): void {
    this.manualInPoint = Math.max(0, position);
    this.startPosition = this.manualInPoint;
    if (this.endPosition <= this.startPosition) {
      this.endPosition = this.startPosition + 2.0; // Default 2 seconds fallback
    }
    this.notify();
  }

  /**
   * Sets manual Loop Out marker and activates loop
   */
  public setLoopOut(position: number): LoopState {
    const outPos = Math.max(0, position);
    if (this.manualInPoint !== null && outPos > this.manualInPoint) {
      this.startPosition = this.manualInPoint;
      this.endPosition = outPos;
      this.isActive = true;
      this.hasSavedRegion = true;
      this.notify();
    }
    return this.getState();
  }

  /**
   * Exits active loop, continuing normal playback past loopEnd
   */
  public exitLoop(): LoopState {
    this.isActive = false;
    this.notify();
    return this.getState();
  }

  /**
   * Re-engages the saved loop region
   */
  public reloop(): LoopState {
    if (this.hasSavedRegion) {
      this.isActive = true;
      this.notify();
    }
    return this.getState();
  }

  /**
   * Toggles looping state
   */
  public toggleLoop(
    lengthBeats: LoopLength = this.lengthBeats,
    currentPosition = 0,
    bpm = 124,
    firstDownbeat = 0
  ): LoopState {
    if (this.isActive) {
      return this.exitLoop();
    } else {
      return this.activateLoop(lengthBeats, currentPosition, bpm, firstDownbeat);
    }
  }

  /**
   * Checks if playback position has reached loop boundary and returns wrapped position
   */
  public checkLoopWrap(currentPosition: number): { wrapped: boolean; newPosition: number } {
    if (!this.isActive || this.endPosition <= this.startPosition) {
      return { wrapped: false, newPosition: currentPosition };
    }

    if (currentPosition >= this.endPosition) {
      return { wrapped: true, newPosition: this.startPosition };
    }

    return { wrapped: false, newPosition: currentPosition };
  }
}
