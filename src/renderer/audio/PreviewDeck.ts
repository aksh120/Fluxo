import type { TransitionStyle } from '../../shared/types';

export interface PreviewTransitionConfig {
  outgoingBuffer: AudioBuffer;
  incomingBuffer: AudioBuffer;
  outgoingTrackTitle?: string;
  incomingTrackTitle?: string;
  overlapSeconds: number;
  style: TransitionStyle;
  preRollSeconds?: number;
  postRollSeconds?: number;
}

export class PreviewDeck {
  private context: AudioContext;
  private previewGain: GainNode;

  // Active audition nodes
  private outgoingSource: AudioBufferSourceNode | null = null;
  private incomingSource: AudioBufferSourceNode | null = null;
  private outgoingGain: GainNode | null = null;
  private incomingGain: GainNode | null = null;
  private outgoingFilter: BiquadFilterNode | null = null;
  private incomingFilter: BiquadFilterNode | null = null;

  // Playback state
  private _isPlaying = false;
  private _startTime = 0;
  private _pausedAt = 0;
  private _duration = 0;
  private _config: PreviewTransitionConfig | null = null;
  private endTimeout: ReturnType<typeof setTimeout> | null = null;

  // Observers
  public onPlaybackEnd?: () => void;
  public onTimeUpdate?: (currentTime: number, duration: number) => void;

