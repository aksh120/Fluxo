import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Youtube,
  Download,
  Play,
  CheckCircle2,
  Zap,
  HardDrive,
  Sparkles,
  ListPlus,
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Compass
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
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
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

  // Embedded Webview states
  const [browserUrl, setBrowserUrl] = useState('https://www.youtube.com');
  const [browserInputUrl, setBrowserInputUrl] = useState('https://www.youtube.com');
  const [detectedVideoId, setDetectedVideoId] = useState<string | null>(null);
  const [detectedVideoTitle, setDetectedVideoTitle] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
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

  // Listen to navigation events on embedded webview
  useEffect(() => {
    if (activeTab !== 'browse') return;

    const wv = webviewRef.current;
    if (!wv) return;

    const checkUrl = (url: string) => {
      setBrowserInputUrl(url);
      const match = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|^)([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        setDetectedVideoId(match[1]);
        try {
          if (wv.getTitle) {
            const rawTitle = wv.getTitle();
            if (rawTitle) {
              setDetectedVideoTitle(rawTitle.replace(/- YouTube$/i, '').trim());
            }
          }
        } catch {}
      } else {
        setDetectedVideoId(null);
        setDetectedVideoTitle(null);
      }
    };

    const handleNav = (e: any) => {
      if (e.url) checkUrl(e.url);
    };

    try {
      wv.addEventListener('did-navigate', handleNav);
      wv.addEventListener('did-navigate-in-page', handleNav);
    } catch {}

    return () => {
      try {
        wv.removeEventListener('did-navigate', handleNav);
        wv.removeEventListener('did-navigate-in-page', handleNav);
      } catch {}
    };
  }, [activeTab]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setStatusMessage(`Searching YouTube via bundled yt-dlp...`);

    try {
      if (window.fluxoAPI) {
        const results = await window.fluxoAPI.searchYouTube(query.trim(), 10);
        setSearchResults(results);
        if (results.length === 0) {
          showStatus(`No YouTube results found for "${query.trim()}". Try different keywords or paste a video URL.`);
        } else {
          showStatus(`Found ${results.length} real YouTube tracks.`);
        }
      } else {
        // Fallback for mock test environment only
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
    } catch (err) {
      showStatus(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleExtractAudio = async (item: SearchResultItem): Promise<TrackMetadata | null> => {
    setExtractingId(item.id);
    setStatusMessage(`Extracting high-bitrate audio for "${item.title}"...`);

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
          album: 'YouTube',
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
      setSearchResults((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, isExtracted: true, filePath: meta.filePath } : r))
      );

      refreshCacheStats();
      showStatus(`Extracted & ready: "${meta.title}"`);
      return meta;
    } catch (err) {
      showStatus(`Extraction failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setExtractingId(null);
    }
  };

  const handleExtractDetectedVideo = async (targetDeck?: 'A' | 'B') => {
    if (!detectedVideoId) return;
    const item: SearchResultItem = {
      id: detectedVideoId,
      sourceType: 'youtube',
      title: detectedVideoTitle || `YouTube Video (${detectedVideoId})`,
      artist: 'YouTube Stream',
      duration: 200,
      url: `https://www.youtube.com/watch?v=${detectedVideoId}`
    };

    const track = await handleExtractAudio(item);
    if (track && targetDeck && onLoadToDeck) {
      onLoadToDeck(targetDeck, track);
      showStatus(`Loaded "${track.title}" onto Deck ${targetDeck}`);
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

  const handleNavigateBrowser = () => {
    let url = browserInputUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(url)}`;
    }
    setBrowserUrl(url);
    if (webviewRef.current) {
      try {
        webviewRef.current.loadURL(url);
      } catch {
        webviewRef.current.src = url;
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '14px',
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
            border: '1px solid #3B82F6',
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
          <Sparkles size={14} color="#3B82F6" />
          {statusMessage}
        </div>
      )}

      {/* Main Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          background: 'radial-gradient(ellipse at top left, rgba(239, 68, 68, 0.15), transparent 70%), var(--glass-card)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px'
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

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('search')}
              style={{
                background: activeTab === 'search' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${activeTab === 'search' ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                color: activeTab === 'search' ? '#FFF' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              data-testid="tab-search"
            >
              <Compass size={13} /> Stream Finder
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              style={{
                background: activeTab === 'browse' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${activeTab === 'browse' ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                color: activeTab === 'browse' ? '#FFF' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Globe size={13} /> Browse YouTube (Web)
            </button>

            {/* Cache Stats Widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <HardDrive size={13} color="var(--accent-cyan)" />
                <span>Cached: <strong>{cacheStats.trackCount}</strong> ({cacheStats.formattedSize})</span>
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
                    padding: '2px 6px',
                    cursor: 'pointer'
                  }}
                  title="Purge YouTube disk cache"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'search' ? (
          /* Search / URL Input Box */
          <div style={{ display: 'flex', gap: '10px', maxWidth: '720px', marginTop: '6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid var(--border-glass-hover)',
                borderRadius: '8px',
                padding: '8px 12px',
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
              leftIcon={isSearching ? <Zap size={14} className="pulse-beat" /> : <Search size={14} />}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        ) : (
          /* Embedded Browser Toolbar */
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <button
              onClick={() => webviewRef.current?.goBack?.()}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                cursor: 'pointer'
              }}
              title="Back"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              onClick={() => webviewRef.current?.goForward?.()}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                cursor: 'pointer'
              }}
              title="Forward"
            >
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => webviewRef.current?.reload?.()}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                cursor: 'pointer'
              }}
              title="Reload"
            >
              <RotateCcw size={14} />
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid var(--border-glass-hover)',
                borderRadius: '8px',
                padding: '6px 12px',
                flex: 1
              }}
            >
              <Globe size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Enter YouTube URL or search terms..."
                value={browserInputUrl}
                onChange={(e) => setBrowserInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNavigateBrowser()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>

            <Button variant="secondary" size="sm" onClick={handleNavigateBrowser}>
              Go
            </Button>
          </div>
        )}
      </div>

      {/* Embedded YouTube Browser View */}
      {activeTab === 'browse' ? (
        <div
          className="glass-panel"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            position: 'relative'
          }}
        >
          {/* Floating Action Banner if video is detected */}
          {detectedVideoId && (
            <div
              style={{
                backgroundColor: '#1E1B4B',
                borderBottom: '1px solid #6366F1',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Youtube size={20} color="#EF4444" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                    {detectedVideoTitle || `YouTube Video (${detectedVideoId})`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#A5B4FC' }}>
                    Click to extract full quality audio and load directly onto a deck
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleExtractDetectedVideo()}
                  disabled={extractingId === detectedVideoId}
                  leftIcon={<Download size={13} />}
                >
                  {extractingId === detectedVideoId ? 'Extracting...' : 'Extract Audio'}
                </Button>
                <Button
                  variant="deck-a"
                  size="sm"
                  onClick={() => handleExtractDetectedVideo('A')}
                  disabled={extractingId === detectedVideoId}
                >
                  Load Deck A
                </Button>
                <Button
                  variant="deck-b"
                  size="sm"
                  onClick={() => handleExtractDetectedVideo('B')}
                  disabled={extractingId === detectedVideoId}
                >
                  Load Deck B
                </Button>
              </div>
            </div>
          )}

          {/* Electron webview tag */}
          {typeof window !== 'undefined' && (window as any).fluxoAPI ? (
            // @ts-ignore
            <webview
              ref={webviewRef}
              src={browserUrl}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '560px',
                height: '100%',
                border: 'none',
                backgroundColor: '#000'
              }}
              allowpopups={true}
            />
          ) : (
            <iframe
              src={browserUrl}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              title="YouTube Web Browser"
            />
          )}
        </div>
      ) : (
        /* Search Results / Stream Extraction Table */
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
              Real-time high bitrate audio extraction via bundled yt-dlp + FFmpeg
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
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        style={{
                          width: '54px',
                          height: '38px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '38px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#EF4444'
                        }}
                      >
                        <Youtube size={20} />
                      </div>
                    )}

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
                    {item.key && <KeyBadge camelot={item.key} />}
                    {item.bpm && <BpmBadge bpm={item.bpm} />}

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
      )}
    </div>
  );
};
