/**
 * DeckEngine
 * Individual virtual deck managing playback, 3-Band DJ EQ, resonant filter, and timecode synchronization
 */
import type { TrackMetadata, DeckState } from '../../shared/types';
import { IsolatorEQ } from './IsolatorEQ';
import { LoopController, LoopLength } from './LoopController';
import { CuePointManager } from './CuePointManager';
import { AudioEffectsChain, EchoSyncBeat } from './AudioEffectsChain';

export class DeckEngine {
  public readonly deckId: 'A' | 'B';
  private readonly context: AudioContext;
  private readonly outputNode: AudioNode;

  // Audio Graph Nodes
  private sourceNode: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  public readonly lowFilter: BiquadFilterNode;
  public readonly midFilter: BiquadFilterNode;
  public readonly highFilter: BiquadFilterNode;
  public readonly sweepFilter: BiquadFilterNode;
  public readonly isolator: IsolatorEQ;
  public readonly effectsChain: AudioEffectsChain;
  public readonly gainNode: GainNode;
  public readonly analyserNode: AnalyserNode;

  // Creative DJ Engine Controllers
  public readonly loopController: LoopController;
  public readonly cuePointManager: CuePointManager;

  // Deck State
  private _currentTrack: TrackMetadata | null = null;
  private _isPlaying = false;
  private _playbackRate = 1.0;
  private _volume = 0.8;
  private _preMuteVolume = 0.8;
  private _startContextTime = 0;
  private _pausedAtPosition = 0;
  private trackEndedListeners: Set<(deckId: 'A' | 'B', track: TrackMetadata | null) => void> = new Set();

