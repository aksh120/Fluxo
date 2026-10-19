import React, { useState, useEffect } from 'react';
import {
  Search,
  Youtube,
  Download,
  Play,
  CheckCircle2,
  Zap,
  Trash2,
  HardDrive,
  Clock,
  Sparkles,
  ExternalLink,
  ListPlus
} from 'lucide-react';
import { Button } from '../components/Button';
import { KeyBadge, BpmBadge, SourceBadge } from '../components/Badge';
import type { TrackMetadata } from '../../shared/types';
import type { SearchResultItem } from '../../shared/sources/IMusicSourceProvider';
import { formatTime } from '../utils/formatters';

export interface YouTubeViewProps {
  onLoadToDeck?: (deckId: 'A' | 'B', track: TrackMetadata) => void;
  onAddToQueue?: (track: TrackMetadata) => void;
  onPlayTrack?: (track: TrackMetadata) => void;
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  onLoadToDeck,
  onAddToQueue,
  onPlayTrack
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [extractedTracks, setExtractedTracks] = useState<Map<string, TrackMetadata>>(new Map());
  const [cacheStats, setCacheStats] = useState<{ totalBytes: number; trackCount: number; formattedSize: string }>({
    totalBytes: 0,
    trackCount: 0,
    formattedSize: '0 KB'
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Load cache statistics on mount
  useEffect(() => {
    refreshCacheStats();
  }, []);

  const refreshCacheStats = async () => {
    if (window.fluxoAPI) {
      try {
        const stats = await window.fluxoAPI.getYouTubeCacheStats();
        setCacheStats(stats);
      } catch (err) {
        console.warn('Failed to load YouTube cache stats:', err);
      }
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setStatusMessage('Searching YouTube streams via yt-dlp...');

    try {
      if (window.fluxoAPI) {
        const results = await window.fluxoAPI.searchYouTube(query.trim(), 10);
        setSearchResults(results);
      } else {
        // Fallback for mock/test environment
        const mockItem: SearchResultItem = {
          id: 'dQw4w9WgXcQ',
          sourceType: 'youtube',
          title: query.trim() || 'Never Gonna Give You Up',
          artist: 'Rick Astley',
          duration: 212,
          bpm: 113.0,
          key: '9B',
          isExtracted: false
        };
        setSearchResults([mockItem]);
      }
      setStatusMessage(null);
    } catch (err) {
      showStatus(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleExtractAudio = async (item: SearchResultItem): Promise<TrackMetadata | null> => {
    setExtractingId(item.id);
    setStatusMessage(`Extracting audio stream for "${item.title}"...`);

    try {
      let meta: TrackMetadata;
      if (window.fluxoAPI) {
        meta = await window.fluxoAPI.extractYouTubeAudio(item.id);
      } else {
        meta = {
          id: `yt-${item.id}`,
          filePath: `C:\\Music\\cache\\${item.id}.mp3`,
          fileSize: 4500000,
          mtime: Date.now(),
          title: item.title,
          artist: item.artist,
          duration: item.duration || 180,
          sampleRate: 44100,
          channels: 2,
          format: 'mp3',
          bpm: item.bpm || 124,
          musicalKey: item.key || '8B',
          camelotCode: item.key || '8B',
          sourceType: 'youtube'
        };
      }

      setExtractedTracks((prev) => new Map(prev).set(item.id, meta));
      // Mark item as extracted in results
      setSearchResults((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, isExtracted: true, filePath: meta.filePath } : r))
      );

      refreshCacheStats();
      showStatus(`Extracted & cached "${item.title}"`);
      return meta;
    } catch (err) {
      showStatus(`Extraction failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setExtractingId(null);
    }
  };

  const handleLoadDeck = async (deckId: 'A' | 'B', item: SearchResultItem) => {
    let track = extractedTracks.get(item.id);
    if (!track) {
      track = (await handleExtractAudio(item)) || undefined;
    }
    if (track && onLoadToDeck) {
      onLoadToDeck(deckId, track);
      showStatus(`Loaded "${track.title}" onto Deck ${deckId}`);
    }
  };

  const handlePlayDirect = async (item: SearchResultItem) => {
    let track = extractedTracks.get(item.id);
    if (!track) {
      track = (await handleExtractAudio(item)) || undefined;
    }
    if (track && onPlayTrack) {
      onPlayTrack(track);
    }
  };

  const handleQueueDirect = async (item: SearchResultItem) => {
    let track = extractedTracks.get(item.id);
    if (!track) {
      track = (await handleExtractAudio(item)) || undefined;
    }
    if (track && onAddToQueue) {
      onAddToQueue(track);
      showStatus(`Added "${track.title}" to play queue`);
    }
  };

  const handleClearCache = async () => {
    if (window.fluxoAPI) {
      try {
        const res = await window.fluxoAPI.clearYouTubeCache();
        refreshCacheStats();
        showStatus(`Cleared YouTube cache: freed ${(res.freedBytes / (1024 * 1024)).toFixed(1)} MB`);
      } catch (err) {
        showStatus(`Failed to clear cache: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '16px',
        position: 'relative'
      }}
      data-testid="youtube-view"
    >
      {/* Toast message banner */}
      {statusMessage && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '24px',
            backgroundColor: '#0F172A',
            border: '1px solid #EF4444',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={14} color="#EF4444" />
          {statusMessage}
        </div>
      )}

      {/* Search Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          background: 'radial-gradient(ellipse at top left, rgba(239, 68, 68, 0.15), transparent 70%), var(--glass-card)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444' }}>
            <Youtube size={24} />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--text-primary)'
              }}
            >
              YouTube High-Fidelity Audio Extractor
            </span>
            <SourceBadge sourceType="youtube" />
          </div>

          {/* Cache Stats Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <HardDrive size={13} color="var(--accent-cyan)" />
              <span>Cached: <strong>{cacheStats.trackCount} tracks</strong> ({cacheStats.formattedSize})</span>
            </div>
            {cacheStats.trackCount > 0 && (
              <button
                onClick={handleClearCache}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  padding: '3px 8px',
                  cursor: 'pointer'
                }}
                title="Purge YouTube disk cache"
              >
                Clear Cache
              </button>
            )}
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '640px', marginBottom: '14px' }}>
          Extract high-bitrate audio from YouTube URLs or search queries via local <code>yt-dlp</code> + FFmpeg.
          Extracted tracks are cached in <code>%APPDATA%\Fluxo\cache\youtube\</code> with 100% full DSP parity
          (harmonic key detection, beatmatching, 3-band EQ, stem separation, and offline mix export).
        </p>

        {/* Search / URL Input Box */}
        <div style={{ display: 'flex', gap: '10px', maxWidth: '720px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--border-glass-hover)',
              borderRadius: '8px',
              padding: '10px 14px',
              flex: 1
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Paste YouTube video/playlist URL or search by track title, artist..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
          </div>

          <Button
            variant="primary"
            onClick={handleSearch}
            disabled={isSearching}
            leftIcon={isSearching ? <Zap size={15} className="pulse-beat" /> : <Search size={15} />}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {/* Search Results / Stream Extraction Table */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px'
          }}
        >
          <div className="section-title">
            {searchResults.length > 0 ? `Search Results (${searchResults.length})` : 'Popular Crossover Streams'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Instant &lt; 1s progressive playback with local caching
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {(searchResults.length > 0 ? searchResults : [
            { id: 'dQw4w9WgXcQ', sourceType: 'youtube' as const, title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: 212, bpm: 113.0, key: '9B' },
            { id: 'kJQP7kiw5Fk', sourceType: 'youtube' as const, title: 'Despacito (Latin Crossover)', artist: 'Luis Fonsi ft. Daddy Yankee', duration: 228, bpm: 89.0, key: '11B' },
            { id: 'fJ9rUzIMcZQ', sourceType: 'youtube' as const, title: 'Bohemian Rhapsody', artist: 'Queen', duration: 355, bpm: 144.0, key: '6A' },
            { id: 'L_LUpnjgPso', sourceType: 'youtube' as const, title: 'Midnight City (Festival Edit)', artist: 'M83', duration: 243, bpm: 105.0, key: '11B' },
            { id: 'kXYiU_JCYtU', sourceType: 'youtube' as const, title: 'Numb / Encore (Mashup)', artist: 'Linkin Park & Jay-Z', duration: 205, bpm: 107.0, key: '8A' }
          ]).map((item) => {
            const isExtractingThis = extractingId === item.id;
            const isCached = item.isExtracted || extractedTracks.has(item.id);

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${isCached ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)'}`,
                  transition: 'background-color 0.15s ease'
                }}
                data-testid={`yt-item-${item.id}`}
              >
                {/* Left info block */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#EF4444'
                    }}
                  >
                    <Youtube size={20} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      {isCached && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#22C55E',
                            backgroundColor: 'rgba(34, 197, 94, 0.12)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <CheckCircle2 size={10} /> Cached
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.artist} • {formatTime(item.duration)}
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.key && <KeyBadge camelotCode={item.key} size="sm" />}
                  {item.bpm && <BpmBadge bpm={item.bpm} size="sm" />}

                  {/* Extract Button */}
                  {!isCached ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExtractAudio(item)}
                      disabled={isExtractingThis}
                      leftIcon={isExtractingThis ? <Zap size={13} className="pulse-beat" /> : <Download size={13} />}
                    >
                      {isExtractingThis ? 'Extracting...' : 'Extract'}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayDirect(item)}
                      leftIcon={<Play size={13} />}
                    >
                      Play
                    </Button>
                  )}

                  {/* Add to Queue */}
                  <button
                    onClick={() => handleQueueDirect(item)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Add to Play Queue"
                    aria-label="Add to Queue"
                  >
                    <ListPlus size={14} />
                  </button>

                  {/* Load Deck Buttons */}
                  <Button
                    variant="deck-a"
                    size="sm"
                    onClick={() => handleLoadDeck('A', item)}
                    disabled={isExtractingThis}
                  >
                    Deck A
                  </Button>
                  <Button
                    variant="deck-b"
                    size="sm"
                    onClick={() => handleLoadDeck('B', item)}
                    disabled={isExtractingThis}
                  >
                    Deck B
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
