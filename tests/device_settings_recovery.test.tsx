import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AudioContextManager, AudioDeviceInfo } from '../src/renderer/audio/AudioContextManager';
import { KeyboardShortcutManager } from '../src/renderer/utils/KeyboardShortcutManager';
import { KeyboardShortcutsModal } from '../src/renderer/components/KeyboardShortcutsModal';
import { SettingsView } from '../src/renderer/views/SettingsView';

// Web Audio API Mocks
class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn((val: number) => { this.value = val; });
  setTargetAtTime = vi.fn((val: number) => { this.value = val; });
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowshelf';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  gain = new MockAudioParam();
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = new MockAudioNode();
  onstatechange: (() => void) | null = null;
  sinkId = 'default';

  createGain = () => new MockGainNode();
  createDynamicsCompressor = () => new MockCompressorNode();
  createBiquadFilter = () => new MockBiquadFilterNode();
  createAnalyser = () => new MockAnalyserNode();
  createOscillator = () => new MockOscillatorNode();

  resume = vi.fn(async () => {
    this.state = 'running';
    if (this.onstatechange) this.onstatechange();
  });

  close = vi.fn(async () => {
    this.state = 'closed';
    if (this.onstatechange) this.onstatechange();
  });

  setSinkId = vi.fn(async (id: string) => {
    this.sinkId = id;
  });
}

