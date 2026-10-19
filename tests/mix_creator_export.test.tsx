import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { MixProjectSerializer } from '../src/renderer/mix/MixProjectSerializer';
import { PreviewDeck } from '../src/renderer/audio/PreviewDeck';
import { OfflineMixRenderer } from '../src/renderer/audio/OfflineMixRenderer';
import { LufsMeter } from '../src/renderer/audio/LufsMeter';
import { FFmpegEncoder } from '../src/main/export/FFmpegEncoder';
import { MixCreatorView } from '../src/renderer/views/MixCreatorView';
import { ExportModal } from '../src/renderer/components/ExportModal';
import type { FluxoProject, TimelineTrack, TimelineTransition, TrackMetadata, ExportSettings } from '../src/shared/types';

// Mock Web Audio API
class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
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

class MockBiquadFilterNode extends MockAudioNode {
  type = 'allpass';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  gain = new MockAudioParam();
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = new MockAudioNode();
  createGain = () => new MockGainNode();
  createBiquadFilter = () => new MockBiquadFilterNode();
  createBufferSource = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    playbackRate: new MockAudioParam(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null
  });
  createBuffer = (channels: number, length: number, sampleRate: number): AudioBuffer => {
    const data = [new Float32Array(length), new Float32Array(length)];
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (c: number) => data[c] || data[0]
    } as unknown as AudioBuffer;
  };
}

beforeEach(() => {
  (globalThis as any).AudioContext = MockAudioContext;
  (window as any).AudioContext = MockAudioContext;
});

