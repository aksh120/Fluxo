import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Disc,
  Zap
} from 'lucide-react';
import type { TrackMetadata, DeckState } from '../../shared/types';
import { KeyBadge, BpmBadge } from './Badge';
import { Slider } from './Slider';
import { Button } from './Button';

export interface NowPlayingBarProps {
  currentTrack: TrackMetadata | null;
  deckA: DeckState;
  deckB: DeckState;
  activeDeckId: 'A' | 'B';
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onTriggerTransition: () => void;
  isTransitioning?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({
  currentTrack,
  deckA,
  deckB,
  activeDeckId,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onTriggerTransition,
  isTransitioning = false
}) => {
  const activeDeck = activeDeckId === 'A' ? deckA : deckB;
  const isPlaying = activeDeck.isPlaying;
  const currentTime = activeDeck.currentTime;
  const duration = currentTrack?.duration || activeDeck.duration || 180;

  return (
    <footer
      data-testid="now-playing-bar"
      style={{
        height: '76px',
        backgroundColor: '#0E1422',
        borderTop: '1px solid var(--border-glass)',
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 320px) 1fr minmax(240px, 320px)',
        alignItems: 'center',
        gap: '20px',
        flexShrink: 0,
        userSelect: 'none',
        zIndex: 50
      }}
    >
      {/* Left: Track Information & Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
        {/* Album Artwork / Vinyl Icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden'
          }}
        >
          {currentTrack?.coverArtPath ? (
            <img
              src={currentTrack.coverArtPath}
              alt="Artwork"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Disc
              size={24}
              color={activeDeckId === 'A' ? 'var(--deck-a-primary)' : 'var(--deck-b-primary)'}
              className={isPlaying ? 'spin-vinyl' : 'spin-vinyl spin-vinyl-paused'}
            />
          )}
        </div>

        {/* Title, Artist, & Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {currentTrack ? currentTrack.title : 'Ready to Mix'}
          </div>

          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {currentTrack ? currentTrack.artist : 'Select a track from the library or YouTube'}
          </div>

          {currentTrack && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <KeyBadge camelot="8A" musicalKey="Am" />
              <BpmBadge bpm={126.0} />
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor:
                    activeDeckId === 'A' ? 'var(--deck-a-bg)' : 'var(--deck-b-bg)',
                  color:
                    activeDeckId === 'A' ? 'var(--deck-a-primary)' : 'var(--deck-b-primary)',
                  border: `1px solid ${
                    activeDeckId === 'A' ? 'var(--deck-a-border)' : 'var(--deck-b-border)'
                  }`
                }}
              >
                DECK {activeDeckId}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center: Playback Controls & Timeline Scrubber */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        {/* Playback Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => onSeek(0)}
            title="Cue Track Start"
            aria-label="Cue track start"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px'
            }}
          >
            <SkipBack size={18} />
          </button>

          {/* Primary Play/Pause Button */}
          <button
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: isPlaying ? 'var(--gradient-cyan)' : '#F8FAFC',
              color: '#0B0F19',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPlaying ? 'var(--shadow-glow-cyan)' : '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'all var(--transition-fast)'
            }}
          >
            {isPlaying ? <Pause size={18} fill="#0B0F19" /> : <Play size={18} fill="#0B0F19" style={{ marginLeft: '2px' }} />}
          </button>

          <button
            onClick={onTriggerTransition}
            title="Skip / Transition"
            aria-label="Skip to next track"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px'
            }}
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Scrubber Timeline */}
        <div style={{ width: '100%', maxWidth: '480px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '36px', textAlign: 'right' }}>
            {formatTime(currentTime)}
          </span>

          <Slider
            value={currentTime}
            min={0}
            max={duration}
            step={0.5}
            onChange={onSeek}
            accent={activeDeckId === 'A' ? 'cyan' : 'magenta'}
          />

          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '36px' }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Master Volume & Transition Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
        {/* Emergency / Manual "Transition Now" Trigger */}
        <Button
          variant={isTransitioning ? 'deck-b' : 'primary'}
          size="sm"
          onClick={onTriggerTransition}
          leftIcon={<Zap size={14} className={isTransitioning ? 'pulse-beat' : ''} />}
          disabled={isTransitioning}
        >
          {isTransitioning ? 'MIXING...' : 'TRANSITION'}
        </Button>

        {/* Master Volume Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '120px' }}>
          <button
            onClick={() => onVolumeChange(activeDeck.volume > 0 ? 0 : 0.8)}
            aria-label="Toggle mute"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {activeDeck.volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} color="var(--accent-rose)" />}
          </button>

          <Slider
            value={activeDeck.volume}
            min={0}
            max={1}
            step={0.02}
            onChange={onVolumeChange}
            accent="neutral"
          />
        </div>
      </div>
    </footer>
  );
};
