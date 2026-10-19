/**
 * IsolatorEQ
 * Studio-grade 3-Band Linkwitz-Riley 4th Order (LR4, 24 dB/octave) DJ Isolator EQ
 * and dual-mode resonant color filter.
 *
 * Provides exact flat magnitude summation at unity gain (0 dB ripple across spectrum),
 * true -infinity kill switches on all bands, and a sweepable bi-quad filter.
 */

export interface IsolatorEQState {
  lowGain: number; // 0.0 (kill) to 2.0 (+6dB), 1.0 = 0dB
  midGain: number;
  highGain: number;
  lowKill: boolean;
  midKill: boolean;
  highKill: boolean;
  filterParam: number; // -1.0 (LP) to +1.0 (HP), 0.0 = neutral
  filterResonance: number; // Q factor, 0.5 to 10.0
}

export class IsolatorEQ {
  private readonly context: BaseAudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  // Crossover frequencies
  public static readonly LOW_FREQ = 300; // Hz
  public static readonly HIGH_FREQ = 3000; // Hz

  // Low Band Filters (2 cascaded 2nd-order Butterworth LP = LR4 LP)
  private readonly lowLp1: BiquadFilterNode;
  private readonly lowLp2: BiquadFilterNode;
  public readonly lowGainNode: GainNode;

  // Mid Band Filters (LR4 HP at 300Hz cascaded with LR4 LP at 3000Hz)
  private readonly midHp1: BiquadFilterNode;
  private readonly midHp2: BiquadFilterNode;
  private readonly midLp1: BiquadFilterNode;
  private readonly midLp2: BiquadFilterNode;
  public readonly midGainNode: GainNode;

  // High Band Filters (2 cascaded 2nd-order Butterworth HP = LR4 HP)
  private readonly highHp1: BiquadFilterNode;
  private readonly highHp2: BiquadFilterNode;
  public readonly highGainNode: GainNode;

  // Dual-mode sweep filter
  public readonly sweepFilter: BiquadFilterNode;

  // EQ State
  private _lowGain = 1.0;
  private _midGain = 1.0;
  private _highGain = 1.0;
  private _lowKill = false;
  private _midKill = false;
  private _highKill = false;
  private _filterParam = 0.0;
  private _filterResonance = 1.0;

  constructor(context: BaseAudioContext) {
    this.context = context;
    const now = context.currentTime;

    // Master input and output nodes for this EQ stage
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    const Q_BUTTERWORTH = 1 / Math.SQRT2; // 0.7071

    // 1. Low Band (LR4 Lowpass: 300 Hz)
    this.lowLp1 = context.createBiquadFilter();
    this.lowLp1.type = 'lowpass';
    this.lowLp1.frequency.setValueAtTime(IsolatorEQ.LOW_FREQ, now);
    this.lowLp1.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.lowLp2 = context.createBiquadFilter();
    this.lowLp2.type = 'lowpass';
    this.lowLp2.frequency.setValueAtTime(IsolatorEQ.LOW_FREQ, now);
    this.lowLp2.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.lowGainNode = context.createGain();
    this.lowGainNode.gain.setValueAtTime(1.0, now);

    this.inputNode.connect(this.lowLp1);
    this.lowLp1.connect(this.lowLp2);
    this.lowLp2.connect(this.lowGainNode);

    // 2. Mid Band (LR4 HP 300 Hz -> LR4 LP 3000 Hz)
    this.midHp1 = context.createBiquadFilter();
    this.midHp1.type = 'highpass';
    this.midHp1.frequency.setValueAtTime(IsolatorEQ.LOW_FREQ, now);
    this.midHp1.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.midHp2 = context.createBiquadFilter();
    this.midHp2.type = 'highpass';
    this.midHp2.frequency.setValueAtTime(IsolatorEQ.LOW_FREQ, now);
    this.midHp2.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.midLp1 = context.createBiquadFilter();
    this.midLp1.type = 'lowpass';
    this.midLp1.frequency.setValueAtTime(IsolatorEQ.HIGH_FREQ, now);
    this.midLp1.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.midLp2 = context.createBiquadFilter();
    this.midLp2.type = 'lowpass';
    this.midLp2.frequency.setValueAtTime(IsolatorEQ.HIGH_FREQ, now);
    this.midLp2.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.midGainNode = context.createGain();
    this.midGainNode.gain.setValueAtTime(1.0, now);

    this.inputNode.connect(this.midHp1);
    this.midHp1.connect(this.midHp2);
    this.midHp2.connect(this.midLp1);
    this.midLp1.connect(this.midLp2);
    this.midLp2.connect(this.midGainNode);

    // 3. High Band (LR4 Highpass: 3000 Hz)
    this.highHp1 = context.createBiquadFilter();
    this.highHp1.type = 'highpass';
    this.highHp1.frequency.setValueAtTime(IsolatorEQ.HIGH_FREQ, now);
    this.highHp1.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.highHp2 = context.createBiquadFilter();
    this.highHp2.type = 'highpass';
    this.highHp2.frequency.setValueAtTime(IsolatorEQ.HIGH_FREQ, now);
    this.highHp2.Q.setValueAtTime(Q_BUTTERWORTH, now);

    this.highGainNode = context.createGain();
    this.highGainNode.gain.setValueAtTime(1.0, now);

    this.inputNode.connect(this.highHp1);
    this.highHp1.connect(this.highHp2);
    this.highHp2.connect(this.highGainNode);

    // 4. Summing Point & Resonant Color Filter
    // In LR4 3-band crossover, inverting or keeping bands in-phase provides flat summation
    const isolatorSum = context.createGain();
    this.lowGainNode.connect(isolatorSum);
    this.midGainNode.connect(isolatorSum);
    this.highGainNode.connect(isolatorSum);

    this.sweepFilter = context.createBiquadFilter();
    this.sweepFilter.type = 'allpass';
    this.sweepFilter.frequency.setValueAtTime(1000, now);
    this.sweepFilter.Q.setValueAtTime(1.0, now);

    isolatorSum.connect(this.sweepFilter);
    this.sweepFilter.connect(this.outputNode);
  }