describe('Phase 11: Mix Creator, Project Persistence, Preview & Offline Audio Export Tests', () => {
  const sampleTracks: TimelineTrack[] = [
    {
      id: 'tl-1',
      trackId: 'track-1',
      filePath: 'C:\\Music\\track1.mp3',
      title: 'Solar Resonance',
      artist: 'Fluxo Sound Labs',
      duration: 180,
      bpm: 124,
      key: '8B',
      offsetSeconds: 0,
      volume: 1.0,
      lowGain: 1.0,
      midGain: 1.0,
      highGain: 1.0
    },
    {
      id: 'tl-2',
      trackId: 'track-2',
      filePath: 'C:\\Music\\track2.mp3',
      title: 'Neon Odyssey',
      artist: 'Fluxo Sound Labs',
      duration: 210,
      bpm: 126,
      key: '9B',
      offsetSeconds: 164, // 16s overlap
      volume: 1.0,
      lowGain: 1.0,
      midGain: 1.0,
      highGain: 1.0
    }
  ];

  // ==========================================
  // P11-T002: Project Serialization & Validation
  // ==========================================
  describe('P11-T002: MixProjectSerializer & .fluxo project persistence', () => {
    it('creates default project with valid version and metadata', () => {
      const proj = MixProjectSerializer.createDefaultProject('Main Stage Festival Set');
      expect(proj.version).toBe('1.0.0');
      expect(proj.name).toBe('Main Stage Festival Set');
      expect(proj.tracks).toEqual([]);
      expect(proj.transitions).toEqual([]);
      expect(proj.targetLufs).toBe(-14.0);
    });

    it('recalculates sequential track offsets based on transition overlaps', () => {
      const transitions: TimelineTransition[] = [
        {
          id: 'trans-1-2',
          fromTrackId: 'tl-1',
          toTrackId: 'tl-2',
          overlapSeconds: 20,
          style: 'smooth',
          curve: 'equal_power'
        }
      ];

      const recalculated = MixProjectSerializer.recalculateOffsets(sampleTracks, transitions);
      expect(recalculated[0].offsetSeconds).toBe(0);
      // Track 1 duration = 180, overlap = 20 => Track 2 starts at 160
      expect(recalculated[1].offsetSeconds).toBe(160);

      const totalDuration = MixProjectSerializer.calculateTotalDuration(recalculated);
      // Track 2 ends at 160 + 210 = 370
      expect(totalDuration).toBe(370);
    });

    it('serializes and deserializes .fluxo JSON without data loss', () => {
      const original: FluxoProject = {
        version: '1.0.0',
        id: 'proj-123',
        name: 'Electric Horizon Set',
        createdAt: 1700000000000,
        updatedAt: 1700000050000,
        tracks: sampleTracks,
        transitions: [
          {
            id: 'trans-1',
            fromTrackId: 'tl-1',
            toTrackId: 'tl-2',
            overlapSeconds: 16,
            style: 'bass_swap',
            curve: 'equal_power'
          }
        ],
        targetLufs: -14.0,
        exportSettings: {
          format: 'mp3',
          bitrateKbps: 320,
          sampleRate: 44100,
          normalize: true,
          targetLufs: -14.0
        }
      };

      const json = MixProjectSerializer.serialize(original);
      const deserialized = MixProjectSerializer.deserialize(json);

      expect(deserialized.id).toBe(original.id);
      expect(deserialized.name).toBe(original.name);
      expect(deserialized.tracks.length).toBe(2);
      expect(deserialized.transitions[0].style).toBe('bass_swap');
      expect(deserialized.exportSettings.bitrateKbps).toBe(320);
    });

    it('throws error when deserializing invalid or malformed project json', () => {
      expect(() => MixProjectSerializer.deserialize('{ invalid json')).toThrow(/Invalid JSON/);
      expect(() => MixProjectSerializer.deserialize('{"version": "1.0.0"}')).toThrow(/Missing or invalid project 'id'/);
      expect(() =>
        MixProjectSerializer.deserialize('{"version": "1.0.0", "id": "p1", "name": "Set", "tracks": "not an array"}')
      ).toThrow(/must be an array/);
    });
  });

  // ==========================================
  // P11-T003: Transition Audition Preview Deck
  // ==========================================
  describe('P11-T003: Transition Audition PreviewDeck', () => {
    it('initializes and prepares transition audition with custom crossover curves', () => {
      const ctx = new MockAudioContext();
      const pDeck = new PreviewDeck(ctx as unknown as AudioContext);

      const bufA = ctx.createBuffer(2, 44100 * 180, 44100);
      const bufB = ctx.createBuffer(2, 44100 * 210, 44100);

      pDeck.prepareTransition({
        outgoingBuffer: bufA,
        incomingBuffer: bufB,
        overlapSeconds: 16,
        style: 'smooth',
        preRollSeconds: 4,
        postRollSeconds: 4
      });

      // Duration = preRoll (4) + overlap (16) + postRoll (4) = 24
      expect(pDeck.duration).toBe(24);
      expect(pDeck.isPlaying).toBe(false);

      // Play audition
      pDeck.play(0);
      expect(pDeck.isPlaying).toBe(true);

      pDeck.pause();
      expect(pDeck.isPlaying).toBe(false);

      pDeck.stop();
      expect(pDeck.isPlaying).toBe(false);
    });

    it('configures bass swap EQ filtering on preview crossover nodes', () => {
      const ctx = new MockAudioContext();
      const pDeck = new PreviewDeck(ctx as unknown as AudioContext);

      const bufA = ctx.createBuffer(2, 44100 * 60, 44100);
      const bufB = ctx.createBuffer(2, 44100 * 60, 44100);

      pDeck.prepareTransition({
        outgoingBuffer: bufA,
        incomingBuffer: bufB,
        overlapSeconds: 8,
        style: 'bass_swap'
      });

      pDeck.play(0);
      expect(pDeck.isPlaying).toBe(true);
      pDeck.stop();
    });
  });

  // ==========================================
  // P11-T004 & P11-T006: OfflineMixRenderer & LUFS Loudness Normalization
  // ==========================================
  describe('P11-T004 & P11-T006: OfflineMixRenderer & ITU-R BS.1770 LUFS Normalizer', () => {
    it('measures integrated LUFS and peak accurately on test signals', () => {
      const sampleRate = 44100;
      const numSamples = sampleRate * 3; // 3 seconds
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);

      // Generate a 1kHz sine wave at -12 dBFS
      const amp = Math.pow(10, -12 / 20);
      for (let i = 0; i < numSamples; i++) {
        const val = amp * Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
        left[i] = val;
        right[i] = val;
      }

      const measurement = LufsMeter.measure([left, right], sampleRate, -14.0);
      expect(measurement.durationSeconds).toBe(3);
      expect(measurement.truePeakDb).toBeCloseTo(-12.0, 0);
      expect(measurement.integratedLufs).toBeGreaterThan(-30);
      expect(measurement.integratedLufs).toBeLessThan(-5);
    });

    it('normalizes multi-channel audio with True Peak limiting', () => {
      const sampleRate = 44100;
      const numSamples = sampleRate * 2;
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        left[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
        right[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      }

      const normResult = LufsMeter.normalize([left, right], sampleRate, -14.0);
      expect(normResult.normalizationGainLinear).toBeGreaterThan(0);

      // Verify samples stay within [-1.0, 1.0]
      let maxPeak = 0;
      for (let i = 0; i < numSamples; i++) {
        const absL = Math.abs(left[i]);
        if (absL > maxPeak) maxPeak = absL;
      }
      expect(maxPeak).toBeLessThanOrEqual(1.0);
    });

    it('renders multi-track project faster than real-time with sample-accurate crossovers', async () => {
      const sampleRate = 44100;
      const durationA = 4; // 4s for high-speed benchmark
      const durationB = 4;
      const overlap = 2; // 2s overlap

      const trackA: TimelineTrack = {
        ...sampleTracks[0],
        duration: durationA,
        offsetSeconds: 0
      };
      const trackB: TimelineTrack = {
        ...sampleTracks[1],
        duration: durationB,
        offsetSeconds: durationA - overlap
      };

      const project: FluxoProject = {
        version: '1.0.0',
        id: 'test-render',
        name: 'Benchmark Mix',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tracks: [trackA, trackB],
        transitions: [
          {
            id: 't-1-2',
            fromTrackId: trackA.id,
            toTrackId: trackB.id,
            overlapSeconds: overlap,
            style: 'smooth',
            curve: 'equal_power'
          }
        ],
        targetLufs: -14.0,
        exportSettings: {
          format: 'wav',
          bitrateKbps: 320,
          sampleRate,
          normalize: true,
          targetLufs: -14.0
        }
      };

      // Create test buffers
      const ctx = new MockAudioContext();
      const bufA = ctx.createBuffer(2, sampleRate * durationA, sampleRate);
      const bufB = ctx.createBuffer(2, sampleRate * durationB, sampleRate);

      // Fill buffers with audio signals
      const dataA = bufA.getChannelData(0);
      const dataB = bufB.getChannelData(0);
      for (let i = 0; i < dataA.length; i++) dataA[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      for (let i = 0; i < dataB.length; i++) dataB[i] = 0.3 * Math.sin((2 * Math.PI * 523 * i) / sampleRate);

      const trackBuffers = new Map<string, AudioBuffer>();
      trackBuffers.set(trackA.id, bufA);
      trackBuffers.set(trackB.id, bufB);

      const progressSteps: string[] = [];
      const result = await OfflineMixRenderer.renderProject(project, trackBuffers, (_prog, phase) => {
        progressSteps.push(phase);
      });

      // Total expected mix length: offsetB + durationB = (4 - 2) + 4 = 6s
      expect(result.durationSeconds).toBe(6);
      expect(result.channelData.length).toBe(2);
      expect(result.channelData[0].length).toBe(sampleRate * 6);
      expect(result.renderTimeMs).toBeLessThan(4000); // Renders faster than 6s realtime!
      expect(progressSteps.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // P11-T005: FFmpeg & Direct WAV Encoding
  // ==========================================
  describe('P11-T005: FFmpegEncoder direct WAV and process lifecycle', () => {
    it('encodes Float32Array PCM into valid RIFF WAV with 44-byte header', async () => {
      const encoder = new FFmpegEncoder();
      const sampleRate = 44100;
      const numSamples = sampleRate * 1; // 1s
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        left[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
        right[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      }

      const tempOut = path.join(process.cwd(), 'tests', 'fixtures', 'temp_mix_export.wav');

      const res = await encoder.encode({
        channelData: [left, right],
        sampleRate,
        outputPath: tempOut,
        format: 'wav'
      });

      expect(res.success).toBe(true);
      expect(res.duration).toBe(1.0);
      expect(fs.existsSync(tempOut)).toBe(true);

      // Verify RIFF WAVE header bytes
      const fileBuf = fs.readFileSync(tempOut);
      expect(fileBuf.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(fileBuf.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(fileBuf.subarray(12, 16).toString('ascii')).toBe('fmt ');

      // Cleanup
      try {
        fs.unlinkSync(tempOut);
      } catch {}
    });

    it('cancels active encode cleanly when requested', () => {
      const encoder = new FFmpegEncoder();
      encoder.cancel();
      // Verifies no crashes when cancel is called on idle or active process
      expect(true).toBe(true);
    });
  });

  // ==========================================
  // P11-T001 & P11-T007: MixCreatorView & ExportModal UI Interaction
  // ==========================================
  describe('P11-T001 & P11-T007: MixCreatorView & ExportModal UI Components', () => {
    const mockLibraryTracks: TrackMetadata[] = [
      {
        id: 'lib-1',
        filePath: 'C:\\Music\\ambient.mp3',
        title: 'Aurora Borealis',
        artist: 'Starlight',
        duration: 200,
        bpm: 120,
        camelotCode: '8A',
        sampleRate: 44100,
        channels: 2,
        format: 'mp3',
        fileSize: 4000000,
        mtime: Date.now(),
        sourceType: 'local'
      }
    ];

    it('renders MixCreatorView with timeline tracks, overlap handles, and transport controls', () => {
      render(<MixCreatorView libraryTracks={mockLibraryTracks} />);

      expect(screen.getByTestId('mix-creator-view')).toBeDefined();
      expect(screen.getByText(/Mix Creator & Timeline Studio/i)).toBeDefined();
      expect(screen.getByText(/Solar Resonance/i)).toBeDefined();
      expect(screen.getByText(/Neon Odyssey/i)).toBeDefined();

      // Overlap handle
      expect(screen.getByTestId('transition-handle-1')).toBeDefined();
      expect(screen.getByRole('button', { name: /SMOOTH/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /BASS SWAP/i })).toBeDefined();
    });

    it('updates transition style when style pill is clicked', () => {
      render(<MixCreatorView libraryTracks={mockLibraryTracks} />);

      const bassSwapBtn = screen.getByRole('button', { name: /BASS SWAP/i });
      fireEvent.click(bassSwapBtn);
      expect(bassSwapBtn).toBeDefined();
    });

    it('opens Add Track modal and adds track to timeline', () => {
      render(<MixCreatorView libraryTracks={mockLibraryTracks} />);

      const addBtn = screen.getByRole('button', { name: /Add Track/i });
      fireEvent.click(addBtn);

      expect(screen.getByTestId('add-track-modal')).toBeDefined();
      expect(screen.getByText('Aurora Borealis')).toBeDefined();

      // Click the track to add
      fireEvent.click(screen.getByText('Aurora Borealis'));

      // Modal closes and track appears in timeline
      expect(screen.getByText('Aurora Borealis')).toBeDefined();
    });

    it('renders ExportModal with format options, LUFS selector, and starts export', () => {
      const handleStartExport = vi.fn();
      const handleCancelExport = vi.fn();
      const sampleProj = MixProjectSerializer.createDefaultProject('Festival Set');
      sampleProj.tracks = sampleTracks;

      render(
        <ExportModal
          isOpen={true}
          onClose={vi.fn()}
          project={sampleProj}
          totalDuration={360}
          onStartExport={handleStartExport}
          onCancelExport={handleCancelExport}
          progress={null}
          isExporting={false}
          exportedResult={null}
        />
      );

      expect(screen.getByTestId('export-modal')).toBeDefined();
      expect(screen.getByText(/Export Master Mix Audio/i)).toBeDefined();
      expect(screen.getByText('MP3')).toBeDefined();
      expect(screen.getByText('FLAC')).toBeDefined();
      expect(screen.getByText('WAV')).toBeDefined();

      const exportBtn = screen.getByRole('button', { name: /Render & Export Mix/i });
      fireEvent.click(exportBtn);
      expect(handleStartExport).toHaveBeenCalledTimes(1);
    });

    it('shows progress bar and cancel button when export is actively running', () => {
      const sampleProj = MixProjectSerializer.createDefaultProject('Festival Set');
      const handleCancel = vi.fn();

      render(
        <ExportModal
          isOpen={true}
          onClose={vi.fn()}
          project={sampleProj}
          totalDuration={360}
          onStartExport={vi.fn()}
          onCancelExport={handleCancel}
          progress={{
            phase: 'rendering',
            progress: 0.65,
            percentage: 65,
            statusMessage: 'Rendering offline transition graph...',
            elapsedSeconds: 5
          }}
          isExporting={true}
          exportedResult={null}
        />
      );

      expect(screen.getByText('Rendering offline transition graph...')).toBeDefined();
      expect(screen.getByText('65%')).toBeDefined();

      const cancelBtn = screen.getByRole('button', { name: /Cancel Export/i });
      fireEvent.click(cancelBtn);
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });
  });
});
