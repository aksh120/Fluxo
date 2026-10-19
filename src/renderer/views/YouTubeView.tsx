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
  Compass,
  Disc,
  ListMusic,
  User,
  LogOut,
  X
} from 'lucide-react';
import { Button } from '../components/Button';
import { KeyBadge, BpmBadge, SourceBadge } from '../components/Badge';
import type { TrackMetadata, PlaylistMetadata, PlaylistDownloadProgress } from '../../shared/types';
import type { SearchResultItem } from '../../shared/sources/IMusicSourceProvider';
import { formatTime } from '../utils/formatters';

export interface YouTubeViewProps {
  onLoadToDeck?: (deckId: 'A' | 'B', track: TrackMetadata) => void;
  onAddToQueue?: (track: TrackMetadata) => void;
  onPlayTrack?: (track: TrackMetadata) => void;
  onTrackExtracted?: (track: TrackMetadata) => void;
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  onLoadToDeck,
  onAddToQueue,
  onPlayTrack,
  onTrackExtracted
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

  // Persistent Login states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);

  // Playlist & Album states
  const [detectedPlaylistId, setDetectedPlaylistId] = useState<string | null>(null);
  const [detectedPlaylist, setDetectedPlaylist] = useState<PlaylistMetadata | null>(null);
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);

  // Active playlist batch download state
  const [activeDownload, setActiveDownload] = useState<PlaylistDownloadProgress | null>(null);

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

  // Load cache statistics, login status, and pre-populate all cached tracks on mount
  useEffect(() => {
    refreshCacheStats();
    checkLoginStatus();
    if (typeof window !== 'undefined' && (window as any).fluxoAPI?.getYoutubeCachedTracks) {
      (window as any).fluxoAPI
        .getYoutubeCachedTracks()
        .then((cachedList: TrackMetadata[]) => {
          if (cachedList && cachedList.length > 0) {
            setExtractedTracks((prev) => {
              const next = new Map(prev);
              for (const t of cachedList) {
                const videoId = t.id.replace(/^yt-/, '');
                next.set(videoId, t);
                next.set(t.id, t);
              }
              return next;
            });
          }
        })
        .catch(console.error);
    }
  }, []);

  // Listen to batch playlist download progress
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fluxoAPI?.onPlaylistDownloadProgress) {
      const unsub = window.fluxoAPI.onPlaylistDownloadProgress((progress) => {
        setActiveDownload(progress);
        if (progress.isComplete) {
          showStatus(`✓ ${progress.statusMessage}`);
          refreshCacheStats();
          setTimeout(() => setActiveDownload(null), 6000);
        } else if (progress.isCancelled) {
          showStatus(`Download cancelled.`);
          setTimeout(() => setActiveDownload(null), 3000);
        }
      });
      return unsub;
    }
  }, []);

  const checkLoginStatus = async () => {
    if (typeof window !== 'undefined' && window.fluxoAPI?.getYouTubeLoginStatus) {
      try {
        setIsCheckingLogin(true);
        const status = await window.fluxoAPI.getYouTubeLoginStatus();
        setIsLoggedIn(!!status.isLoggedIn);
      } catch (err) {
        console.warn('Failed to check YouTube login status:', err);
      } finally {
        setIsCheckingLogin(false);
      }
    }
  };

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
      checkLoginStatus();

      // Check single video
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

      // Check playlist or album
      const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      if (listMatch && listMatch[1]) {
        const pId = listMatch[1];
        if (pId !== detectedPlaylistId) {
          setDetectedPlaylistId(pId);
          setIsFetchingPlaylist(true);
          if (window.fluxoAPI?.fetchPlaylistInfo) {
            window.fluxoAPI
              .fetchPlaylistInfo(url)
              .then((info) => {
                setDetectedPlaylist(info);
              })
              .catch((e) => {
                console.warn('Failed to fetch playlist info:', e);
              })
              .finally(() => {
                setIsFetchingPlaylist(false);
              });
          }
        }
      } else {
        setDetectedPlaylistId(null);
        setDetectedPlaylist(null);
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
  }, [activeTab, detectedPlaylistId]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);

    // If query is a playlist/album URL or ID, automatically fetch playlist metadata
    const listMatch = query.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const isPlaylistQuery =
      listMatch ||
      query.startsWith('PL') ||
      query.startsWith('OLAK') ||
      query.includes('/playlist') ||
      query.includes('/browse/VL');

    if (isPlaylistQuery && window.fluxoAPI?.fetchPlaylistInfo) {
      setStatusMessage(`Inspecting YouTube Playlist / Album...`);
      try {
        const info = await window.fluxoAPI.fetchPlaylistInfo(query.trim());
        if (info) {
          setDetectedPlaylist(info);
          setDetectedPlaylistId(info.id);
          setShowPlaylistDrawer(true);
          showStatus(`Found "${info.title}" with ${info.trackCount} tracks!`);
          setIsSearching(false);
          return;
        }
      } catch (e) {
        console.warn('Playlist lookup failed:', e);
      }
    }

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

      setExtractedTracks((prev) => {
        const next = new Map(prev);
        next.set(item.id, meta);
        next.set(meta.id, meta);
        return next;
      });
      setSearchResults((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, isExtracted: true, filePath: meta.filePath } : r))
      );

      onTrackExtracted?.(meta);
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

  const handleQuickNavigate = (url: string) => {
    setBrowserUrl(url);
    setBrowserInputUrl(url);
    if (webviewRef.current) {
      try {
        webviewRef.current.loadURL(url);
      } catch {
        webviewRef.current.src = url;
      }
    }
  };

  const handleDownloadPlaylist = async (urlOrId?: string) => {
    const target = urlOrId || detectedPlaylist?.url || detectedPlaylistId;
    if (!target) return;
    if (!window.fluxoAPI?.downloadPlaylist) {
      showStatus('Playlist batch downloader is active in Fluxo desktop app.');
      return;
    }

    showStatus(`Starting whole playlist/album download for "${detectedPlaylist?.title || 'Playlist'}"...`);
    try {
      const res = await window.fluxoAPI.downloadPlaylist(target);
      if (res.success) {
        showStatus(`✓ Successfully downloaded ${res.tracksCount} tracks into your Library!`);
        refreshCacheStats();
      } else if (res.error) {
        showStatus(`Playlist download: ${res.error}`);
      }
    } catch (err: any) {
      showStatus(`Playlist download failed: ${err.message || String(err)}`);
    }
  };

  const handleCancelDownload = async () => {
    if (activeDownload && window.fluxoAPI?.cancelPlaylistDownload) {
      await window.fluxoAPI.cancelPlaylistDownload(activeDownload.playlistId);
      showStatus('Cancelling download...');
    }
  };

  const handleLogout = async () => {
    if (window.fluxoAPI?.logoutYouTube) {
      await window.fluxoAPI.logoutYouTube();
      setIsLoggedIn(false);
      showStatus('Logged out of YouTube session.');
      if (webviewRef.current?.reload) {
        webviewRef.current.reload();
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
              data-testid="tab-browse"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
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

            {/* Quick Destination Pills */}
            <button
              onClick={() => handleQuickNavigate('https://www.youtube.com')}
              style={{
                background: !browserUrl.includes('music.youtube.com') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${!browserUrl.includes('music.youtube.com') ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                color: !browserUrl.includes('music.youtube.com') ? '#FFF' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Browse YouTube"
            >
              <Youtube size={12} color="#EF4444" /> YouTube
            </button>
            <button
              onClick={() => handleQuickNavigate('https://music.youtube.com')}
              style={{
                background: browserUrl.includes('music.youtube.com') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${browserUrl.includes('music.youtube.com') ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                color: browserUrl.includes('music.youtube.com') ? '#FFF' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Browse YouTube Music"
            >
              <Disc size={12} color="#EF4444" /> YouTube Music
            </button>

            {/* Search / URL input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid var(--border-glass-hover)',
                borderRadius: '8px',
                padding: '6px 12px',
                flex: 1,
                minWidth: '200px'
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

            {/* Persistent Login Indicator & Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isLoggedIn ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    color: '#34D399',
                    fontWeight: 600
                  }}
                  title="Signed In: Cookies and session persist across application restarts."
                >
                  <CheckCircle2 size={12} color="#10B981" />
                  <span>Signed In</span>
                  <button
                    onClick={handleLogout}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0 2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Log Out of YouTube"
                  >
                    <LogOut size={11} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() =>
                    handleQuickNavigate(
                      'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com'
                    )
                  }
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    color: '#93C5FD',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Sign in to your Google / YouTube account. Your session is remembered permanently across app restarts."
                >
                  <User size={12} /> Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Batch Download Progress Notification */}
      {activeDownload && (
        <div
          style={{
            padding: '12px 18px',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95))',
            border: '1px solid #6366F1',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Disc size={18} color="var(--accent-cyan)" className="pulse-beat" />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                  Downloading: {activeDownload.playlistTitle}
                </span>
                <span style={{ fontSize: '11px', color: '#A5B4FC', marginLeft: '8px' }}>
                  (Track {activeDownload.currentTrackIndex} of {activeDownload.totalTracks})
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {Math.round(activeDownload.overallProgress * 100)}%
              </span>
              {!activeDownload.isComplete && !activeDownload.isCancelled && (
                <Button variant="secondary" size="sm" onClick={handleCancelDownload}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <div
            style={{
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(activeDownload.overallProgress * 100)}%`,
                background: 'linear-gradient(90deg, #6366F1, var(--accent-cyan))',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {activeDownload.statusMessage}
          </div>
        </div>
      )}

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
          {/* Floating Action Banner if playlist/album is detected */}
          {detectedPlaylist && (
            <div
              style={{
                backgroundColor: '#1E1B4B',
                borderBottom: '1px solid #8B5CF6',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 11
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(139, 92, 246, 0.4)'
                  }}
                >
                  <Disc size={20} color="#A78BFA" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{detectedPlaylist.title}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: '#4338CA',
                        color: '#C7D2FE',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}
                    >
                      {detectedPlaylist.trackCount} Tracks
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#C7D2FE' }}>
                    Curated by {detectedPlaylist.author || 'YouTube'} • Ready for library import
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownloadPlaylist()}
                  disabled={activeDownload !== null && !activeDownload.isComplete}
                  leftIcon={<Download size={13} />}
                >
                  {activeDownload !== null && !activeDownload.isComplete ? 'Downloading...' : 'Download Whole Album / Playlist'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPlaylistDrawer(!showPlaylistDrawer)}
                  leftIcon={<ListMusic size={13} />}
                >
                  {showPlaylistDrawer ? 'Hide Tracks' : 'View Tracks'}
                </Button>
              </div>
            </div>
          )}

          {/* Drawer for playlist tracks in browser mode */}
          {showPlaylistDrawer && detectedPlaylist && detectedPlaylist.tracks.length > 0 && (
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid var(--border-glass)',
                padding: '12px 18px',
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                zIndex: 10
              }}
            >
              {detectedPlaylist.tracks.map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '20px' }}>{idx + 1}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFF' }}>{t.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>• {t.artist}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExtractAudio(t as any)}
                    leftIcon={<Download size={12} />}
                  >
                    Extract
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Floating Action Banner if single video is detected */}
          {detectedVideoId && (
            <div
              style={{
                backgroundColor: '#1E1B4B',
                borderBottom: '1px solid #6366F1',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 9
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

          {/* Electron webview tag with persistent partition and modern Chrome user agent */}
          {typeof window !== 'undefined' && (window as any).fluxoAPI ? (
            // @ts-ignore
            <webview
              ref={webviewRef}
              src={browserUrl}
              partition="persist:youtube_session"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
              style={{
                flex: 1,
                width: '100%',
                minHeight: '560px',
                height: '100%',
                border: 'none',
                backgroundColor: '#000'
              }}
              allowpopups="true"
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

          {/* Detected Album / Playlist Card in Search Mode */}
          {detectedPlaylist && (
            <div
              style={{
                marginBottom: '16px',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #8B5CF6',
                background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.8))',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    <Disc size={24} color="#FFF" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFF' }}>
                        {detectedPlaylist.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#4338CA',
                          color: '#EEF2FF',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}
                      >
                        {detectedPlaylist.trackCount} Tracks
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#A5B4FC' }}>
                      Album / Playlist by {detectedPlaylist.author || 'YouTube'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Button
                    variant="primary"
                    onClick={() => handleDownloadPlaylist()}
                    disabled={activeDownload !== null && !activeDownload.isComplete}
                    leftIcon={<Download size={14} />}
                  >
                    {activeDownload !== null && !activeDownload.isComplete ? 'Downloading Album...' : 'Download Whole Album / Playlist'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowPlaylistDrawer(!showPlaylistDrawer)}
                    leftIcon={<ListMusic size={14} />}
                  >
                    {showPlaylistDrawer ? 'Hide Tracks' : 'Inspect Tracks'}
                  </Button>
                </div>
              </div>

              {/* Expandable track list */}
              {showPlaylistDrawer && detectedPlaylist.tracks.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingTop: '10px'
                  }}
                >
                  {detectedPlaylist.tracks.map((t, idx) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '22px' }}>
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#FFF' }}>
                            {t.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {t.artist} • {formatTime(t.duration)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExtractAudio(t as any)}
                        leftIcon={<Download size={12} />}
                      >
                        Extract
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {(searchResults.length > 0 ? searchResults : [
              { id: 'dQw4w9WgXcQ', sourceType: 'youtube' as const, title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: 212, bpm: 113.0, key: '9B' },
              { id: 'kJQP7kiw5Fk', sourceType: 'youtube' as const, title: 'Despacito (Latin Crossover)', artist: 'Luis Fonsi ft. Daddy Yankee', duration: 228, bpm: 89.0, key: '11B' },
              { id: 'fJ9rUzIMcZQ', sourceType: 'youtube' as const, title: 'Bohemian Rhapsody', artist: 'Queen', duration: 355, bpm: 144.0, key: '6A' },
              { id: 'L_LUpnjgPso', sourceType: 'youtube' as const, title: 'Midnight City (Festival Edit)', artist: 'M83', duration: 243, bpm: 105.0, key: '11B' },
              { id: 'kXYiU_JCYtU', sourceType: 'youtube' as const, title: 'Numb / Encore (Mashup)', artist: 'Linkin Park & Jay-Z', duration: 205, bpm: 107.0, key: '8A' }
            ]).map((item) => {
              const isExtractingThis = extractingId === item.id;
              const isCached =
                item.isExtracted ||
                extractedTracks.has(item.id) ||
                extractedTracks.has('yt-' + item.id);

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
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle2 size={11} /> Downloaded
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

                    {/* Extract / Downloaded Button */}
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
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePlayDirect(item)}
                        leftIcon={<CheckCircle2 size={13} color="#22C55E" />}
                        style={{
                          borderColor: 'rgba(34, 197, 94, 0.4)',
                          color: '#4ADE80',
                          backgroundColor: 'rgba(34, 197, 94, 0.08)'
                        }}
                        title="Downloaded to local library - click to play"
                      >
                        Downloaded
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