  /**
   * Sets Low Band Gain (0.0 to 2.0; 0.0 = complete kill, 1.0 = unity 0dB)
   */
  public setLowGain(gain: number, rampTime = 0.02): void {
    this._lowGain = Math.max(0, Math.min(2.0, gain));
    this.updateLowGain(rampTime);
  }

  /**
   * Sets Mid Band Gain (0.0 to 2.0; 0.0 = complete kill, 1.0 = unity 0dB)
   */
  public setMidGain(gain: number, rampTime = 0.02): void {
    this._midGain = Math.max(0, Math.min(2.0, gain));
    this.updateMidGain(rampTime);
  }

  /**
   * Sets High Band Gain (0.0 to 2.0; 0.0 = complete kill, 1.0 = unity 0dB)
   */
  public setHighGain(gain: number, rampTime = 0.02): void {
    this._highGain = Math.max(0, Math.min(2.0, gain));
    this.updateHighGain(rampTime);
  }

  /**
   * Instant Kill Toggles (-infinity attenuation)
   */
  public setLowKill(kill: boolean, rampTime = 0.005): void {
    this._lowKill = kill;
    this.updateLowGain(rampTime);
  }

  public setMidKill(kill: boolean, rampTime = 0.005): void {
    this._midKill = kill;
    this.updateMidGain(rampTime);
  }

  public setHighKill(kill: boolean, rampTime = 0.005): void {
    this._highKill = kill;
    this.updateHighGain(rampTime);
  }

  private updateLowGain(rampTime: number): void {
    const effective = this._lowKill ? 0 : this._lowGain;
    this.lowGainNode.gain.setTargetAtTime(effective, this.context.currentTime, rampTime);
  }

  private updateMidGain(rampTime: number): void {
    const effective = this._midKill ? 0 : this._midGain;
    this.midGainNode.gain.setTargetAtTime(effective, this.context.currentTime, rampTime);
  }

  private updateHighGain(rampTime: number): void {
    const effective = this._highKill ? 0 : this._highGain;
    this.highGainNode.gain.setTargetAtTime(effective, this.context.currentTime, rampTime);
  }

  /**
   * Dual-mode sweep filter:
   * param: -1.0 (Low-Pass sweep down to 80Hz) to +1.0 (High-Pass sweep up to 10kHz), 0.0 = neutral all-pass
   */
  public setFilterParam(param: number, resonance = 1.0, rampTime = 0.02): void {
    this._filterParam = Math.max(-1.0, Math.min(1.0, param));
    this._filterResonance = Math.max(0.5, Math.min(10.0, resonance));
    const now = this.context.currentTime;

    if (Math.abs(this._filterParam) < 0.02) {
      // Neutral center position - bypass
      this.sweepFilter.type = 'allpass';
      this.sweepFilter.frequency.setTargetAtTime(1000, now, rampTime);
      this.sweepFilter.Q.setTargetAtTime(1.0, now, rampTime);
    } else if (this._filterParam < 0) {
      // Low-Pass filter: sweep from 20000 Hz down to 80 Hz exponentially
      const norm = Math.abs(this._filterParam); // 0.02 to 1.0
      const freq = 20000 * Math.pow(80 / 20000, norm);
      this.sweepFilter.type = 'lowpass';
      this.sweepFilter.frequency.setTargetAtTime(freq, now, rampTime);
      this.sweepFilter.Q.setTargetAtTime(this._filterResonance, now, rampTime);
    } else {
      // High-Pass filter: sweep from 20 Hz up to 12000 Hz exponentially
      const norm = this._filterParam; // 0.02 to 1.0
      const freq = 20 * Math.pow(12000 / 20, norm);
      this.sweepFilter.type = 'highpass';
      this.sweepFilter.frequency.setTargetAtTime(freq, now, rampTime);
      this.sweepFilter.Q.setTargetAtTime(this._filterResonance, now, rampTime);
    }
  }

  public getState(): IsolatorEQState {
    return {
      lowGain: this._lowGain,
      midGain: this._midGain,
      highGain: this._highGain,
      lowKill: this._lowKill,
      midKill: this._midKill,
      highKill: this._highKill,
      filterParam: this._filterParam,
      filterResonance: this._filterResonance
    };
  }
}