  constructor(deckId: 'A' | 'B', context: AudioContext, outputNode: AudioNode) {
    this.deckId = deckId;
    this.context = context;
    this.outputNode = outputNode;

    // 3-Band DJ Isolator EQ (<300Hz, 300Hz-3kHz, >3kHz)
    this.lowFilter = context.createBiquadFilter();
    this.lowFilter.type = 'lowshelf';
    this.lowFilter.frequency.setValueAtTime(300, context.currentTime);
    this.lowFilter.gain.setValueAtTime(0, context.currentTime); // 0 dB = unity

    this.midFilter = context.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.setValueAtTime(1200, context.currentTime);
    this.midFilter.Q.setValueAtTime(1.0, context.currentTime);
    this.midFilter.gain.setValueAtTime(0, context.currentTime);

    this.highFilter = context.createBiquadFilter();
    this.highFilter.type = 'highshelf';
    this.highFilter.frequency.setValueAtTime(3000, context.currentTime);
    this.highFilter.gain.setValueAtTime(0, context.currentTime);

    // Sweepable Dual-Mode Resonant Filter (Lowpass / Highpass)
    this.sweepFilter = context.createBiquadFilter();
    this.sweepFilter.type = 'allpass'; // Default neutral
    this.sweepFilter.frequency.setValueAtTime(1000, context.currentTime);
    this.sweepFilter.Q.setValueAtTime(1.0, context.currentTime);

    // 3-Band Linkwitz-Riley Isolator EQ
    this.isolator = new IsolatorEQ(context);

    // DSP Audio Effects Chain (Echo/Delay, Flanger)
    this.effectsChain = new AudioEffectsChain(context);

    // Deck Volume Fader
    this.gainNode = context.createGain();
    this.gainNode.gain.setValueAtTime(this._volume, context.currentTime);

    // Deck Spectrum/Peak Analyser
    this.analyserNode = context.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Controllers
    this.loopController = new LoopController();
    this.cuePointManager = new CuePointManager();

    // Re-apply loop points to active source when loop state changes
    this.loopController.subscribe((loopState) => {
      this.applyLoopToSource(loopState.isActive, loopState.startPosition, loopState.endPosition);
    });

    // Connect Deck Signal Chain:
    // [Source] -> [Low EQ] -> [Mid EQ] -> [High EQ] -> [Sweep Filter] -> [Effects Chain] -> [Gain] -> [Analyser] -> [Master Input]
    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);
    this.highFilter.connect(this.sweepFilter);
    this.sweepFilter.connect(this.effectsChain.inputNode);
    this.effectsChain.outputNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.outputNode);
  }

  public loadTrack(buffer: AudioBuffer, metadata: TrackMetadata): void {
    this.stopSource();
    this.currentBuffer = buffer;
    this._currentTrack = metadata;
    this._pausedAtPosition = 0;
    this.cuePointManager.setTrack(metadata.id);
    if (metadata.bpm) {
      this.effectsChain.setBpm(metadata.bpm);
    }
  }

  private applyLoopToSource(active: boolean, start: number, end: number): void {
    if (this.sourceNode) {
      this.sourceNode.loop = active;
      if (active && end > start) {
        this.sourceNode.loopStart = start;
        this.sourceNode.loopEnd = end;
      }
    }
  }

  public play(offsetSeconds?: number): void {
    if (!this.currentBuffer) return;
    if (this._isPlaying) {
      this.stopSource();
    }

    const startOffset = offsetSeconds !== undefined ? offsetSeconds : this._pausedAtPosition;
    const clampedOffset = Math.max(0, Math.min(startOffset, this.currentBuffer.duration));

    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.playbackRate.setValueAtTime(this._playbackRate, this.context.currentTime);

    // If loop is active, set native sub-sample loop points on AudioBufferSourceNode
    const loopState = this.loopController.getState();
    if (loopState.isActive && loopState.endPosition > loopState.startPosition) {
      this.sourceNode.loop = true;
      this.sourceNode.loopStart = loopState.startPosition;
      this.sourceNode.loopEnd = loopState.endPosition;
    }

    // Connect source to start of Deck EQ chain
    this.sourceNode.connect(this.lowFilter);

    this.sourceNode.onended = () => {
      // Natural track finish detection: verify player was active and position reached EOF
      const isNaturalEnd = this._isPlaying && (this.duration > 0 && this.currentTime >= this.duration - 0.25);
      if (isNaturalEnd) {
        this._isPlaying = false;
        this._pausedAtPosition = 0;
        console.log(`[AutopilotDiagnostic] DeckEngine ${this.deckId}: Track reached EOF naturally. (duration: ${this.duration.toFixed(2)}s, currentTime: ${this.currentTime.toFixed(2)}s)`);
        for (const listener of this.trackEndedListeners) {
          try {
            listener(this.deckId, this._currentTrack);
          } catch (err) {
            console.error(`[AutopilotDiagnostic] DeckEngine ${this.deckId} trackEnded listener error:`, err);
          }
        }
      }
    };

    this._startContextTime = this.context.currentTime - (clampedOffset / this._playbackRate);
    this.sourceNode.start(0, clampedOffset);
    this._isPlaying = true;
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._pausedAtPosition = this.currentTime;
    this.stopSource();
    this._isPlaying = false;
  }

  public stop(): void {
    this.pause();
    this._pausedAtPosition = 0;
  }

  public seek(seconds: number): void {
    const target = Math.max(0, Math.min(seconds, this.duration));
    if (this._isPlaying) {
      this.play(target);
    } else {
      this._pausedAtPosition = target;
    }
  }

  public jumpToCue(padIndex: number): boolean {
    const timestamp = this.cuePointManager.jumpToCue(padIndex);
    if (timestamp !== null) {
      this.seek(timestamp);
      return true;
    }
    return false;
  }

  public async setCue(padIndex: number, name?: string): Promise<void> {
    await this.cuePointManager.setCue(padIndex, this.currentTime, name);
  }

  public activateLoop(lengthBeats: LoopLength = 4): void {
    const bpm = this._currentTrack?.bpm || 124;
    this.loopController.activateLoop(lengthBeats, this.currentTime, bpm);
  }

  public exitLoop(): void {
    this.loopController.exitLoop();
  }

  public setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1.0, volume));
    this.gainNode.gain.setTargetAtTime(this._volume, this.context.currentTime, 0.01);
  }

  public setMute(mute: boolean): void {
    if (mute) {
      if (this._volume > 0) {
        this._preMuteVolume = this._volume;
      }
      this.setVolume(0);
    } else {
      this.setVolume(this._preMuteVolume > 0 ? this._preMuteVolume : 0.8);
    }
  }

  public setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.sourceNode) {
      this.sourceNode.playbackRate.setTargetAtTime(this._playbackRate, this.context.currentTime, 0.01);
    }
  }

  // 3-Band Isolator EQ Adjustments (Gain: 0.0 to 2.0; 0.0 = full kill -inf dB, 1.0 = unity 0dB)
  public setLowGain(gain: number): void {
    const dB = gain <= 0.001 ? -100 : 20 * Math.log10(gain);
    this.lowFilter.gain.setTargetAtTime(dB, this.context.currentTime, 0.01);
    this.isolator.setLowGain(gain);
  }

  public setMidGain(gain: number): void {
    const dB = gain <= 0.001 ? -100 : 20 * Math.log10(gain);
    this.midFilter.gain.setTargetAtTime(dB, this.context.currentTime, 0.01);
    this.isolator.setMidGain(gain);
  }

  public setHighGain(gain: number): void {
    const dB = gain <= 0.001 ? -100 : 20 * Math.log10(gain);
    this.highFilter.gain.setTargetAtTime(dB, this.context.currentTime, 0.01);
    this.isolator.setHighGain(gain);
  }

  public setLowKill(kill: boolean): void {
    this.isolator.setLowKill(kill);
    if (kill) {
      this.lowFilter.gain.setTargetAtTime(-100, this.context.currentTime, 0.005);
    } else {
      this.setLowGain(this.isolator.getState().lowGain);
    }
  }

  public setMidKill(kill: boolean): void {
    this.isolator.setMidKill(kill);
    if (kill) {
      this.midFilter.gain.setTargetAtTime(-100, this.context.currentTime, 0.005);
    } else {
      this.setMidGain(this.isolator.getState().midGain);
    }
  }

  public setHighKill(kill: boolean): void {
    this.isolator.setHighKill(kill);
    if (kill) {
      this.highFilter.gain.setTargetAtTime(-100, this.context.currentTime, 0.005);
    } else {
      this.setHighGain(this.isolator.getState().highGain);
    }
  }

  public setFilterParam(param: number, resonance = 1.0): void {
    this.isolator.setFilterParam(param, resonance);
  }

  public setFilter(type: 'allpass' | 'lowpass' | 'highpass', frequency: number, resonance = 1.0): void {
    this.sweepFilter.type = type;
    this.sweepFilter.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.01);
    this.sweepFilter.Q.setTargetAtTime(resonance, this.context.currentTime, 0.01);
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Safe to ignore if already stopped
      }
      this.sourceNode = null;
    }
  }

  // Getters
  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get currentTime(): number {
    if (!this._isPlaying) return this._pausedAtPosition;
    const elapsed = (this.context.currentTime - this._startContextTime) * this._playbackRate;
    return Math.max(0, Math.min(elapsed, this.duration));
  }

  public get duration(): number {
    return this.currentBuffer ? this.currentBuffer.duration : 0;
  }

  public get volume(): number {
    return this._volume;
  }

  public get playbackRate(): number {
    return this._playbackRate;
  }

  public get currentTrack(): TrackMetadata | null {
    return this._currentTrack;
  }

  public onTrackEnded(listener: (deckId: 'A' | 'B', track: TrackMetadata | null) => void): () => void {
    this.trackEndedListeners.add(listener);
    return () => this.trackEndedListeners.delete(listener);
  }

  public hasBuffer(): boolean {
    return this.currentBuffer !== null;
  }

  public getBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }

  public getState(): DeckState {
    return {
      deckId: this.deckId,
      currentTrack: this._currentTrack,
      isPlaying: this._isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this._playbackRate,
      volume: this._volume,
      isMuted: this._volume === 0,
      lowGain: this.lowFilter.gain.value,
      midGain: this.midFilter.gain.value,
      highGain: this.highFilter.gain.value,
      filterFreq: this.sweepFilter.frequency.value,
      filterResonance: this.sweepFilter.Q.value
    };
  }
}