describe('Phase 13: Audio Device Management, Settings, Accessibility & Recovery', () => {
  let originalAudioContext: any;
  let originalMediaDevices: any;
  let mockDevices: MediaDeviceInfo[];
  let deviceChangeCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    originalAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = MockAudioContext;

    mockDevices = [
      {
        deviceId: 'default',
        groupId: 'grp-1',
        kind: 'audiooutput',
        label: 'Default Speakers (Realtek Audio)',
        toJSON: () => ({})
      } as MediaDeviceInfo,
      {
        deviceId: 'wasapi-dac-id',
        groupId: 'grp-2',
        kind: 'audiooutput',
        label: 'Focusrite Scarlett WASAPI Output',
        toJSON: () => ({})
      } as MediaDeviceInfo,
      {
        deviceId: 'mic-1',
        groupId: 'grp-3',
        kind: 'audioinput',
        label: 'Microphone Array',
        toJSON: () => ({})
      } as MediaDeviceInfo
    ];

    originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn(async () => mockDevices),
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === 'devicechange') {
            deviceChangeCallback = cb;
          }
        }),
        removeEventListener: vi.fn()
      },
      configurable: true,
      writable: true
    });

    (window as any).fluxoAPI = {
      getStemsCacheStats: vi.fn().mockResolvedValue({
        totalBytes: 52428800,
        trackCount: 5,
        formattedSize: '50.0 MB'
      }),
      getYouTubeCacheStats: vi.fn().mockResolvedValue({
        totalBytes: 104857600,
        trackCount: 12,
        formattedSize: '100.0 MB'
      }),
      clearStemsCache: vi.fn().mockResolvedValue({
        success: true,
        clearedBytes: 52428800
      }),
      clearYouTubeCache: vi.fn().mockResolvedValue({
        success: true,
        clearedBytes: 104857600
      })
    };
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
      writable: true
    });
  });

  // =========================================================================
  // P13-T001: Device Enumeration & Live Switching
  // =========================================================================
  describe('P13-T001: Audio Device Enumeration and Live Switch', () => {
    it('enumerates WASAPI output devices filtering out input devices', async () => {
      const manager = AudioContextManager.getInstance();
      const devices = await manager.getAudioOutputDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0].deviceId).toBe('default');
      expect(devices[0].label).toContain('Default Speakers');
      expect(devices[0].isDefault).toBe(true);
      expect(devices[1].deviceId).toBe('wasapi-dac-id');
      expect(devices[1].label).toContain('Focusrite Scarlett');
    });

    it('switches output device live via setAudioOutputDevice', async () => {
      const manager = AudioContextManager.getInstance();
      const success = await manager.setAudioOutputDevice('wasapi-dac-id');

      expect(success).toBe(true);
      expect(manager.getCurrentDeviceId()).toBe('wasapi-dac-id');
    });

    it('triggers registered callback on hardware devicechange event', async () => {
      const manager = AudioContextManager.getInstance();
      const onDeviceChangeMock = vi.fn();
      const unsub = manager.onDeviceChange(onDeviceChangeMock);

      // Simulate devicechange event from OS/hardware
      if (deviceChangeCallback) {
        await deviceChangeCallback();
      }

      expect(onDeviceChangeMock).toHaveBeenCalled();
      unsub();
    });
  });

  // =========================================================================
  // P13-T002: Audio Buffer Tuning & Calculated Latency
  // =========================================================================
  describe('P13-T002: Audio Settings Panel & Buffer Tuning', () => {
    it('configures buffer size and computes accurate round-trip latency', () => {
      const manager = AudioContextManager.getInstance();

      // Formula: (bufferSize / sampleRate) * 1000
      manager.setBufferSize(128);
      expect(manager.bufferSize).toBe(128);
      // 128 / 44100 * 1000 = 2.9 ms
      expect(manager.getCalculatedLatencyMs()).toBe(2.9);

      manager.setBufferSize(256);
      expect(manager.bufferSize).toBe(256);
      // 256 / 44100 * 1000 = 5.8 ms
      expect(manager.getCalculatedLatencyMs()).toBe(5.8);

      manager.setBufferSize(512);
      expect(manager.bufferSize).toBe(512);
      // 512 / 44100 * 1000 = 11.6 ms
      expect(manager.getCalculatedLatencyMs()).toBe(11.6);

      manager.setBufferSize(1024);
      expect(manager.bufferSize).toBe(1024);
      // 1024 / 44100 * 1000 = 23.2 ms
      expect(manager.getCalculatedLatencyMs()).toBe(23.2);
    });

    it('defaults invalid buffer sizes safely to 512', () => {
      const manager = AudioContextManager.getInstance();
      manager.setBufferSize(999);
      expect(manager.bufferSize).toBe(512);
    });
  });

  // =========================================================================
  // P13-T003: Audio Graph Auto-Reconnection & Crash Recovery
  // =========================================================================
  describe('P13-T003: Audio Graph Auto-Recovery (< 500ms)', () => {
    it('recovers from context suspension automatically within < 500ms', async () => {
      vi.useFakeTimers();
      const manager = AudioContextManager.getInstance();
      const ctx = manager.getContext() as unknown as MockAudioContext;

      const recoveryEvents: string[] = [];
      manager.onRecoveryEvent((event) => {
        recoveryEvents.push(event);
      });

      // Simulate hardware buffer underrun or device disconnect causing suspended state
      ctx.state = 'suspended';
      if (ctx.onstatechange) {
        ctx.onstatechange();
      }

      expect(recoveryEvents).toContain('suspended');

      // Fast-forward by 160ms (well under 500ms requirement)
      await vi.advanceTimersByTimeAsync(160);

      expect(ctx.resume).toHaveBeenCalled();
      expect(ctx.state).toBe('running');
      expect(recoveryEvents).toContain('recovered');

      vi.useRealTimers();
    });

    it('reconnects audio graph completely on manual trigger', async () => {
      const manager = AudioContextManager.getInstance();
      const reconnected = await manager.reconnectAudioGraph();

      expect(reconnected).toBe(true);
      expect(manager.state).toBe('running');
    });
  });

  // =========================================================================
  // P13-T004: Global Keyboard Shortcuts & Accessibility Focus
  // =========================================================================
  describe('P13-T004: Keyboard Shortcuts & Accessibility', () => {
    it('dispatches hotkey actions for playback, transitions, cues, and navigation', () => {
      const actions = {
        onPlayPause: vi.fn(),
        onTriggerTransition: vi.fn(),
        onNudgeDeck: vi.fn(),
        onJumpCue: vi.fn(),
        onToggleLoop: vi.fn(),
        onToggleMute: vi.fn(),
        onSwitchActiveDeck: vi.fn(),
        onToggleHelp: vi.fn()
      };

      const manager = new KeyboardShortcutManager(actions);
      manager.attach();

      // 1. Space -> Play/Pause
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      expect(actions.onPlayPause).toHaveBeenCalledTimes(1);

      // 2. Shift + ArrowRight -> Trigger immediate transition
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }));
      expect(actions.onTriggerTransition).toHaveBeenCalledTimes(1);

      // 3. Shift + ArrowLeft / ArrowUp -> Pitch nudge
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }));
      expect(actions.onNudgeDeck).toHaveBeenCalledWith('down');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
      expect(actions.onNudgeDeck).toHaveBeenCalledWith('up');

      // 4. Hot Cues (1 to 8) -> jumpCue(idx)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
      expect(actions.onJumpCue).toHaveBeenCalledWith(2);

      // 5. 'L' -> Loop
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
      expect(actions.onToggleLoop).toHaveBeenCalledTimes(1);

      // 6. 'M' -> Mute
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
      expect(actions.onToggleMute).toHaveBeenCalledTimes(1);

      // 7. 'S' -> Switch active deck
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      expect(actions.onSwitchActiveDeck).toHaveBeenCalledTimes(1);

      // 8. '?' -> Cheatsheet modal
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      expect(actions.onToggleHelp).toHaveBeenCalledTimes(1);

      manager.detach();
    });

    it('ignores shortcut triggers when active element is an input or textarea', () => {
      const onPlayPause = vi.fn();
      const manager = new KeyboardShortcutManager({ onPlayPause });
      manager.attach();

      const input = document.createElement('input');
      document.body.appendChild(input);

      // Fire Space with input as target
      const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
      input.dispatchEvent(event);

      expect(onPlayPause).not.toHaveBeenCalled();
      document.body.removeChild(input);
      manager.detach();
    });

    it('renders KeyboardShortcutsModal with all shortcut definitions', () => {
      const handleClose = vi.fn();
      render(<KeyboardShortcutsModal isOpen={true} onClose={handleClose} />);

      expect(screen.getByTestId('shortcuts-modal')).toBeDefined();
      expect(screen.getByText('Keyboard Shortcuts & Hotkeys')).toBeDefined();
      expect(screen.getByText('Play / Pause active virtual deck')).toBeDefined();
      expect(screen.getByText('Space')).toBeDefined();
      expect(screen.getByText('Shift + →')).toBeDefined();

      // Click Close
      const gotItBtn = screen.getByText('Got it');
      fireEvent.click(gotItBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // P13-T005: SettingsView UI & Cache Management
  // =========================================================================
  describe('P13-T005: Settings Panel and Cache Management', () => {
    it('renders device selector, buffer sizes, and calculated latency in SettingsView', async () => {
      render(
        <SettingsView
          platformInfo={{
            platform: 'win32',
            version: '10.0.22631',
            ffmpegAvailable: true,
            pythonAvailable: true
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-view')).toBeDefined();
      });

      expect(screen.getByText(/Audio Output Device & Buffer Tuning/i)).toBeDefined();
      expect(screen.getByTestId('audio-device-select')).toBeDefined();

      // Buffer size buttons
      expect(screen.getByTestId('buffer-btn-128')).toBeDefined();
      expect(screen.getByTestId('buffer-btn-256')).toBeDefined();
      expect(screen.getByTestId('buffer-btn-512')).toBeDefined();
      expect(screen.getByTestId('buffer-btn-1024')).toBeDefined();

      // Click buffer 256
      fireEvent.click(screen.getByTestId('buffer-btn-256'));
      expect(screen.getByText(/Hardware Latency: ~5.8 ms/i)).toBeDefined();
    });

    it('plays audio test chirp and triggers graph reconnection', async () => {
      render(<SettingsView />);

      const chirpBtn = screen.getByTestId('test-chirp-btn');
      fireEvent.click(chirpBtn);

      await waitFor(() => {
        expect(screen.getByText(/Played audio test chirp/i)).toBeDefined();
      });

      const reconnectBtn = screen.getByTestId('reconnect-graph-btn');
      fireEvent.click(reconnectBtn);

      await waitFor(() => {
        expect(screen.getByText(/Audio graph successfully reconnected/i)).toBeDefined();
      });
    });

    it('displays cache statistics and handles purge actions', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText(/50.0 MB/i)).toBeDefined();
        expect(screen.getByText(/100.0 MB/i)).toBeDefined();
      });

      const clearStemsBtn = screen.getByTestId('clear-stems-btn');
      fireEvent.click(clearStemsBtn);
      expect((window as any).fluxoAPI.clearStemsCache).toHaveBeenCalled();

      const clearYoutubeBtn = screen.getByTestId('clear-youtube-btn');
      fireEvent.click(clearYoutubeBtn);
      expect((window as any).fluxoAPI.clearYouTubeCache).toHaveBeenCalled();

      const purgeAllBtn = screen.getByTestId('purge-all-caches-btn');
      fireEvent.click(purgeAllBtn);

      await waitFor(() => {
        expect((window as any).fluxoAPI.clearStemsCache).toHaveBeenCalledTimes(2);
        expect((window as any).fluxoAPI.clearYouTubeCache).toHaveBeenCalledTimes(2);
      });
    });
  });
});
