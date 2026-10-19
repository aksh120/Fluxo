import { describe, it, expect } from 'vitest';
import type { TrackMetadata, DeckState } from '../src/shared/types';

describe('Phase 1 Foundations Smoke Test', () => {
  it('validates shared types and interface contracts', () => {
    const testTrack: TrackMetadata = {
      id: 'test-sha256',
      filePath: 'C:\\Music\\test.mp3',
      fileSize: 1048576,
      mtime: Date.now(),
      title: 'Fluxo Anthem',
      artist: 'Fluxo Resident',
      album: 'First Flow',
      duration: 180.5,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local'
    };

    expect(testTrack.id).toBe('test-sha256');
    expect(testTrack.channels).toBe(2);
    expect(testTrack.duration).toBeGreaterThan(0);
  });

  it('verifies deck state structure', () => {
    const initialDeck: DeckState = {
      deckId: 'A',
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1.0,
      volume: 1.0,
      isMuted: false,
      lowGain: 1.0,
      midGain: 1.0,
      highGain: 1.0,
      filterFreq: 20000,
      filterResonance: 1.0
    };

    expect(initialDeck.deckId).toBe('A');
    expect(initialDeck.playbackRate).toBe(1.0);
    expect(initialDeck.isPlaying).toBe(false);
  });
});
