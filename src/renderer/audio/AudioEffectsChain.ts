/**
 * AudioEffectsChain
 * Beat-synced Echo/Delay, Flanger comb filter, and resonant sweep effects
 */
export type EchoSyncBeat = 0.25 | 0.5 | 0.75 | 1.0;

export interface EffectsState {
  echoEnabled: boolean;
  echoBeat: EchoSyncBeat;
  echoMix: number; // 0.0 to 1.0
  echoFeedback: number; // 0.0 to 0.85
  flangerEnabled: boolean;
  flangerMix: number; // 0.0 to 1.0
  flangerRate: number; // 0.1 to 3.0 Hz
}

export class AudioEffectsChain {
  private readonly context: AudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  // Echo / Delay Chain Nodes
  private readonly delayNode: DelayNode;
  private readonly feedbackGain: GainNode;
  private readonly dampingFilter: BiquadFilterNode;
  private readonly echoWetGain: GainNode;
  private echoEnabled = false;
  private echoBeat: EchoSyncBeat = 0.5;
  private echoMix = 0.0;
  private echoFeedback = 0.45;
  private currentBpm = 124;

  // Flanger Nodes
  private readonly flangerDelay: DelayNode;
  private readonly flangerFeedback: GainNode;
  private readonly flangerLfo: OscillatorNode;
  private readonly flangerLfoDepth: GainNode;
  private readonly flangerWetGain: GainNode;
  private flangerEnabled = false;
  private flangerMix = 0.0;
  private flangerRate = 0.5;

  // Dry Path
  private readonly dryGain: GainNode;

  constructor(context: AudioContext) {
    this.context = context;

    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
    this.dryGain = context.createGain();
    this.dryGain.gain.setValueAtTime(1.0, context.currentTime);

    const createDelaySafe = (max: number): DelayNode => {
      if (typeof context.createDelay === 'function') {
        return context.createDelay(max);
      }
      return {
        connect: () => {},
        disconnect: () => {},
        delayTime: { value: 0, setValueAtTime: () => {}, setTargetAtTime: () => {} }
      } as unknown as DelayNode;
    };

    const createOscillatorSafe = (): OscillatorNode => {
      if (typeof context.createOscillator === 'function') {
        return context.createOscillator();
      }
      return {
        connect: () => {},
        disconnect: () => {},
        frequency: { value: 0, setValueAtTime: () => {}, setTargetAtTime: () => {} },
        type: 'sine',
        start: () => {},
        stop: () => {}
      } as unknown as OscillatorNode;
    };

    // 1. Echo / Delay Graph setup
    this.delayNode = createDelaySafe(4.0); // Up to 4s buffer
    this.feedbackGain = context.createGain();
    this.dampingFilter = context.createBiquadFilter();
    this.echoWetGain = context.createGain();

    this.dampingFilter.type = 'lowpass';
    this.dampingFilter.frequency.setValueAtTime(3200, context.currentTime);
    this.feedbackGain.gain.setValueAtTime(this.echoFeedback, context.currentTime);
    this.echoWetGain.gain.setValueAtTime(0.0, context.currentTime);

    // Initial delay time
    const initialDelayTime = (this.echoBeat * 60) / this.currentBpm;
    this.delayNode.delayTime.setValueAtTime(initialDelayTime, context.currentTime);

    // Connect Echo:
    // Input -> Delay -> Damping Filter -> Feedback -> Delay
    //                                  -> Echo Wet -> Output
    this.inputNode.connect(this.delayNode);
    this.delayNode.connect(this.dampingFilter);
    this.dampingFilter.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.dampingFilter.connect(this.echoWetGain);
    this.echoWetGain.connect(this.outputNode);

    // 2. Flanger Graph setup (Short modulated comb filter 1ms - 5ms)
    this.flangerDelay = createDelaySafe(0.02);
    this.flangerDelay.delayTime.setValueAtTime(0.003, context.currentTime); // 3ms center

    this.flangerFeedback = context.createGain();
    this.flangerFeedback.gain.setValueAtTime(0.5, context.currentTime);

    this.flangerWetGain = context.createGain();
    this.flangerWetGain.gain.setValueAtTime(0.0, context.currentTime);

    this.flangerLfo = createOscillatorSafe();
    this.flangerLfo.type = 'sine';
    this.flangerLfo.frequency.setValueAtTime(this.flangerRate, context.currentTime);

    this.flangerLfoDepth = context.createGain();
    this.flangerLfoDepth.gain.setValueAtTime(0.002, context.currentTime); // +/- 2ms sweep

    this.flangerLfo.connect(this.flangerLfoDepth);
    this.flangerLfoDepth.connect(this.flangerDelay.delayTime);

    // Flanger routing
    this.inputNode.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerFeedback);
    this.flangerFeedback.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerWetGain);
    this.flangerWetGain.connect(this.outputNode);

    try {
      this.flangerLfo.start();
    } catch {
      // Safe in test environments
    }

    // 3. Direct Dry path
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);
  }

  public setBpm(bpm: number): void {
    if (bpm <= 20) return;
    this.currentBpm = bpm;
    if (this.echoEnabled) {
      this.updateDelayTime();
    }
  }

  public setEchoBeat(beat: EchoSyncBeat): void {
    this.echoBeat = beat;
    this.updateDelayTime();
  }

  public setEchoMix(mix: number): void {
    this.echoMix = Math.max(0, Math.min(1.0, mix));
    this.echoEnabled = this.echoMix > 0.01;
    this.echoWetGain.gain.setTargetAtTime(this.echoMix, this.context.currentTime, 0.01);
  }

  public setEchoFeedback(feedback: number): void {
    this.echoFeedback = Math.max(0, Math.min(0.85, feedback));
    this.feedbackGain.gain.setTargetAtTime(this.echoFeedback, this.context.currentTime, 0.01);
  }

  public setFlangerMix(mix: number): void {
    this.flangerMix = Math.max(0, Math.min(1.0, mix));
    this.flangerEnabled = this.flangerMix > 0.01;
    this.flangerWetGain.gain.setTargetAtTime(this.flangerMix, this.context.currentTime, 0.01);
  }

  public setFlangerRate(rateHz: number): void {
    this.flangerRate = Math.max(0.1, Math.min(5.0, rateHz));
    this.flangerLfo.frequency.setTargetAtTime(this.flangerRate, this.context.currentTime, 0.01);
  }

  private updateDelayTime(): void {
    const delaySeconds = (this.echoBeat * 60) / this.currentBpm;
    this.delayNode.delayTime.setTargetAtTime(delaySeconds, this.context.currentTime, 0.02);
  }

  public getState(): EffectsState {
    return {
      echoEnabled: this.echoEnabled,
      echoBeat: this.echoBeat,
      echoMix: this.echoMix,
      echoFeedback: this.echoFeedback,
      flangerEnabled: this.flangerEnabled,
      flangerMix: this.flangerMix,
      flangerRate: this.flangerRate
    };
  }

  public reset(): void {
    this.setEchoMix(0);
    this.setFlangerMix(0);
  }
}
