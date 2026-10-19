import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioLibraryPanel } from '../src/renderer/components/StudioLibraryPanel';
import type { Track } from '../src/shared/types';

describe('Phase 16 StudioLibraryPanel UI Tests', () => {
  const tracks: Track[] = [
    {
      id: 'trk_1',
      title: 'Neon Skyline',
      artist: 'Synthwave Guy',
      duration: 195,
      bpm: 124,
      key: '8B',
      format: 'flac',
      filePath: 'C:/music/neon.flac',
      fileSize: 12000000,
      createdAt: Date.now()
    },
    {
      id: 'trk_2',
      title: 'Deep Midnight',
      artist: 'Techno Girl',
      duration: 240,
      bpm: 130,
      key: '9B',
      format: 'mp3',
      filePath: 'C:/music/deep.mp3',
      fileSize: 8000000,
      createdAt: Date.now()
    },
    {
      id: 'trk_3',
      title: 'Chill Sunset',
      artist: 'Lofi King',
      duration: 150,
      bpm: 85,
      key: '4A',
      format: 'mp3',
      filePath: 'C:/music/chill.mp3',
      fileSize: 4000000,
      createdAt: Date.now()
    }
  ];

  it('P16-T005: renders track list with metadata and handles load to Deck A and Deck B', () => {
    const onLoadA = vi.fn();
    const onLoadB = vi.fn();
    const onAddQueue = vi.fn();

    render(
      <StudioLibraryPanel
        tracks={tracks}
        onLoadDeckA={onLoadA}
        onLoadDeckB={onLoadB}
        onAddToQueue={onAddQueue}
        referenceBpm={125}
        referenceKey="8B"
      />
    );

    expect(screen.getByText(/Studio Library \(3\)/i)).toBeTruthy();
    expect(screen.getByText('Neon Skyline')).toBeTruthy();
    expect(screen.getByText('Deep Midnight')).toBeTruthy();
    expect(screen.getByText('Chill Sunset')).toBeTruthy();

    // Click load Deck A on first track
    const deckABtns = screen.getAllByRole('button', { name: /Deck A/i });
    fireEvent.click(deckABtns[0]);
    expect(onLoadA).toHaveBeenCalledWith(tracks[0]);

    // Click load Deck B on second track
    const deckBBtns = screen.getAllByRole('button', { name: /Deck B/i });
    fireEvent.click(deckBBtns[1]);
    expect(onLoadB).toHaveBeenCalledWith(tracks[1]);
  });

  it('P16-T005: filters tracks by search query and BPM match pill', () => {
    render(
      <StudioLibraryPanel
        tracks={tracks}
        onLoadDeckA={vi.fn()}
        onLoadDeckB={vi.fn()}
        referenceBpm={125}
        referenceKey="8B"
      />
    );

    // Filter by text search
    const searchInput = screen.getByPlaceholderText(/Search title, artist, BPM.../i);
    fireEvent.change(searchInput, { target: { value: 'Synthwave' } });

    expect(screen.getByText('Neon Skyline')).toBeTruthy();
    expect(screen.queryByText('Deep Midnight')).toBeNull();
    expect(screen.queryByText('Chill Sunset')).toBeNull();

    // Clear search and click BPM Match pill (Ref: 125 BPM -> 124 and 130 match, 85 excluded)
    fireEvent.change(searchInput, { target: { value: '' } });
    const bpmMatchBtn = screen.getByRole('button', { name: /BPM Match/i });
    fireEvent.click(bpmMatchBtn);

    expect(screen.getByText('Neon Skyline')).toBeTruthy();
    expect(screen.getByText('Deep Midnight')).toBeTruthy();
    expect(screen.queryByText('Chill Sunset')).toBeNull();
  });
});
