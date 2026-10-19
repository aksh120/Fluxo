/**
 * AudioContextManager
 * High-precision hardware clock synchronization, WASAPI audio device enumeration,
 * buffer tuning, auto-reconnection, and crash recovery.
 */
import { MasterBus } from './MasterBus';

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export type AudioRecoveryEvent = 'recovered' | 'reconnected' | 'suspended' | 'interrupted';

export class AudioContextManager {
  private static instance: AudioContextManager | null = null;
  private context: AudioContext | null = null;
  private masterBus: MasterBus | null = null;

  // Device & Buffer settings
  private currentDeviceId = 'default';
  private _bufferSize = 512;
  private deviceChangeListeners: Set<(devices: AudioDeviceInfo[]) => void> = new Set();
  private recoveryListeners: Set<(event: AudioRecoveryEvent) => void> = new Set();
  private isAutoRecovering = false;
  private isReconnecting = false;

  private constructor() {
    this.setupHardwareDeviceListener();
  }

  public static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  public getContext(): AudioContext {
    if (!this.context) {
      const AudioCtxClass =
        (typeof window !== 'undefined' && window.AudioContext) ||
        (typeof window !== 'undefined' && (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);

      if (!AudioCtxClass) {
        throw new Error('Web Audio API (AudioContext) is not supported in this environment');
      }

      this.context = new AudioCtxClass({
        latencyHint: 'interactive',
        sampleRate: 44100
      });

      this.masterBus = new MasterBus(this.context);
      this.attachStateChangeListener(this.context);
    }

    if (this.context.state === 'suspended') {
      this.context.resume().catch((err) => {
        console.warn('AudioContext resume deferred until user interaction:', err);
      });
    }

    return this.context;
  }

  public getMasterBus(): MasterBus {
    if (!this.masterBus) {
      this.getContext(); // Ensures initialization
    }
    return this.masterBus!;
  }

  public get currentTime(): number {
    return this.context ? this.context.currentTime : 0;
  }

  public get sampleRate(): number {
    return this.context ? this.context.sampleRate : 44100;
  }

  public get state(): AudioContextState {
    return this.context ? this.context.state : 'suspended';
  }

  public get bufferSize(): number {
    return this._bufferSize;
  }

  public setBufferSize(size: number): void {
    const validSizes = [128, 256, 512, 1024];
    this._bufferSize = validSizes.includes(size) ? size : 512;
  }

  public getCalculatedLatencyMs(): number {
    const rate = this.sampleRate || 44100;
    return Math.round(((this._bufferSize / rate) * 1000) * 10) / 10;
  }

  public async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  public async close(): Promise<void> {
    if (this.context) {
      this.context.onstatechange = null;
      await this.context.close();
      this.context = null;
      this.masterBus = null;
    }
  }

  // ==========================================
  // P13-T001: Audio Device Enumeration & Live Switching
  // ==========================================

  public async getAudioOutputDevices(): Promise<AudioDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [
        { deviceId: 'default', label: 'Default Audio Output (Speakers / Headphones)', isDefault: true }
      ];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d, idx) => ({
          deviceId: d.deviceId || `device-${idx}`,
          label: d.label || (d.deviceId === 'default' ? 'Default Audio Output' : `WASAPI Output ${idx + 1}`),
          isDefault: d.deviceId === 'default' || idx === 0
        }));

      if (audioOutputs.length === 0) {
        return [
          { deviceId: 'default', label: 'Default Audio Output (Speakers / Headphones)', isDefault: true }
        ];
      }

      return audioOutputs;
    } catch (err) {
      console.warn('Failed to enumerate audio devices:', err);
      return [
        { deviceId: 'default', label: 'Default Audio Output (Speakers / Headphones)', isDefault: true }
      ];
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    this.currentDeviceId = deviceId;
    const ctx = this.getContext() as any;

    if (typeof ctx.setSinkId === 'function') {
      try {
        await ctx.setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('setSinkId failed, falling back to default device routing:', err);
        return false;
      }
    }
    return true;
  }

  public getCurrentDeviceId(): string {
    return this.currentDeviceId;
  }

  public onDeviceChange(callback: (devices: AudioDeviceInfo[]) => void): () => void {
    this.deviceChangeListeners.add(callback);
    return () => this.deviceChangeListeners.delete(callback);
  }

  private setupHardwareDeviceListener(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener?.('devicechange', async () => {
        const devices = await this.getAudioOutputDevices();
        this.deviceChangeListeners.forEach((cb) => cb(devices));
        // Verify current device still exists; if not, fall back to default cleanly
        const exists = devices.some((d) => d.deviceId === this.currentDeviceId);
        if (!exists && this.currentDeviceId !== 'default') {
          await this.setAudioOutputDevice('default');
          this.notifyRecovery('reconnected');
        }
      });
    }
  }

  // ==========================================
  // P13-T003: Auto-Reconnection & Crash Recovery System
  // ==========================================

  public onRecoveryEvent(callback: (event: AudioRecoveryEvent) => void): () => void {
    this.recoveryListeners.add(callback);
    return () => this.recoveryListeners.delete(callback);
  }

  private notifyRecovery(event: AudioRecoveryEvent): void {
    this.recoveryListeners.forEach((cb) => cb(event));
  }

  private attachStateChangeListener(ctx: AudioContext): void {
    ctx.onstatechange = async () => {
      if (ctx.state === 'suspended' && !this.isAutoRecovering) {
        this.notifyRecovery('suspended');
        // Auto-recover within < 500ms
        this.recoverWithin500ms();
      } else if (ctx.state === 'closed') {
        if (this.context === ctx && !this.isReconnecting) {
          this.notifyRecovery('interrupted');
          this.reconnectAudioGraph();
        }
      }
    };
  }

  private recoverWithin500ms(): void {
    if (this.isAutoRecovering) return;
    this.isAutoRecovering = true;

    setTimeout(async () => {
      try {
        if (this.context && this.context.state === 'suspended') {
          await this.context.resume();
          this.notifyRecovery('recovered');
        }
      } catch (err) {
        console.warn('Recovery attempt deferred:', err);
      } finally {
        this.isAutoRecovering = false;
      }
    }, 150); // Well under 500ms limit
  }

  public async reconnectAudioGraph(): Promise<boolean> {
    if (this.isReconnecting) return true;
    this.isReconnecting = true;

    const AudioCtxClass =
      (typeof window !== 'undefined' && window.AudioContext) ||
      (typeof window !== 'undefined' && (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);

    if (!AudioCtxClass) {
      this.isReconnecting = false;
      return false;
    }

    try {
      if (this.context) {
        try {
          this.context.onstatechange = null;
          await this.context.close();
        } catch {}
      }

      this.context = new AudioCtxClass({
        latencyHint: 'interactive',
        sampleRate: 44100
      });

      this.masterBus = new MasterBus(this.context);
      this.attachStateChangeListener(this.context);

      if (this.currentDeviceId !== 'default') {
        await this.setAudioOutputDevice(this.currentDeviceId);
      }

      this.notifyRecovery('reconnected');
      return true;
    } catch (err) {
      console.error('Audio graph reconnection failed:', err);
      return false;
    } finally {
      this.isReconnecting = false;
    }
  }
}
