import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Flame,
  Radio,
  Pin,
  Maximize2,
  Minimize2,
  SkipForward,
  Play,
  Pause,
  Music,
  Clock,
  Disc3
} from 'lucide-react';
import { Button } from '../components/Button';
import { KeyBadge, BpmBadge } from '../components/Badge';
import type { TrackMetadata } from '../../shared/types';
import type { QueueItem } from '../state/QueueManager';
import { EnergyProfileType, ENERGY_PROFILES } from '../../shared/dj/EnergyFlowOrchestrator';
import { calculateTrackCompatibility } from '../../shared/dj/compatibility';

export interface PartyModeViewProps {
  currentTrack?: TrackMetadata | null;
  nextTrack?: TrackMetadata | null;
  upcomingTracks?: QueueItem[];
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  isTransitioning?: boolean;
  onTriggerTransition: () => void;
  onSkipNext?: () => void;
  onTogglePlay?: () => void;
  onPinTrack?: (itemId: string) => void;
  onSelectVibe?: (vibe: EnergyProfileType) => void;
  activeProfile?: EnergyProfileType;
}

export const PartyModeView: React.FC<PartyModeViewProps> = ({
  currentTrack,
  nextTrack,
  upcomingTracks = [],
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  isTransitioning = false,
  onTriggerTransition,
  onSkipNext,
  onTogglePlay,
  onPinTrack,
  onSelectVibe,
  activeProfile = 'building'
}) => {
  const [selectedVibe, setSelectedVibe] = useState<EnergyProfileType>(activeProfile);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync internal vibe state with prop if it changes
  useEffect(() => {
    setSelectedVibe(activeProfile);
  }, [activeProfile]);

  const handleVibeChange = (vibe: EnergyProfileType) => {
    setSelectedVibe(vibe);
    onSelectVibe?.(vibe);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Ambient audio-reactive backdrop canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);

      // Pulsing energy rings based on playhead & play state
      const centerX = width * 0.5;
      const centerY = height * 0.45;
      const baseRadius = Math.min(width, height) * 0.22;
      const pulseSpeed = isPlaying ? 0.05 : 0.01;
      phase += pulseSpeed;

      const ringCount = 5;
      for (let i = 0; i < ringCount; i++) {
        const ringPhase = phase + i * 0.8;
        const radius = baseRadius + Math.sin(ringPhase) * 24 + i * 45;
        const alpha = Math.max(0.02, 0.18 - i * 0.035);

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, radius), 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? `rgba(0, 242, 254, ${alpha})` : `rgba(254, 9, 121, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Energy spectrum wave bars at bottom
      const barCount = 48;
      const barWidth = width / barCount;
      for (let b = 0; b < barCount; b++) {
        const norm = b / barCount;
        const wave = Math.sin(phase * 1.5 + norm * Math.PI * 4);
        const barHeight = isPlaying
          ? Math.abs(wave) * 45 + Math.sin(phase * 3 + b) * 15 + 10
          : 6;
        const x = b * barWidth;
        const y = height - barHeight;

        const grad = ctx.createLinearGradient(x, y, x, height);
        grad.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
        grad.addColorStop(1, 'rgba(254, 9, 121, 0.05)');

        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
      }

      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 800;
        canvas.height = canvas.parentElement?.clientHeight || 600;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  // Calculate remaining time & transition countdown
  const timeRemaining = Math.max(0, (duration || 0) - currentTime);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const formattedCountdown = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isTransitionWindow = duration > 0 && timeRemaining <= 32;

  // Fallback demo queue if upcomingTracks is empty
  const displayQueue: Array<{
    id: string;
    pos: number;
    title: string;
    artist: string;
    bpm: number;
    key: string;
    isPinned: boolean;
    compatibility: number;
  }> =
    upcomingTracks.length > 0
      ? upcomingTracks.slice(0, 6).map((item, idx) => {
          let compatScore = 0.92;
          if (currentTrack) {
            const result = calculateTrackCompatibility(currentTrack, item.track);
            compatScore = result.totalScore;
          }
          return {
            id: item.id,
            pos: idx + 1,
            title: item.track.title,
            artist: item.track.artist,
            bpm: item.track.bpm || 124,
            key: item.track.camelotCode || '8A',
            isPinned: Boolean(item.isPinned),
            compatibility: Math.round(compatScore * 100)
          };
        })
      : [];

  const partyVibes = [
    { id: 'steady', ...ENERGY_PROFILES.steady, icon: <Radio size={18} /> },
    { id: 'building', ...ENERGY_PROFILES.building, icon: <Flame size={18} /> },
    { id: 'wave', ...ENERGY_PROFILES.wave, icon: <Sparkles size={18} /> },
    { id: 'peak', ...ENERGY_PROFILES.peak, icon: <Zap size={18} /> }
  ] as const;

  return (
    <div
      ref={containerRef}
      className={isFullscreen ? 'party-fullscreen' : ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '20px',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1000 : 'auto',
        backgroundColor: isFullscreen ? 'var(--bg-primary)' : 'transparent',
        padding: isFullscreen ? '32px 48px' : '0',
        overflowY: 'auto'
      }}
    >
      {/* Ambient Audio-Reactive Canvas Backdrop */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.35,
          pointerEvents: 'none'
        }}
      />

      {/* Hero Party DJ Status & Control Center */}
      <div
        className="glass-panel"
        style={{
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
          background: isTransitioning
            ? 'radial-gradient(ellipse at top, rgba(254, 9, 121, 0.22), transparent 70%), var(--glass-card)'
            : 'radial-gradient(ellipse at top right, rgba(0, 242, 254, 0.16), transparent 70%), var(--glass-card)',
          border: isTransitioning
            ? '1px solid var(--accent-magenta)'
            : '1px solid var(--border-glass-hover)',
          boxShadow: isTransitioning ? '0 0 30px rgba(254, 9, 121, 0.25)' : 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
          {/* Active Track Focus */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '320px' }}>
            {/* Spinning Neon Vinyl Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '2px solid var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPlaying ? '0 0 20px rgba(0, 242, 254, 0.4)' : 'none',
                animation: isPlaying ? 'spin 6s linear infinite' : 'none'
              }}
            >
              <Disc3 size={32} color={isTransitioning ? 'var(--accent-magenta)' : 'var(--accent-cyan)'} />
            </div>

            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isTransitioning ? 'var(--accent-magenta)' : 'var(--accent-cyan)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '4px'
                }}
              >
                <Radio size={13} className={isPlaying ? 'pulse-beat' : ''} />
                <span>
                  AUTONOMOUS PARTY DJ ACTIVE
                  {isTransitioning ? ' • TRANSITIONING' : !isPlaying ? ' • STANDBY' : ''}
                </span>
              </div>

              <h2
                className="display-title"
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '480px'
                }}
              >
                {currentTrack ? currentTrack.title : 'Every song. One continuous flow.'}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {currentTrack ? currentTrack.artist : 'Select a party vibe to begin autonomous mixing'}
                </span>
                {currentTrack?.bpm && <BpmBadge bpm={currentTrack.bpm} />}
                {currentTrack?.camelotCode && <KeyBadge camelot={currentTrack.camelotCode} />}
              </div>
            </div>
          </div>

          {/* Emergency Controls: Mix Now & Quick Skip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Auto-Transition Countdown Readout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isTransitionWindow ? 'rgba(254, 9, 121, 0.15)' : 'rgba(0, 0, 0, 0.35)',
                border: isTransitionWindow ? '1px solid rgba(254, 9, 121, 0.4)' : '1px solid var(--border-subtle)',
                color: isTransitionWindow ? 'var(--accent-magenta)' : 'var(--text-secondary)'
              }}
            >
              <Clock size={16} className={isTransitionWindow ? 'pulse-beat' : ''} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  {isTransitioning ? 'Mix State' : 'Next Auto-Mix'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isTransitioning ? 'CROSSFADING' : formattedCountdown}
                </span>
              </div>
            </div>

            {/* Play/Pause Button */}
            {onTogglePlay && (
              <Button
                variant="ghost"
                size="md"
                onClick={onTogglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </Button>
            )}

            {/* Emergency Skip Button */}
            <Button
              variant="secondary"
              size="lg"
              onClick={onSkipNext}
              disabled={isTransitioning}
              leftIcon={<SkipForward size={18} />}
              title="Clean cut skip to next track"
            >
              SKIP
            </Button>

            {/* Emergency "MIX NOW" Transition Button */}
            <Button
              variant="primary"
              size="lg"
              onClick={onTriggerTransition}
              disabled={isTransitioning}
              leftIcon={<Zap size={18} className={isTransitioning ? 'pulse-beat' : ''} />}
              style={{
                boxShadow: isTransitioning ? '0 0 25px rgba(254, 9, 121, 0.6)' : 'var(--shadow-glow-cyan)',
                fontWeight: 800,
                letterSpacing: '0.05em'
              }}
            >
              {isTransitioning ? 'MIXING NOW...' : 'MIX NOW'}
            </Button>

            {/* Fullscreen Toggle */}
            <button
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Party Mode'}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Energy Profile / Party Mood Selector Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="section-title">
            Party Vibe Profile
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Auto-sequences queue energy curves without remote cloud AI
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {partyVibes.map((v) => {
            const isSelected = selectedVibe === v.id;
            return (
              <div
                key={v.id}
                onClick={() => handleVibeChange(v.id as EnergyProfileType)}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '18px',
                  cursor: 'pointer',
                  position: 'relative',
                  borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-glass)',
                  boxShadow: isSelected ? 'var(--shadow-glow-cyan)' : 'var(--shadow-sm)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.08), transparent 70%), var(--glass-card)'
                    : 'var(--glass-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                    {v.icon}
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px' }}>
                      {v.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: 'var(--accent-cyan)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-xs)'
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {v.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Auto-Sequenced Queue Preview */}
      <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div className="section-title">Upcoming Flow & Harmonic Mix Sequence</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Pinned tracks keep fixed positions; remaining tracks auto-align harmonically
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-cyan)',
                backgroundColor: 'rgba(0, 242, 254, 0.1)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid rgba(0, 242, 254, 0.25)'
              }}
            >
              Hands-Free Auto-DJ
            </span>
          </div>
        </div>

        {/* Sequenced Queue Tracks List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
          {displayQueue.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
                color: 'var(--text-muted)',
                fontSize: '13px',
                textAlign: 'center'
              }}
            >
              Queue is currently empty. Add tracks from your Music Library or YouTube to start autonomous party mixing.
            </div>
          ) : (
            displayQueue.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: item.isPinned ? 'rgba(0, 242, 254, 0.05)' : 'rgba(0, 0, 0, 0.25)',
                border: item.isPinned ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid var(--border-subtle)',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: item.isPinned ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    width: '24px',
                    fontWeight: 700
                  }}
                >
                  #{item.pos}
                </span>

                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Music size={18} color="var(--text-muted)" />
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {item.artist}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <KeyBadge camelot={item.key} />
                <BpmBadge bpm={item.bpm} />

                {/* Compatibility match rating */}
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: item.compatibility >= 90 ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                    backgroundColor:
                      item.compatibility >= 90 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 242, 254, 0.1)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-xs)',
                    border:
                      item.compatibility >= 90
                        ? '1px solid rgba(16, 185, 129, 0.25)'
                        : '1px solid rgba(0, 242, 254, 0.25)'
                  }}
                >
                  {item.compatibility}% Match
                </span>

                {/* Pin Track Button */}
                {onPinTrack && (
                  <button
                    onClick={() => onPinTrack(item.id)}
                    title={item.isPinned ? 'Unpin from position' : 'Pin to position'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: item.isPinned ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Pin size={16} fill={item.isPinned ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
};
