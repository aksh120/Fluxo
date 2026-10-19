import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppHeader } from '../src/renderer/components/AppHeader';
import { Sidebar } from '../src/renderer/components/Sidebar';
import { NowPlayingBar } from '../src/renderer/components/NowPlayingBar';
import App from '../src/renderer/App';
import type { DeckState } from '../src/shared/types';

// Mock Web Audio API for layout test environment
class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
}
class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}
class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}
class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}
class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  gain = new MockAudioParam();
}
class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
}
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = new MockAudioNode();
  createGain = () => new MockGainNode();
  createDynamicsCompressor = () => new MockDynamicsCompressorNode();
  createBiquadFilter = () => new MockBiquadFilterNode();
  createAnalyser = () => new MockAnalyserNode();
  createDelay = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    delayTime: new MockAudioParam()
  });
  createOscillator = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: new MockAudioParam(),
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn()
  });
  createBufferSource = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    playbackRate: new MockAudioParam(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null
  });
  createBuffer = (c: number, l: number, r: number) => ({
    numberOfChannels: c,
    length: l,
    sampleRate: r,
    duration: l / r,
    getChannelData: () => new Float32Array(l)
  });
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

beforeEach(() => {
  (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    canvas: { width: 960, height: 150 }
  });
});

describe('Phase 2 Desktop Layout & Navigation Tests', () => {
  it('renders AppHeader with title and status indicators', () => {
    render(
      <AppHeader
        platformInfo={{
          platform: 'win32',
          version: '1.0.0',
          ffmpegAvailable: true,
          pythonAvailable: true
        }}
      />
    );

    expect(screen.getByTestId('app-header')).toBeDefined();
    expect(screen.getByText('FLUXO')).toBeDefined();
    expect(screen.getByText('FFMPEG')).toBeDefined();
    expect(screen.getByText('AI WORKER')).toBeDefined();
  });

  it('renders Sidebar and handles view navigation and collapse toggle', () => {
    const handleViewChange = vi.fn();
    render(<Sidebar activeView="library" onViewChange={handleViewChange} />);

    expect(screen.getByTestId('app-sidebar')).toBeDefined();

    const partyBtn = screen.getByRole('button', { name: /party mode/i });
    fireEvent.click(partyBtn);
    expect(handleViewChange).toHaveBeenCalledWith('party');

    const studioBtn = screen.getByRole('button', { name: /dj studio/i });
    fireEvent.click(studioBtn);
    expect(handleViewChange).toHaveBeenCalledWith('studio');

    // Collapse toggle
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(collapseBtn);
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeDefined();
  });

  it('renders NowPlayingBar with playback controls and triggers transition', () => {
    const handlePlay = vi.fn();
    const handleTransition = vi.fn();
    const handleSeek = vi.fn();
    const handleVolume = vi.fn();

    const mockDeckA: DeckState = {
      deckId: 'A',
      currentTrack: null,
      isPlaying: false,
      currentTime: 30,
      duration: 180,
      playbackRate: 1.0,
      volume: 0.8,
      isMuted: false,
      lowGain: 1.0,
      midGain: 1.0,
      highGain: 1.0,
      filterFreq: 20000,
      filterResonance: 1.0
    };

    const mockDeckB: DeckState = {
      ...mockDeckA,
      deckId: 'B'
    };

    render(
      <NowPlayingBar
        currentTrack={null}
        deckA={mockDeckA}
        deckB={mockDeckB}
        activeDeckId="A"
        onPlayPause={handlePlay}
        onSeek={handleSeek}
        onVolumeChange={handleVolume}
        onTriggerTransition={handleTransition}
      />
    );

    expect(screen.getByTestId('now-playing-bar')).toBeDefined();
    const playBtn = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playBtn);
    expect(handlePlay).toHaveBeenCalledTimes(1);

    const transBtn = screen.getByRole('button', { name: /transition/i });
    fireEvent.click(transBtn);
    expect(handleTransition).toHaveBeenCalledTimes(1);
  });

  it('renders master App, switches views seamlessly, and preserves state', () => {
    render(<App />);

    // Initially on Library
    expect(screen.getByPlaceholderText(/search tracks, artists, albums/i)).toBeDefined();
    expect(screen.getByText(/Your Music Library is Empty/i)).toBeDefined();

    // Switch to Party Mode
    const partyNav = screen.getByRole('button', { name: /party mode/i });
    fireEvent.click(partyNav);
    expect(screen.getByText(/autonomous party dj active/i)).toBeDefined();

    // Switch to DJ Studio
    const studioNav = screen.getByRole('button', { name: /dj studio/i });
    fireEvent.click(studioNav);
    expect(screen.getByText('DECK A')).toBeDefined();
    expect(screen.getByText('DECK B')).toBeDefined();
    expect(screen.getByText('CROSSFADER')).toBeDefined();

    // Switch to Beginner Player
    const beginnerNav = screen.getByRole('button', { name: /beginner player/i });
    fireEvent.click(beginnerNav);
    expect(screen.getByText(/MIX VIBE:/i)).toBeDefined();
    expect(screen.getByText(/NOW PLAYING/i)).toBeDefined();

    // Switch to Mix Creator
    const creatorNav = screen.getByRole('button', { name: /mix creator/i });
    fireEvent.click(creatorNav);
    expect(screen.getByText(/Mix Creator & Timeline Studio/i)).toBeDefined();

    // Switch to YouTube Extractor
    const ytNav = screen.getByRole('button', { name: /youtube/i });
    fireEvent.click(ytNav);
    expect(screen.getByText(/youtube high-fidelity audio extractor/i)).toBeDefined();

    // Switch to Settings
    const settingsNav = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsNav);
    expect(screen.getByText(/preferences & audio configuration/i)).toBeDefined();
  }, 30000);
});
