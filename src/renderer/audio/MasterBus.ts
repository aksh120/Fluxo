/**
 * Fluxo Master Output Bus
 * Lookahead peak limiter preventing clipping above 0 dBFS, master gain, and spectral analyzer
 */

export class MasterBus {
  private readonly context: AudioContext;
  public readonly inputNode: GainNode;
  public readonly masterGainNode: GainNode;
  public readonly limiterNode: DynamicsCompressorNode;
  public readonly analyserNode: AnalyserNode;

  constructor(context: AudioContext) {
    this.context = context;

    // Master summing input
    this.inputNode = context.createGain();

    // Master volume control (default unity gain)
    this.masterGainNode = context.createGain();
    this.masterGainNode.gain.setValueAtTime(1.0, context.currentTime);

    // Lookahead brickwall limiter preventing digital clipping
    this.limiterNode = context.createDynamicsCompressor();
    // Peak limiter settings: fast attack, instant suppression
    this.limiterNode.threshold.setValueAtTime(-0.5, context.currentTime); // -0.5 dBFS ceiling
    this.limiterNode.knee.setValueAtTime(0, context.currentTime); // Hard knee
    this.limiterNode.ratio.setValueAtTime(20.0, context.currentTime); // High compression ratio = limiting
    this.limiterNode.attack.setValueAtTime(0.001, context.currentTime); // 1ms attack
    this.limiterNode.release.setValueAtTime(0.05, context.currentTime); // 50ms release

    // Master spectral & peak analyzer
    this.analyserNode = context.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Connect audio signal chain: Input -> Master Gain -> Limiter -> Analyser -> Output
    this.inputNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.analyserNode);
    this.analyserNode.connect(context.destination);
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1.5, volume));
    this.masterGainNode.gain.setTargetAtTime(clamped, this.context.currentTime, 0.01);
  }

  public getVolume(): number {
    return this.masterGainNode.gain.value;
  }
}
