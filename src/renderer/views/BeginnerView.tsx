import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Disc,
  Sparkles,
  Zap,
  Flame,
  Volume2,
  Music2,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Button } from '../components/Button';
import { Slider } from '../components/Slider';
import { KeyBadge, BpmBadge, Badge } from '../components/Badge';
import type { DeckState, TrackMetadata } from '../../shared/types';
import type { TransitionStyle } from '../audio/TransitionEngine';

export interface BeginnerViewProps {
  activeDeck: DeckState;
  standbyDeck: DeckState;
  nextTrack?: TrackMetadata | null;
  onPlayToggle: () => void;
  onTriggerTransition: (style: TransitionStyle) => void;
  onSkipNext: () => void;
  onVolumeChange: (vol: number) => void;
  isTransitionActive?: boolean;
  transitionProgress?: number;
}

export type VibePreset = 'chill' | 'building' | 'peak' | 'steady';

export const BeginnerView: React.FC<BeginnerViewProps> = ({
  activeDeck,
  standbyDeck,
  nextTrack,
  onPlayToggle,
  onTriggerTransition,
  onSkipNext,
  onVolumeChange,
  isTransitionActive = false,
  transitionProgress = 0
}) => {
  const [selectedVibe, setSelectedVibe] = useState<VibePreset>('building');
  const [selectedStyle, setSelectedStyle] = useState<TransitionStyle>('bass_swap');

  const currentTrack = activeDeck.currentTrack;
  const isPlaying = activeDeck.isPlaying;

  const vibeOptions = [
    { id: 'chill', label: 'Chill Lounge', icon: <Music2 size={16} color="var(--accent-cyan)" /> },
    { id: 'building', label: 'Party Building', icon: <Sparkles size={16} color="#C084FC" /> },
    { id: 'peak', label: 'Peak Hour', icon: <Flame size={16} color="#FF0080" /> },
    { id: 'steady', label: 'Steady Groove', icon: <Layers size={16} color="var(--accent-emerald)" /> }
  ];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        maxWidth: '860px',
        margin: '0 auto',
        padding: '24px',
        gap: '24px'
      }}
    >
      {/* Vibe Selection & Quick Preset Toolbar */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
          borderRadius: 'var(--radius-full)'
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
          MIX VIBE:
        </span>
        {vibeOptions.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVibe(v.id as VibePreset)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: selectedVibe === v.id ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              backgroundColor: selectedVibe === v.id ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
              color: selectedVibe === v.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Hero Now Playing Card with Giant Album Art */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: '32px',
          padding: '28px',
          alignItems: 'center',
          borderColor: 'var(--border-glass)',
          boxShadow: isPlaying ? 'var(--shadow-glow-cyan)' : 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Album Artwork with Neon Vinyl Effect */}
        <div
          style={{
            width: '260px',
            height: '260px',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: '2px solid rgba(0, 242, 254, 0.3)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {currentTrack?.coverArtPath ? (
            <img
              src={`file://${currentTrack.coverArtPath}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-muted)'
              }}
            >
              <Disc
                size={84}
                color="var(--accent-cyan)"
                style={{
                  animation: isPlaying ? 'spin 6s linear infinite' : 'none'
                }}
              />
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>FLUXO DECK</span>
            </div>
          )}

          {/* Transition In-Flight Progress Badge */}
          {isTransitionActive && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Zap size={32} color="#00f2fe" className="pulse-indicator" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: '#00f2fe' }}>
                CROSSOVER IN PROGRESS
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {Math.round(transitionProgress * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Track Info & Intelligent Mixing Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Badge variant="cyan" size="sm">
                NOW PLAYING
              </Badge>
              {currentTrack?.bpm && <BpmBadge bpm={currentTrack.bpm} />}
              {currentTrack?.camelotCode && (
                <KeyBadge camelot={currentTrack.camelotCode} musicalKey={currentTrack.musicalKey} />
              )}
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 800,
                lineHeight: 1.2,
                color: 'var(--text-primary)',
                marginBottom: '4px'
              }}
            >
              {currentTrack?.title || 'No Track Playing'}
            </h1>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {currentTrack?.artist || 'Load a track to begin intelligent mixing'}
            </p>
          </div>

          {/* Timecode Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                height: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${activeDeck.duration > 0 ? (activeDeck.currentTime / activeDeck.duration) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta))',
                  transition: 'width 0.1s linear'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              <span>{formatTime(activeDeck.currentTime)}</span>
              <span>{formatTime(activeDeck.duration)}</span>
            </div>
          </div>

          {/* Standby / Upcoming Next Track Card */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color="var(--accent-purple)" />
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
                  UP NEXT IN QUEUE
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {nextTrack?.title || standbyDeck.currentTrack?.title || 'Automatic Queue Preloaded'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(nextTrack?.bpm || standbyDeck.currentTrack?.bpm) && (
                <BpmBadge bpm={nextTrack?.bpm ?? standbyDeck.currentTrack?.bpm} />
              )}
              {(nextTrack?.camelotCode || standbyDeck.currentTrack?.camelotCode) && (
                <KeyBadge camelot={nextTrack?.camelotCode ?? standbyDeck.currentTrack?.camelotCode} />
              )}
            </div>
          </div>

          {/* Prominent Intelligent Transition Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <Button
              variant="primary"
              size="lg"
              disabled={isTransitionActive}
              onClick={() => onTriggerTransition(selectedStyle)}
              leftIcon={<Zap size={18} />}
              style={{
                flex: 1,
                boxShadow: 'var(--shadow-glow-cyan)',
                fontSize: '14px',
                fontWeight: 700
              }}
            >
              {isTransitionActive ? 'TRANSITIONING...' : 'TRANSITION NOW'}
            </Button>

            {/* Transition Style Selector */}
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value as TransitionStyle)}
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="bass_swap">Bass Swap (Recommended)</option>
              <option value="blend">Smooth Blend</option>
              <option value="filter_sweep">Filter Sweep</option>
              <option value="echo_out">Echo Out</option>
              <option value="cut">Cut on the 1</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Playback Bar Controls */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Button
            variant="secondary"
            size="md"
            onClick={onPlayToggle}
            leftIcon={isPlaying ? <Pause size={18} /> : <Play size={18} />}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={onSkipNext}
            leftIcon={<SkipForward size={18} />}
          >
            SKIP
          </Button>
        </div>

        {/* Master Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '200px' }}>
          <Volume2 size={16} color="var(--text-muted)" />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={activeDeck.volume}
            onChange={onVolumeChange}
            accent="cyan"
          />
        </div>
      </div>
    </div>
  );
};
