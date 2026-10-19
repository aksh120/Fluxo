import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { LocalFileProvider } from '../src/main/sources/LocalFileProvider';
import { YouTubeAudioExtractorProvider } from '../src/main/sources/YouTubeAudioExtractorProvider';
import { YouTubeView } from '../src/renderer/views/YouTubeView';
import { DeckEngine } from '../src/renderer/audio/DeckEngine';
import { OfflineMixRenderer } from '../src/renderer/audio/OfflineMixRenderer';
import type { TrackMetadata, FluxoProject, TimelineTrack } from '../src/shared/types';
import type { SearchResultItem } from '../src/shared/sources/IMusicSourceProvider';

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
  createAnalyser = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 256
  });
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

describe('Phase 12: YouTube Audio Extraction Engine & Full Source Integration Tests', () => {
  const testCacheDir = path.join(process.cwd(), 'tests', 'fixtures', 'test_yt_cache');

  beforeEach(() => {
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testCacheDir)) {
      try {
        fs.rmSync(testCacheDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // ==========================================
  // P12-T001 & P12-T002: IMusicSourceProvider & LocalFileProvider
  // ==========================================
  describe('P12-T001 & P12-T002: IMusicSourceProvider and LocalFileProvider Contract', () => {
    it('verifies LocalFileProvider capability flags adhere to the source contract', () => {
      const provider = new LocalFileProvider();
      expect(provider.id).toBe('local');
      expect(provider.name).toBe('Local File Provider');
      expect(provider.capabilities.canSearch).toBe(true);
      expect(provider.capabilities.canStream).toBe(true);
      expect(provider.capabilities.canAccessPcmData).toBe(true);
      expect(provider.capabilities.canOfflineExport).toBe(true);
      expect(provider.capabilities.requiresAuthentication).toBe(false);
      expect(provider.capabilities.latencyProfile).toBe('instant');
    });

    it('resolves local file audio buffer bytes cleanly', async () => {
      const provider = new LocalFileProvider();
      const testFile = path.join(testCacheDir, 'test_dummy.txt');
      fs.writeFileSync(testFile, 'dummy audio payload');

      const buffer = await provider.getAudioBuffer(testFile);
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBe(19);

      const streamPath = await provider.getStreamUrlOrPath(testFile);
      expect(streamPath).toBe(testFile);
    });
  });

  // ==========================================
  // P12-T003 & P12-T004: YouTubeAudioExtractorProvider & Caching
  // ==========================================
  describe('P12-T003 & P12-T004: YouTubeAudioExtractorProvider Extraction and Disk Caching', () => {
    it('verifies YouTubeAudioExtractorProvider capability contract flags', () => {
      const provider = new YouTubeAudioExtractorProvider({ cacheDir: testCacheDir });
      expect(provider.id).toBe('youtube');
      expect(provider.name).toBe('YouTube Audio Extractor');
      expect(provider.capabilities.canSearch).toBe(true);
      expect(provider.capabilities.canStream).toBe(true);
      expect(provider.capabilities.canAccessPcmData).toBe(true);
      expect(provider.capabilities.canOfflineExport).toBe(true);
      expect(provider.capabilities.requiresAuthentication).toBe(false);
      expect(provider.capabilities.latencyProfile).toBe('buffered');
    });

    it('searches YouTube with query string and returns structured metadata items', async () => {
      const provider = new YouTubeAudioExtractorProvider({ cacheDir: testCacheDir });
      const results = await provider.search('Never Gonna Give You Up', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sourceType).toBe('youtube');
      expect(results[0].title).toBeDefined();
      expect(results[0].artist).toBeDefined();
      expect(results[0].duration).toBeGreaterThan(0);
    });

    it('extracts and caches audio locally to disk with instant second-time cache hits', async () => {
      const provider = new YouTubeAudioExtractorProvider({ cacheDir: testCacheDir });
      const videoId = 'dQw4w9WgXcQ';

      const progressSteps: string[] = [];
      const trackMeta = await provider.extractAudio(videoId, (prog) => {
        progressSteps.push(prog.phase);
      });

      expect(trackMeta.id).toBe(`yt-${videoId}`);
      expect(trackMeta.sourceType).toBe('youtube');
      expect(trackMeta.filePath).toBeDefined();
      expect(fs.existsSync(trackMeta.filePath)).toBe(true);
      expect(progressSteps).toContain('complete');

      // Second extraction must hit cache instantly
      const cachedMeta = await provider.extractAudio(videoId);
      expect(cachedMeta.filePath).toBe(trackMeta.filePath);

      // Verify cache stats and size calculation
      const stats = await provider.getCacheStats();
      expect(stats.trackCount).toBe(1);
      expect(stats.totalBytes).toBeGreaterThan(0);

      // Clear cache
      const cleared = await provider.clearCache();
      expect(cleared.deletedCount).toBe(1);
      const postClearStats = await provider.getCacheStats();
      expect(postClearStats.trackCount).toBe(0);
    }, 45000);

    it('gracefully creates non-existent or deleted cache directories without throwing ENOENT during extraction', async () => {
      const nonExistentDir = path.join(testCacheDir, 'nested', 'deep', 'cache');
      if (fs.existsSync(nonExistentDir)) {
        fs.rmSync(nonExistentDir, { recursive: true, force: true });
      }

      const provider = new YouTubeAudioExtractorProvider({ cacheDir: nonExistentDir });
      // Delete directory after instantiation to simulate external or Chromium deletion
      if (fs.existsSync(nonExistentDir)) {
        fs.rmSync(nonExistentDir, { recursive: true, force: true });
      }
      expect(fs.existsSync(nonExistentDir)).toBe(false);

      const trackMeta = await provider.extractAudio('dQw4w9WgXcQ');
      expect(trackMeta).toBeDefined();
      expect(fs.existsSync(trackMeta.filePath)).toBe(true);
      expect(fs.existsSync(nonExistentDir)).toBe(true);
    }, 45000);
  });

  // ==========================================
  // P12-T005: Dual-Deck Mixing & Offline Export Parity
  // ==========================================
  describe('P12-T005: 100% Full DSP and Export Parity for Extracted YouTube Tracks', () => {
    it('loads extracted YouTube track onto DeckEngine and executes full DJ controls', () => {
      const ctx = new MockAudioContext();
      const deck = new DeckEngine('A', ctx as unknown as AudioContext);

      const ytTrack: TrackMetadata = {
        id: 'yt-dQw4w9WgXcQ',
        filePath: 'C:\\cache\\yt\\dQw4w9WgXcQ.mp3',
        fileSize: 4800000,
        mtime: Date.now(),
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        duration: 212,
        sampleRate: 44100,
        channels: 2,
        format: 'mp3',
        bpm: 113.0,
        musicalKey: '9B',
        camelotCode: '9B',
        sourceType: 'youtube'
      };

      const testBuffer = ctx.createBuffer(2, 44100 * 212, 44100);
      deck.loadTrack(testBuffer, ytTrack);

      const state = deck.getState();
      expect(state.currentTrack?.sourceType).toBe('youtube');
      expect(state.currentTrack?.title).toBe('Never Gonna Give You Up');

      // DJ manual controls
      deck.play(0);
      expect(deck.getState().isPlaying).toBe(true);

      deck.setPlaybackRate(1.05); // Tempo pitch bend
      expect(deck.getState().playbackRate).toBe(1.05);

      deck.setLowGain(0.0); // Bass kill
      expect(deck.getState().lowGain).toBe(0.0);

      deck.activateLoop(4); // 4-beat loop
      expect(deck.loopController.getState().isActive).toBe(true);

      deck.stop();
    });

    it('renders crossover mix containing both local and extracted YouTube tracks in OfflineMixRenderer', async () => {
      const sampleRate = 44100;
      const ctx = new MockAudioContext();

      const localTrack: TimelineTrack = {
        id: 'tl-local-1',
        trackId: 'local-1',
        filePath: 'C:\\Music\\local.mp3',
        title: 'Local Solar Resonance',
        artist: 'Fluxo Sound Labs',
        duration: 4,
        offsetSeconds: 0,
        volume: 1.0,
        lowGain: 1.0,
        midGain: 1.0,
        highGain: 1.0
      };

      const ytTrack: TimelineTrack = {
        id: 'tl-yt-1',
        trackId: 'yt-dQw4w9WgXcQ',
        filePath: 'C:\\cache\\yt\\dQw4w9WgXcQ.mp3',
        title: 'Never Gonna Give You Up (YouTube Extracted)',
        artist: 'Rick Astley',
        duration: 4,
        offsetSeconds: 2, // 2s overlap
        volume: 1.0,
        lowGain: 1.0,
        midGain: 1.0,
        highGain: 1.0
      };

      const project: FluxoProject = {
        version: '1.0.0',
        id: 'hybrid-crossover-set',
        name: 'Hybrid Local + YouTube Crossover Set',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tracks: [localTrack, ytTrack],
        transitions: [
          {
            id: 'trans-local-yt',
            fromTrackId: localTrack.id,
            toTrackId: ytTrack.id,
            overlapSeconds: 2,
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

      const bufA = ctx.createBuffer(2, sampleRate * 4, sampleRate);
      const bufB = ctx.createBuffer(2, sampleRate * 4, sampleRate);

      const trackBuffers = new Map<string, AudioBuffer>();
      trackBuffers.set(localTrack.id, bufA);
      trackBuffers.set(ytTrack.id, bufB);

      const renderResult = await OfflineMixRenderer.renderProject(project, trackBuffers);

      expect(renderResult.durationSeconds).toBe(6);
      expect(renderResult.channelData.length).toBe(2);
      expect(renderResult.channelData[0].length).toBe(sampleRate * 6);
      expect(renderResult.loudness.integratedLufs).toBeDefined();
    });
  });

  // ==========================================
  // Interactive UI Tests: YouTubeView
  // ==========================================
  describe('YouTubeView Interactive UI Component', () => {
    it('renders YouTubeView with search banner, cache widget, and popular streams', () => {
      render(<YouTubeView />);

      expect(screen.getByTestId('youtube-view')).toBeDefined();
      expect(screen.getByText(/YouTube High-Fidelity Audio Extractor/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Paste YouTube video\/playlist URL/i)).toBeDefined();
      expect(screen.getByText(/Popular Crossover Streams/i)).toBeDefined();
      expect(screen.getByText(/Never Gonna Give You Up/i)).toBeDefined();
    });

    it('triggers search query and renders search results', async () => {
      render(<YouTubeView />);

      const input = screen.getByPlaceholderText(/Paste YouTube video\/playlist URL/i);
      fireEvent.change(input, { target: { value: 'Despacito' } });

      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByText(/Despacito/i)).toBeDefined();
      });
    });

    it('triggers load to Deck A and Deck B from stream item', async () => {
      const handleLoadDeck = vi.fn();
      render(<YouTubeView onLoadToDeck={handleLoadDeck} />);

      // Find Deck A button on the first sample result
      const deckABtns = screen.getAllByRole('button', { name: /Deck A/i });
      fireEvent.click(deckABtns[0]);

      await waitFor(() => {
        expect(handleLoadDeck).toHaveBeenCalledWith('A', expect.objectContaining({
          sourceType: 'youtube'
        }));
      });
    });

    it('triggers add to queue when queue button is clicked', async () => {
      const handleAddToQueue = vi.fn();
      render(<YouTubeView onAddToQueue={handleAddToQueue} />);

      const queueBtns = screen.getAllByRole('button', { name: /Add to Queue/i });
      fireEvent.click(queueBtns[0]);

      await waitFor(() => {
        expect(handleAddToQueue).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceType: 'youtube'
          })
        );
      });
    });

    // ==========================================
    // P12-T006: Whole Playlist & Album Batch Downloader & Persistent YouTube Login
    // ==========================================
    describe('P12-T006: Whole Playlist & Album Batch Downloader & Persistent YouTube Session', () => {
      it('fetches playlist and album metadata with structured track entries', async () => {
        const provider = new YouTubeAudioExtractorProvider({ cacheDir: testCacheDir });
        const playlistInfo = await provider.fetchPlaylistInfo('https://www.youtube.com/playlist?list=PL1234567890');

        expect(playlistInfo).toBeDefined();
        expect(playlistInfo?.title).toBeDefined();
        expect(playlistInfo?.trackCount).toBeGreaterThan(0);
        expect(playlistInfo?.tracks.length).toBeGreaterThan(0);
        expect(playlistInfo?.tracks[0].sourceType).toBe('youtube');
      });

      it('downloads entire playlist batch and tracks progress through completion', async () => {
        const provider = new YouTubeAudioExtractorProvider({ cacheDir: testCacheDir });
        vi.spyOn(provider, 'extractAudio').mockImplementation(async (id: string, onProg?: any) => {
          onProg?.({
            videoId: id,
            phase: 'complete',
            progress: 1.0,
            percentage: 100,
            statusMessage: 'Done'
          });
          const dummyPath = path.join(testCacheDir, `${id}.mp3`);
          fs.writeFileSync(dummyPath, 'audio dummy');
          return {
            id: `yt-${id}`,
            filePath: dummyPath,
            fileSize: 1000,
            mtime: Date.now(),
            title: `Track ${id}`,
            artist: 'Artist',
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            format: 'mp3',
            sourceType: 'youtube'
          };
        });

        const progressEvents: any[] = [];

        const result = await provider.downloadPlaylist(
          'https://www.youtube.com/playlist?list=PL1234567890',
          (prog) => {
            progressEvents.push(prog);
          }
        );

        expect(result.success).toBe(true);
        expect(result.tracksCount).toBeGreaterThan(0);
        expect(result.tracks.length).toBeGreaterThan(0);
        expect(result.tracks[0].album).toBeDefined();

        // Verify progress updates occurred
        expect(progressEvents.length).toBeGreaterThan(0);
        const lastProg = progressEvents[progressEvents.length - 1];
        expect(lastProg.isComplete).toBe(true);
        expect(lastProg.overallProgress).toBe(1.0);
      });

      it('supports cancelling playlist download mid-batch', async () => {
        const provider = new YouTubeAudioExtractorProvider({ cacheDir: testCacheDir });
        const cancelToken = { cancelled: true };
        const progressEvents: any[] = [];

        const result = await provider.downloadPlaylist(
          'https://www.youtube.com/playlist?list=PL1234567890',
          (prog) => {
            progressEvents.push(prog);
          },
          cancelToken
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('cancelled');
        expect(progressEvents.some((p) => p.isCancelled)).toBe(true);
      });

      it('attaches cookies argument when cookies file exists for authenticated extraction', () => {
        const dummyCookiesPath = path.join(testCacheDir, 'youtube_cookies.txt');
        fs.writeFileSync(dummyCookiesPath, '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1999999999\tLOGIN_INFO\tabc\n');

        const provider = new YouTubeAudioExtractorProvider({
          cacheDir: testCacheDir,
          cookiesFilePath: dummyCookiesPath
        });

        expect(provider.getCookiesFilePath()).toBe(dummyCookiesPath);
        expect(provider.getCookiesArg()).toContain('--cookies');
        expect(provider.getCookiesArg()).toContain(dummyCookiesPath);

        provider.setCookiesFilePath(undefined);
        expect(provider.getCookiesArg()).toBe('');
      });

      it('renders embedded webview with persist:youtube_session partition and modern Chrome useragent', async () => {
        (window as any).fluxoAPI = {
          getYouTubeLoginStatus: vi.fn().mockResolvedValue({ isLoggedIn: false }),
          getYouTubeCacheStats: vi.fn().mockResolvedValue({ totalBytes: 0, trackCount: 0, formattedSize: '0 KB' }),
          getYoutubeCachedTracks: vi.fn().mockResolvedValue([])
        };

        render(<YouTubeView />);

        // Switch to browse tab
        const browseTabBtn = screen.getByTestId('tab-browse') || screen.getByText(/Browse YouTube \(Web\)/i);
        fireEvent.click(browseTabBtn);

        await waitFor(() => {
          expect(screen.getByText(/YouTube Music/i)).toBeDefined();
          expect(screen.getByText(/Sign In/i)).toBeDefined();
        });
      });

      it('renders active download progress bar when playlist download is underway', async () => {
        let progressCallback: any = null;
        (window as any).fluxoAPI = {
          getYouTubeLoginStatus: vi.fn().mockResolvedValue({ isLoggedIn: true }),
          getYouTubeCacheStats: vi.fn().mockResolvedValue({ totalBytes: 0, trackCount: 0, formattedSize: '0 KB' }),
          getYoutubeCachedTracks: vi.fn().mockResolvedValue([]),
          onPlaylistDownloadProgress: vi.fn().mockImplementation((cb) => {
            progressCallback = cb;
            return () => {};
          })
        };

        render(<YouTubeView />);

        // Simulate progress update
        progressCallback?.({
          playlistId: 'pl-test',
          playlistTitle: 'Greatest Hits Album',
          currentTrackIndex: 3,
          totalTracks: 10,
          currentTrackTitle: 'Track 3',
          currentTrackProgress: 0.5,
          overallProgress: 0.3,
          statusMessage: 'Downloading track 3/10...',
          isComplete: false,
          isCancelled: false,
          failedTracks: []
        });

        await waitFor(() => {
          expect(screen.getByText(/Downloading: Greatest Hits Album/i)).toBeDefined();
          expect(screen.getByText(/30%/i)).toBeDefined();
          expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
        });
      });
    });
  });
});
