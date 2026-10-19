export interface StemPlayerState {
  hasStems: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  vocalVolume: number;
  instrumentalVolume: number;
  isVocalMuted: boolean;
  isInstrumentalMuted: boolean;
  isVocalSolo: boolean;
  isInstrumentalSolo: boolean;
}

export class StemDeckPlayer {
  private readonly context: AudioContext;
  private readonly outputNode: AudioNode;

  private vocalBuffer: AudioBuffer | null = null;
  private instrumentalBuffer: AudioBuffer | null = null;

  private vocalSource: AudioBufferSourceNode | null = null;
  private instrumentalSource: AudioBufferSourceNode | null = null;

  private vocalGain: GainNode;
  private instrumentalGain: GainNode;
  private masterGain: GainNode;

  private _isPlaying = false;
  private _startContextTime = 0;
  private _pausedAtPosition = 0;

  private _vocalVol = 1.0;
  private _instVol = 1.0;
  private _vocalMuted = false;
  private _instMuted = false;
  private _vocalSolo = false;
  private _instSolo = false;

  private listeners: Set<(state: StemPlayerState) => void> = new Set();

  constructor(context: AudioContext, outputNode: AudioNode) {
    this.context = context;
    this.outputNode = outputNode;

    this.vocalGain = context.createGain();
    this.instrumentalGain = context.createGain();
    this.masterGain = context.createGain();

    this.vocalGain.gain.setValueAtTime(this._vocalVol, context.currentTime);
    this.instrumentalGain.gain.setValueAtTime(this._instVol, context.currentTime);

    this.vocalGain.connect(this.masterGain);
    this.instrumentalGain.connect(this.masterGain);
    this.masterGain.connect(this.outputNode);
  }

  public subscribe(listener: (state: StemPlayerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const s = this.getState();
    for (const listener of this.listeners) {
      listener(s);
    }
  }

  public loadStems(vocalBuffer: AudioBuffer, instrumentalBuffer: AudioBuffer): void {
    this.stopSources();
    this.vocalBuffer = vocalBuffer;
    this.instrumentalBuffer = instrumentalBuffer;
    this._pausedAtPosition = 0;
    this.notify();
  }

  public play(offsetSeconds?: number): void {
    if (!this.vocalBuffer && !this.instrumentalBuffer) return;
    if (this._isPlaying) {
      this.stopSources();
    }

    const startOffset = offsetSeconds !== undefined ? offsetSeconds : this._pausedAtPosition;
    const duration = this.duration;
    const clampedOffset = Math.max(0, Math.min(startOffset, duration));

    if (this.vocalBuffer) {
      this.vocalSource = this.context.createBufferSource();
      this.vocalSource.buffer = this.vocalBuffer;
      this.vocalSource.connect(this.vocalGain);
      this.vocalSource.start(0, clampedOffset);
    }

    if (this.instrumentalBuffer) {
      this.instrumentalSource = this.context.createBufferSource();
      this.instrumentalSource.buffer = this.instrumentalBuffer;
      this.instrumentalSource.connect(this.instrumentalGain);
      this.instrumentalSource.start(0, clampedOffset);
    }

    this._startContextTime = this.context.currentTime - clampedOffset;
    this._isPlaying = true;
    this.notify();
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._pausedAtPosition = this.currentTime;
    this.stopSources();
    this._isPlaying = false;
    this.notify();
  }

  public seek(seconds: number): void {
    const target = Math.max(0, Math.min(seconds, this.duration));
    if (this._isPlaying) {
      this.play(target);
    } else {
      this._pausedAtPosition = target;
      this.notify();
    }
  }

  public setVocalVolume(vol: number): void {
    this._vocalVol = Math.max(0, Math.min(1.5, vol));
    this.updateGains();
    this.notify();
  }

  public setInstrumentalVolume(vol: number): void {
    this._instVol = Math.max(0, Math.min(1.5, vol));
    this.updateGains();
    this.notify();
  }

  public setVocalMute(muted: boolean): void {
    this._vocalMuted = muted;
    this.updateGains();
    this.notify();
  }

  public setInstrumentalMute(muted: boolean): void {
    this._instMuted = muted;
    this.updateGains();
    this.notify();
  }

  public setVocalSolo(solo: boolean): void {
    this._vocalSolo = solo;
    if (solo) this._instSolo = false;
    this.updateGains();
    this.notify();
  }

  public setInstrumentalSolo(solo: boolean): void {
    this._instSolo = solo;
    if (solo) this._vocalSolo = false;
    this.updateGains();
    this.notify();
  }

  private updateGains(): void {
    let effectiveVocalGain = this._vocalVol;
    let effectiveInstGain = this._instVol;

    if (this._vocalSolo) {
      effectiveInstGain = 0;
    } else if (this._instSolo) {
      effectiveVocalGain = 0;
    } else {
      if (this._vocalMuted) effectiveVocalGain = 0;
      if (this._instMuted) effectiveInstGain = 0;
    }

    this.vocalGain.gain.setTargetAtTime(effectiveVocalGain, this.context.currentTime, 0.01);
    this.instrumentalGain.gain.setTargetAtTime(effectiveInstGain, this.context.currentTime, 0.01);
  }

  private stopSources(): void {
    if (this.vocalSource) {
      try {
        this.vocalSource.stop();
        this.vocalSource.disconnect();
      } catch {}
      this.vocalSource = null;
    }
    if (this.instrumentalSource) {
      try {
        this.instrumentalSource.stop();
        this.instrumentalSource.disconnect();
      } catch {}
      this.instrumentalSource = null;
    }
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get currentTime(): number {
    if (!this._isPlaying) return this._pausedAtPosition;
    const elapsed = this.context.currentTime - this._startContextTime;
    return Math.max(0, Math.min(elapsed, this.duration));
  }

  public get duration(): number {
    return Math.max(
      this.vocalBuffer ? this.vocalBuffer.duration : 0,
      this.instrumentalBuffer ? this.instrumentalBuffer.duration : 0
    );
  }

  public getState(): StemPlayerState {
    return {
      hasStems: Boolean(this.vocalBuffer || this.instrumentalBuffer),
      isPlaying: this._isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      vocalVolume: this._vocalVol,
      instrumentalVolume: this._instVol,
      isVocalMuted: this._vocalMuted,
      isInstrumentalMuted: this._instMuted,
      isVocalSolo: this._vocalSolo,
      isInstrumentalSolo: this._instSolo
    };
  }
}
