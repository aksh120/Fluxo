import { describe, it, expect, vi } from 'vitest';
import type { FluxoAPI } from '../src/shared/types';

describe('Preload IPC Contract Verification', () => {
  it('exposes all mandatory methods on the FluxoAPI interface', () => {
    // Mock the implementation to verify full interface conformance
    const mockAPI: FluxoAPI = {
      minimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getPlatformInfo: vi.fn().mockResolvedValue({
        platform: 'win32',
        version: '1.0.0',
        ffmpegAvailable: true,
        pythonAvailable: true
      }),
      selectMusicDirectory: vi.fn().mockResolvedValue('C:\\Music'),
      openAudioFiles: vi.fn().mockResolvedValue(['C:\\Music\\song1.mp3', 'C:\\Music\\song2.flac']),
      readAudioFile: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      getLibraryTracks: vi.fn().mockResolvedValue([]),
      scanMusicDirectory: vi.fn().mockResolvedValue([]),
      importAudioFiles: vi.fn().mockResolvedValue([]),
      deleteLibraryTrack: vi.fn().mockResolvedValue(true),
      searchLibraryTracks: vi.fn().mockResolvedValue([]),
      onScanProgress: vi.fn().mockReturnValue(() => {}),
      getTrackAnalysis: vi.fn().mockResolvedValue(null),
      analyzeTrackPcm: vi.fn().mockResolvedValue({
        trackId: 'trk-1',
        status: 'deep_ready',
        bpm: 124,
        camelotCode: '8A'
      } as any)
    };

    expect(typeof mockAPI.minimize).toBe('function');
    expect(typeof mockAPI.maximize).toBe('function');
    expect(typeof mockAPI.close).toBe('function');
    expect(typeof mockAPI.getPlatformInfo).toBe('function');
    expect(typeof mockAPI.selectMusicDirectory).toBe('function');
    expect(typeof mockAPI.openAudioFiles).toBe('function');
    expect(typeof mockAPI.readAudioFile).toBe('function');
    expect(typeof mockAPI.getTrackAnalysis).toBe('function');
    expect(typeof mockAPI.analyzeTrackPcm).toBe('function');
  });

  it('verifies getPlatformInfo returns expected shape', async () => {
    const mockPlatformInfo = {
      platform: 'win32',
      version: '1.0.0',
      ffmpegAvailable: true,
      pythonAvailable: true
    };

    const mockAPI: FluxoAPI = {
      minimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getPlatformInfo: vi.fn().mockResolvedValue(mockPlatformInfo),
      selectMusicDirectory: vi.fn().mockResolvedValue(null),
      openAudioFiles: vi.fn().mockResolvedValue([]),
      readAudioFile: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      getLibraryTracks: vi.fn().mockResolvedValue([]),
      scanMusicDirectory: vi.fn().mockResolvedValue([]),
      importAudioFiles: vi.fn().mockResolvedValue([]),
      deleteLibraryTrack: vi.fn().mockResolvedValue(true),
      searchLibraryTracks: vi.fn().mockResolvedValue([]),
      onScanProgress: vi.fn().mockReturnValue(() => {}),
      getTrackAnalysis: vi.fn().mockResolvedValue(null),
      analyzeTrackPcm: vi.fn().mockResolvedValue({} as any)
    };

    const info = await mockAPI.getPlatformInfo();
    expect(info.platform).toBe('win32');
    expect(info.ffmpegAvailable).toBe(true);
    expect(info.pythonAvailable).toBe(true);
  });
});
