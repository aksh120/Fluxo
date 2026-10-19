import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LibraryView } from '../src/renderer/views/LibraryView';
import type { TrackMetadata } from '../src/shared/types';

describe('Phase 4 LibraryView Interactive UI Tests', () => {
  const mockTracks: TrackMetadata[] = [
    {
      id: 'trk-1',
      filePath: 'C:/Music/Alpha.mp3',
      fileSize: 4000000,
      mtime: 1700000000,
      title: 'Alpha Wave',
      artist: 'Brainwave Labs',
      album: 'Synapse',
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local'
    },
    {
      id: 'trk-2',
      filePath: 'C:/Music/Zeta.flac',
      fileSize: 18000000,
      mtime: 1700000010,
      title: 'Zeta Pulse',
      artist: 'Cosmic Beats',
      album: 'Galaxy',
      duration: 240,
      sampleRate: 48000,
      channels: 2,
      format: 'flac',
      sourceType: 'local'
    }
  ];

  it('P04-T004: renders library table with tracks, durations, and formats', () => {
    render(
      <LibraryView
        tracks={mockTracks}
        onImportFolder={vi.fn()}
        onImportFiles={vi.fn()}
        onPlayTrack={vi.fn()}
      />
    );

    expect(screen.getByText('Alpha Wave')).toBeDefined();
    expect(screen.getByText('Brainwave Labs')).toBeDefined();
    expect(screen.getByText('Zeta Pulse')).toBeDefined();
    expect(screen.getByText('Cosmic Beats')).toBeDefined();
    expect(screen.getByText('3:00')).toBeDefined();
    expect(screen.getByText('4:00')).toBeDefined();
  });

  it('P04-T004: filters tracks instantaneously via search bar query', () => {
    render(
      <LibraryView
        tracks={mockTracks}
        onImportFolder={vi.fn()}
        onImportFiles={vi.fn()}
        onPlayTrack={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search tracks, artists, albums, formats/i);
    fireEvent.change(searchInput, { target: { value: 'zeta' } });

    expect(screen.queryByText('Alpha Wave')).toBeNull();
    expect(screen.getByText('Zeta Pulse')).toBeDefined();
  });

  it('P04-T004: triggers load deck and queue actions from track row buttons', () => {
    const handleLoadDeck = vi.fn();
    const handleAddToQueue = vi.fn();

    render(
      <LibraryView
        tracks={mockTracks}
        onImportFolder={vi.fn()}
        onImportFiles={vi.fn()}
        onPlayTrack={vi.fn()}
        onLoadDeck={handleLoadDeck}
        onAddToQueue={handleAddToQueue}
      />
    );

    const deckABtns = screen.getAllByRole('button', { name: /deck a/i });
    fireEvent.click(deckABtns[0]);
    expect(handleLoadDeck).toHaveBeenCalledWith('A', mockTracks[0]);

    const deckBBtns = screen.getAllByRole('button', { name: /deck b/i });
    fireEvent.click(deckBBtns[1]);
    expect(handleLoadDeck).toHaveBeenCalledWith('B', mockTracks[1]);
  });

  it('P06-T007: renders BPM and Camelot Key badges when analysis data is present', () => {
    const analyzedTracks: TrackMetadata[] = [
      {
        ...mockTracks[0],
        bpm: 128.0,
        camelotCode: '8A',
        musicalKey: 'Am'
      }
    ];

    render(
      <LibraryView
        tracks={analyzedTracks}
        onImportFolder={vi.fn()}
        onImportFiles={vi.fn()}
        onPlayTrack={vi.fn()}
      />
    );

    expect(screen.getByText('128.0 BPM')).toBeDefined();
    expect(screen.getByText('8A')).toBeDefined();
  });
});