  constructor(context?: AudioContext) {
    if (context) {
      this.context = context;
    } else if (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioCtx();
    } else {
      this.context = {} as unknown as AudioContext;
    }

    if (this.context && typeof this.context.createGain === 'function') {
      this.previewGain = this.context.createGain();
      this.previewGain.gain.setValueAtTime(0.85, this.context.currentTime);
      this.previewGain.connect(this.context.destination);
    } else {
      this.previewGain = {
        gain: { setValueAtTime: () => {}, setTargetAtTime: () => {} },
        connect: () => {},
        disconnect: () => {}
      } as unknown as GainNode;
    }
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get duration(): number {
    return this._duration;
  }

  public get currentTime(): number {
    if (!this._isPlaying) return this._pausedAt;
    const elapsed = this.context.currentTime - this._startTime;
    return Math.min(this._duration, Math.max(0, elapsed));
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1.0, vol));
    if (this.previewGain?.gain?.setValueAtTime) {
      this.previewGain.gain.setValueAtTime(clamped, this.context.currentTime);
    }
  }

  /**
   * Loads a transition pairing for audition.
   */
  public prepareTransition(config: PreviewTransitionConfig): void {
    this.stop();
    this._config = config;
    const preRoll = config.preRollSeconds ?? 4;
    const postRoll = config.postRollSeconds ?? 4;
    this._duration = preRoll + config.overlapSeconds + postRoll;
    this._pausedAt = 0;
  }

  /**
   * Starts auditioning the planned transition with automated curves.
   */
  public play(startOffset = 0): void {
    if (!this._config) return;
    this.stop();

    const config = this._config;
    const preRoll = config.preRollSeconds ?? 4;
    const postRoll = config.postRollSeconds ?? 4;
    const overlap = config.overlapSeconds;
    this._duration = preRoll + overlap + postRoll;

    const ctx = this.context;
    const now = ctx.currentTime;
    this._startTime = now - startOffset;
    this._isPlaying = true;

    // Create gain & filter nodes for Deck A (Outgoing) and Deck B (Incoming)
    this.outgoingGain = ctx.createGain();
    this.incomingGain = ctx.createGain();
    this.outgoingFilter = ctx.createBiquadFilter();
    this.incomingFilter = ctx.createBiquadFilter();

    // Default filter bypass states
    this.outgoingFilter.type = 'allpass';
    this.incomingFilter.type = 'allpass';

    // Route: Source -> Filter -> Gain -> PreviewMasterGain
    this.outgoingFilter.connect(this.outgoingGain);
    this.outgoingGain.connect(this.previewGain);

    this.incomingFilter.connect(this.incomingGain);
    this.incomingGain.connect(this.previewGain);

    // Calculate source buffer start points
    // Outgoing plays until its end: [durationA - overlap - preRoll, durationA]
    const outBufDuration = config.outgoingBuffer.duration;
    const outBufferStart = Math.max(0, outBufDuration - overlap - preRoll + startOffset);

    // Incoming plays from start: [0, overlap + postRoll]
    const inBufferStart = Math.max(0, startOffset - preRoll);

    // Setup AudioBufferSourceNodes
    this.outgoingSource = ctx.createBufferSource();
    this.outgoingSource.buffer = config.outgoingBuffer;
    this.outgoingSource.connect(this.outgoingFilter);

    this.incomingSource = ctx.createBufferSource();
    this.incomingSource.buffer = config.incomingBuffer;
    this.incomingSource.connect(this.incomingFilter);

    // Automate volume and EQ curves
    const transitionStart = now + Math.max(0, preRoll - startOffset);
    const transitionEnd = transitionStart + overlap;

    // Automated curve dispatch based on style:
    if (config.style === 'smooth') {
      // Outgoing: full volume until transitionStart, then cosine fade out
      this.outgoingGain.gain.setValueAtTime(1.0, now);
      if (transitionStart > now) {
        this.outgoingGain.gain.setValueAtTime(1.0, transitionStart);
      }
      this.outgoingGain.gain.linearRampToValueAtTime(0.0, transitionEnd);

      // Incoming: 0 volume until transitionStart, then sine/linear fade in
      this.incomingGain.gain.setValueAtTime(0.0, now);
      if (transitionStart > now) {
        this.incomingGain.gain.setValueAtTime(0.0, transitionStart);
      }
      this.incomingGain.gain.linearRampToValueAtTime(1.0, transitionEnd);
    } else if (config.style === 'bass_swap') {
      // Low-shelf kill crossover at midpoint
      const midPoint = transitionStart + overlap * 0.5;

      this.outgoingGain.gain.setValueAtTime(1.0, now);
      this.incomingGain.gain.setValueAtTime(0.0, now);

      // Mids/Highs blend
      this.outgoingGain.gain.linearRampToValueAtTime(0.0, transitionEnd);
      this.incomingGain.gain.linearRampToValueAtTime(1.0, transitionEnd);

      // Bass swap filter
      this.outgoingFilter.type = 'lowshelf';
      this.outgoingFilter.frequency.setValueAtTime(250, now);
      this.outgoingFilter.gain.setValueAtTime(0, now);
      this.outgoingFilter.gain.setValueAtTime(-24, midPoint);

      this.incomingFilter.type = 'lowshelf';
      this.incomingFilter.frequency.setValueAtTime(250, now);
      this.incomingFilter.gain.setValueAtTime(-24, now);
      this.incomingFilter.gain.setValueAtTime(0, midPoint);
    } else if (config.style === 'filter_sweep') {
      // Outgoing high-pass sweeps up from 20Hz to 8000Hz
      this.outgoingFilter.type = 'highpass';
      this.outgoingFilter.frequency.setValueAtTime(20, now);
      if (transitionStart > now) {
        this.outgoingFilter.frequency.setValueAtTime(20, transitionStart);
      }
      this.outgoingFilter.frequency.exponentialRampToValueAtTime(6000, transitionEnd);
      this.outgoingGain.gain.linearRampToValueAtTime(0.0, transitionEnd);

      // Incoming low-pass sweeps from 200Hz up to 20000Hz
      this.incomingFilter.type = 'lowpass';
      this.incomingFilter.frequency.setValueAtTime(200, now);
      if (transitionStart > now) {
        this.incomingFilter.frequency.setValueAtTime(200, transitionStart);
      }
      this.incomingFilter.frequency.exponentialRampToValueAtTime(20000, transitionEnd);
      this.incomingGain.gain.linearRampToValueAtTime(1.0, transitionEnd);
    } else {
      // Drop cut at midpoint
      const cutPoint = transitionStart + overlap * 0.5;
      this.outgoingGain.gain.setValueAtTime(1.0, now);
      this.outgoingGain.gain.setValueAtTime(1.0, cutPoint);
      this.outgoingGain.gain.setValueAtTime(0.0, cutPoint + 0.005);

      this.incomingGain.gain.setValueAtTime(0.0, now);
      this.incomingGain.gain.setValueAtTime(0.0, cutPoint);
      this.incomingGain.gain.setValueAtTime(1.0, cutPoint + 0.005);
    }

    // Start playback
    const remainingOutgoingTime = preRoll + overlap - startOffset;
    if (remainingOutgoingTime > 0) {
      this.outgoingSource.start(now, outBufferStart, remainingOutgoingTime);
    }

    const inDelay = Math.max(0, preRoll - startOffset);
    const inDuration = overlap + postRoll;
    this.incomingSource.start(now + inDelay, inBufferStart, inDuration);

    const remainingTotal = Math.max(0, this._duration - startOffset);
    this.endTimeout = setTimeout(() => {
      this.stop();
      if (this.onPlaybackEnd) this.onPlaybackEnd();
    }, remainingTotal * 1000);
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._pausedAt = this.currentTime;
    this.stopNodesOnly();
    this._isPlaying = false;
  }

  public resume(): void {
    if (this._isPlaying || !this._config) return;
    this.play(this._pausedAt);
  }

  public stop(): void {
    this._isPlaying = false;
    this._pausedAt = 0;
    this.stopNodesOnly();
  }

  private stopNodesOnly(): void {
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }
    if (this.outgoingSource) {
      try {
        this.outgoingSource.stop();
        this.outgoingSource.disconnect();
      } catch {
        // Safe if already stopped
      }
      this.outgoingSource = null;
    }
    if (this.incomingSource) {
      try {
        this.incomingSource.stop();
        this.incomingSource.disconnect();
      } catch {
        // Safe if already stopped
      }
      this.incomingSource = null;
    }
  }
}
