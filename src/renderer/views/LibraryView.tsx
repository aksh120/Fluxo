import React, { useState, useMemo } from 'react';
import {
  FolderOpen,
  FilePlus,
  Search,
  Music,
  Disc,
  Play,
  ListPlus,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Button } from '../components/Button';
import { Badge, BpmBadge, KeyBadge } from '../components/Badge';
import type { TrackMetadata } from '../../shared/types';

export type SortField = 'title' | 'artist' | 'album' | 'duration' | 'bpm' | 'camelotCode' | 'format';
export type SortDirection = 'asc' | 'desc';

export interface LibraryViewProps {
  tracks: TrackMetadata[];
  onImportFolder: () => void;
  onImportFiles: () => void;
  onPlayTrack: (track: TrackMetadata) => void;
  onLoadDeck?: (deck: 'A' | 'B', track: TrackMetadata) => void;
  onAddToQueue?: (track: TrackMetadata, playNext?: boolean) => void;
  onDeleteTrack?: (trackId: string) => void;
  isScanning?: boolean;
  scanProgress?: {
    phase: string;
    totalFiles: number;
    processedFiles: number;
    currentFile?: string;
  } | null;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  onImportFolder,
  onImportFiles,
  onPlayTrack,
  onLoadDeck,
  onAddToQueue,
  onDeleteTrack,
  isScanning,
  scanProgress
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('artist');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = tracks.filter((t) => {
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (t.genre && t.genre.toLowerCase().includes(q)) ||
        t.format.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      let valA: string | number = a[sortField] || '';
      let valB: string | number = b[sortField] || '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tracks, searchQuery, sortField, sortDirection]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} color="var(--accent-cyan)" />
    ) : (
      <ArrowDown size={12} color="var(--accent-cyan)" />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Top Action Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            width: '100%',
            maxWidth: '380px'
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search tracks, artists, albums, formats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              width: '100%'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Library Stats & Import Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredAndSortedTracks.length} {filteredAndSortedTracks.length === 1 ? 'track' : 'tracks'}
          </span>

          <Button
            variant="secondary"
            size="sm"
            onClick={onImportFiles}
            leftIcon={<FilePlus size={15} />}
          >
            Add Files
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onImportFolder}
            leftIcon={<FolderOpen size={15} />}
          >
            Import Music Folder
          </Button>
        </div>
      </div>

      {/* Scan Progress Alert if active */}
      {isScanning && scanProgress && (
        <div
          className="glass-panel"
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(0, 242, 254, 0.08)',
            borderColor: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="pulse-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)' }} />
            <span>
              {scanProgress.phase === 'scanning' ? 'Discovering audio files...' : 'Extracting audio tags...'}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{scanProgress.currentFile}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {scanProgress.processedFiles} / {scanProgress.totalFiles}
          </span>
        </div>
      )}

      {/* Main Table or Empty State */}
      {filteredAndSortedTracks.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 242, 254, 0.08)',
              border: '1px solid rgba(0, 242, 254, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: 'var(--shadow-glow-cyan)'
            }}
          >
            <Music size={28} color="var(--accent-cyan)" />
          </div>

          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            {searchQuery ? 'No Tracks Matched Your Query' : 'Your Music Library is Empty'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '420px', marginBottom: '24px' }}>
            {searchQuery
              ? `No tracks found for "${searchQuery}". Try a different search keyword.`
              : 'Import your local MP3, FLAC, WAV, and AAC music files, or search and extract songs from YouTube for intelligent, beatmatched mixing.'}
          </p>

          {!searchQuery && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="primary" onClick={onImportFolder} leftIcon={<FolderOpen size={16} />}>
                Select Music Directory
              </Button>
              <Button variant="secondary" onClick={onImportFiles} leftIcon={<FilePlus size={16} />}>
                Select Files
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px'
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'rgba(11, 15, 25, 0.95)',
                  backdropFilter: 'blur(10px)',
                  zIndex: 2,
                  userSelect: 'none'
                }}
              >
                <th
                  onClick={() => handleSort('title')}
                  style={{ padding: '12px 16px', cursor: 'pointer' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Title {renderSortIcon('title')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('artist')}
                  style={{ padding: '12px 16px', cursor: 'pointer' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Artist {renderSortIcon('artist')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('album')}
                  style={{ padding: '12px 16px', cursor: 'pointer' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Album {renderSortIcon('album')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('duration')}
                  style={{ padding: '12px 16px', width: '80px', cursor: 'pointer', textAlign: 'right' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                    Duration {renderSortIcon('duration')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('bpm')}
                  style={{ padding: '12px 16px', width: '90px', cursor: 'pointer', textAlign: 'center' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                    BPM {renderSortIcon('bpm')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('camelotCode')}
                  style={{ padding: '12px 16px', width: '80px', cursor: 'pointer', textAlign: 'center' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                    Key {renderSortIcon('camelotCode')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('format')}
                  style={{ padding: '12px 16px', width: '70px', cursor: 'pointer', textAlign: 'center' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                    Format {renderSortIcon('format')}
                  </span>
                </th>
                <th style={{ padding: '12px 16px', width: '180px', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTracks.map((track) => (
                <tr
                  key={track.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Title & Cover */}
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden'
                        }}
                      >
                        {track.coverArtPath ? (
                          <img
                            src={`file://${track.coverArtPath}`}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Disc size={16} color="var(--accent-cyan)" />
                        )}
                      </div>
                      <span
                        onClick={() => onPlayTrack(track)}
                        style={{ cursor: 'pointer', hover: { color: 'var(--accent-cyan)' } } as any}
                      >
                        {track.title}
                      </span>
                    </div>
                  </td>

                  {/* Artist */}
                  <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                    {track.artist}
                  </td>

                  {/* Album */}
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                    {track.album}
                  </td>

                  {/* Duration */}
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {formatDuration(track.duration)}
                  </td>

                  {/* BPM */}
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <BpmBadge bpm={track.bpm} />
                  </td>

                  {/* Camelot Key */}
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <KeyBadge camelot={track.camelotCode} musicalKey={track.musicalKey} />
                  </td>

                  {/* Format */}
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {track.format}
                    </span>
                  </td>

                  {/* Quick Action Buttons */}
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {onLoadDeck && (
                        <>
                          <button
                            title="Load on Deck A"
                            onClick={() => onLoadDeck('A', track)}
                            style={{
                              background: 'rgba(0, 242, 254, 0.12)',
                              border: '1px solid rgba(0, 242, 254, 0.3)',
                              color: 'var(--accent-cyan)',
                              fontSize: '10px',
                              fontWeight: 700,
                              borderRadius: '4px',
                              padding: '4px 7px',
                              cursor: 'pointer'
                            }}
                          >
                            DECK A
                          </button>
                          <button
                            title="Load on Deck B"
                            onClick={() => onLoadDeck('B', track)}
                            style={{
                              background: 'rgba(168, 85, 247, 0.12)',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              color: 'var(--accent-purple)',
                              fontSize: '10px',
                              fontWeight: 700,
                              borderRadius: '4px',
                              padding: '4px 7px',
                              cursor: 'pointer'
                            }}
                          >
                            DECK B
                          </button>
                        </>
                      )}

                      {onAddToQueue && (
                        <button
                          title="Add to Queue"
                          onClick={() => onAddToQueue(track)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <ListPlus size={15} />
                        </button>
                      )}

                      {onDeleteTrack && (
                        <button
                          title="Remove from Library"
                          onClick={() => onDeleteTrack(track.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
