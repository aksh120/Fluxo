/**
 * AutopilotView.tsx
 * Fully Autonomous AI DJ Mixing Studio & Library Intelligence Hub.
 * Manages autonomous sessions, set planning, live waveform performance,
 * progressive analysis metrics, upcoming track sequences, and safe manual takeover.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
  Sliders,
  Sparkles,
  Radio,
  Layers,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  FastForward,
  Mic,
  Flame,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Compass,
  Music,
  Cpu
} from 'lucide-react';
import type { TrackMetadata, TrackAnalysis } from '../../shared/types';
import { ScrollingWaveformCanvas } from '../components/ScrollingWaveformCanvas';
import { AutopilotEngine } from '../audio/AutopilotEngine';
import { AutopilotMetricsService } from '../audio/AutopilotMetricsService';
import type {
  AutopilotState,
  AutopilotConfig,
  AutopilotEnergyProfile,
  PlannedSetItem,
  LibraryIntelligenceMetrics,
  TransitionUserFeedback,
  ProcessingQuality,
  TransitionComplexity
} from '../audio/AutopilotTypes';

export interface AutopilotViewProps {
  libraryTracks: TrackMetadata[];
  analyses?: Map<string, TrackAnalysis> | Record<string, TrackAnalysis>;
  isScanning?: boolean;
  onTakeoverToStudio?: (targetDeck: 'A' | 'B', track: TrackMetadata | null) => void;
}

export const AutopilotView: React.FC<AutopilotViewProps> = ({
  libraryTracks,
  analyses = new Map(),
  isScanning = false,
  onTakeoverToStudio
}) => {
  const engineRef = useRef<AutopilotEngine>(AutopilotEngine.getInstance());
  const engine = engineRef.current;

  // Local state
  const [engineState, setEngineState] = useState<AutopilotState>(engine.getState());
  const [config, setConfig] = useState<AutopilotConfig>(engine.getConfig());
  const [upcomingQueue, setUpcomingQueue] = useState<PlannedSetItem[]>(engine.getUpcomingQueue());
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(engine.getCurrentTrack());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeDeckId, setActiveDeckId] = useState<'A' | 'B'>(engine.getActiveDeckId());
  const [selectedFeedback, setSelectedFeedback] = useState<TransitionUserFeedback | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [sessionName] = useState('Main Room Autonomous Session');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  // Analyses map normalization
  const analysesMap = React.useMemo(() => {
    if (analyses instanceof Map) return analyses;
    const map = new Map<string, TrackAnalysis>();
    for (const [k, v] of Object.entries(analyses)) {
      map.set(k, v);
    }
    return map;
  }, [analyses]);

  // Genuine Library Intelligence Metrics
  const libraryMetrics: LibraryIntelligenceMetrics = React.useMemo(() => {
    return AutopilotMetricsService.calculateMetrics(libraryTracks, analysesMap, isScanning);
  }, [libraryTracks, analysesMap, isScanning]);

  // Sync library with engine
  useEffect(() => {
    engine.setLibrary(libraryTracks, analysesMap);
  }, [libraryTracks, analysesMap, engine]);

  // Subscribe to engine state & queue changes
  useEffect(() => {
    const unsubState = engine.onStateChange((s) => setEngineState(s));
    const unsubQueue = engine.onQueueChange((q) => setUpcomingQueue(q));

    return () => {
      unsubState();
      unsubQueue();
    };
  }, [engine]);

  // 60fps tracking loop for live timecode
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      const activeDeck = engine.getActiveDeckId();
      setActiveDeckId(activeDeck);
      setCurrentTrack(engine.getCurrentTrack());

      try {
        const audioState =
          activeDeck === 'A'
            ? (window as any).__fluxoAudioEngine?.deckA?.getState?.()
            : (window as any).__fluxoAudioEngine?.deckB?.getState?.();
        if (audioState) {
          setCurrentTime(audioState.currentTime || 0);
          setDuration(audioState.duration || 0);
          engine.checkAutoTransition(audioState.currentTime || 0, audioState.duration || 0);
        }
      } catch {
        // Fallback for test / headless environments
      }

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [engine]);

  // Handlers
  const handleToggleStartStop = async () => {
    if (engineState === 'playing' || engineState === 'transitioning' || engineState === 'ready') {
      engine.stopSession(true);
    } else {
      await engine.startSession();
    }
  };

  const handlePauseResume = () => {
    if (engineState === 'playing') {
      engine.pauseSession();
    } else if (engineState === 'paused') {
      engine.resumeSession();
    }
  };

  const handleSkip = () => {
    engine.skipTrack();
  };

  const handleLockToggle = (itemId: string, currentLock: boolean) => {
    engine.lockTrack(itemId, !currentLock);
  };

  const handleMoveQueue = (fromIndex: number, toIndex: number) => {
    engine.reorderQueue(fromIndex, toIndex);
  };

  const handleRemoveQueue = (itemId: string) => {
    engine.removeFromQueue(itemId);
  };

  const handleRegenerate = () => {
    engine.regenerateQueue();
  };

  const handleFeedback = (feedback: TransitionUserFeedback) => {
    setSelectedFeedback(feedback);
    engine.submitFeedback(feedback);
    setFeedbackToast(`Feedback noted: ${feedback.replace('_', ' ')}`);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleSafeTakeover = () => {
    const takeover = engine.takeoverToManual();
    if (onTakeoverToStudio) {
      onTakeoverToStudio(takeover.activeDeck, takeover.currentTrack);
    }
  };

  const handleEnergyProfileChange = (profile: AutopilotEnergyProfile) => {
    const updated = { ...config, energyProfile: profile };
    setConfig(updated);
    engine.updateConfig(updated);
  };

  const nextUpcoming = upcomingQueue[0];

  return (
    <div
      data-testid="autopilot-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-primary, #0B0F19)',
        color: 'var(--text-main, #F8FAFC)',
        overflowY: 'auto',
        padding: '20px 28px',
        gap: '20px',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* 1. Main Header */}
      <header
        data-testid="autopilot-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(18, 24, 38, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
            }}
          >
            <Compass size={24} color="#0B0F19" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                FLUXO AUTOPILOT
              </h1>
              <span
                data-testid="autopilot-state-badge"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 9px',
                  borderRadius: '20px',
                  backgroundColor:
                    engineState === 'playing'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : engineState === 'transitioning'
                      ? 'rgba(236, 72, 153, 0.2)'
                      : 'rgba(148, 163, 184, 0.2)',
                  color:
                    engineState === 'playing'
                      ? '#10B981'
                      : engineState === 'transitioning'
                      ? '#EC4899'
                      : '#94A3B8',
                  border:
                    engineState === 'playing'
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : engineState === 'transitioning'
                      ? '1px solid rgba(236, 72, 153, 0.4)'
                      : '1px solid rgba(148, 163, 184, 0.3)'
                }}
              >
                {engineState}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
              {sessionName} • Deck {activeDeckId} Active
            </div>
          </div>
        </div>

        {/* Audio Output & Quick Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#94A3B8',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            <Volume2 size={15} color="var(--accent-cyan, #00F2FE)" />
            <span>WASAPI 48kHz Stereo</span>
          </div>

          {/* Configuration drawer toggle */}
          <button
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: showConfigDrawer ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '8px 14px',
              color: showConfigDrawer ? 'var(--accent-cyan, #00F2FE)' : '#F8FAFC',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
          >
            <Sliders size={16} />
            <span>Config</span>
          </button>

          {/* Safe Takeover Action */}
          <button
            data-testid="autopilot-takeover-btn"
            onClick={handleSafeTakeover}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '10px',
              padding: '8px 14px',
              color: '#F59E0B',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
            title="Transfer live playback to manual DJ Studio control"
          >
            <ShieldAlert size={16} />
            <span>Takeover</span>
          </button>

          {/* Primary Start DJ / Stop DJ Button */}
          <button
            data-testid="autopilot-toggle-btn"
            onClick={handleToggleStartStop}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background:
                engineState === 'playing' || engineState === 'transitioning'
                  ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                  : 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
              color: engineState === 'playing' || engineState === 'transitioning' ? '#FFF' : '#0B0F19',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 22px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow:
                engineState === 'playing' || engineState === 'transitioning'
                  ? '0 0 20px rgba(239, 68, 68, 0.4)'
                  : '0 0 24px rgba(0, 242, 254, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {engineState === 'playing' || engineState === 'transitioning' ? (
              <>
                <Square size={16} fill="#FFF" />
                <span>Stop DJ</span>
              </>
            ) : (
              <>
                <Play size={16} fill="#0B0F19" />
                <span>Start DJ</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. Library Intelligence Panel */}
      <section
        data-testid="library-intelligence-panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          background: 'rgba(18, 24, 38, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '16px 20px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
            Discovered
          </span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>
            {libraryMetrics.totalDiscovered}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
            Indexed
          </span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#38BDF8' }}>
            {libraryMetrics.tracksIndexed}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
            Analysed
          </span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#10B981' }}>
            {libraryMetrics.tracksAnalysed}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
            Cached Stems
          </span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#EC4899' }}>
            {libraryMetrics.tracksWithStems}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
            Awaiting Deep
          </span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#F59E0B' }}>
            {libraryMetrics.tracksAwaitingDeepAnalysis}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
            Coverage
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#A78BFA' }}>
              {libraryMetrics.libraryCoveragePercent}%
            </span>
            <div
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${libraryMetrics.libraryCoveragePercent}%`,
                  backgroundColor: '#A78BFA'
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Session Configuration Drawer (Collapsible) */}
      {showConfigDrawer && (
        <section
          data-testid="autopilot-config-drawer"
          style={{
            background: 'rgba(18, 24, 38, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
              AUTOPILOT SESSION CONFIGURATION
            </h3>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Changes apply to next planned set</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Energy Arc Profile */}
            <div>
              <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                Energy Progression Arc
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['warmup', 'building', 'steady', 'peak', 'continuous', 'winddown'] as AutopilotEnergyProfile[]).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => handleEnergyProfileChange(p)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border:
                          config.energyProfile === p
                            ? '1px solid var(--accent-cyan, #00F2FE)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                        background:
                          config.energyProfile === p ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        color: config.energyProfile === p ? '#00F2FE' : '#94A3B8',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Vocal vs Instrumental Preference */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ color: '#94A3B8' }}>Vocal Crossover Priority</span>
                <span style={{ color: '#00F2FE', fontWeight: 600 }}>
                  {Math.round(config.vocalPreferenceRatio * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(config.vocalPreferenceRatio * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  const upd = { ...config, vocalPreferenceRatio: val };
                  setConfig(upd);
                  engine.updateConfig(upd);
                }}
                style={{ width: '100%', accentColor: 'var(--accent-cyan, #00F2FE)' }}
              />
            </div>

            {/* Processing Quality Mode */}
            <div>
              <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                Processing Quality / CPU Budget
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['low_resource', 'balanced', 'quality'] as ProcessingQuality[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      const upd = { ...config, processingQuality: mode };
                      setConfig(upd);
                      engine.updateConfig(upd);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border:
                        config.processingQuality === mode
                          ? '1px solid #10B981'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        config.processingQuality === mode
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(255, 255, 255, 0.04)',
                      color: config.processingQuality === mode ? '#10B981' : '#94A3B8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {mode.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Live Performance View (Current Playing & Waveform) */}
      <section
        data-testid="autopilot-live-performance"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '20px',
          background: 'rgba(18, 24, 38, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Left: Now Playing Track + Scrolling Waveform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#00F2FE', letterSpacing: '0.05em' }}>
              NOW PLAYING • DECK {activeDeckId}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')} /{' '}
                {Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {currentTrack?.coverArtPath ? (
              <img
                src={`file:///${currentTrack.coverArtPath.replace(/\\/g, '/')}`}
                alt={currentTrack.title}
                style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Music size={28} color="#94A3B8" />
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
              >
                {currentTrack ? currentTrack.title : 'No Track Loaded'}
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>
                {currentTrack ? currentTrack.artist : 'Waiting for Autopilot start'}
              </div>
            </div>
          </div>

          {/* Scrolling Real-Time Waveform */}
          <div
            style={{
              height: '80px',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            <ScrollingWaveformCanvas
              track={currentTrack}
              analysis={currentTrack ? analysesMap.get(currentTrack.id) : null}
              currentTime={currentTime}
              duration={duration}
              isPlaying={engineState === 'playing' || engineState === 'transitioning'}
              color="#00F2FE"
            />
          </div>

          {/* Live Transport Strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={handlePauseResume}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '8px 14px',
                color: '#FFF',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {engineState === 'paused' ? <Play size={15} /> : <Pause size={15} />}
              <span>{engineState === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              onClick={handleSkip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '8px 14px',
                color: '#FFF',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <SkipForward size={15} />
              <span>Skip Track</span>
            </button>

            {/* User feedback buttons */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', marginRight: '4px' }}>Mix Quality:</span>
              <button
                onClick={() => handleFeedback('good')}
                style={{
                  background: selectedFeedback === 'good' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border: selectedFeedback === 'good' ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '6px',
                  color: selectedFeedback === 'good' ? '#10B981' : '#94A3B8',
                  cursor: 'pointer'
                }}
                title="Good Mix"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => handleFeedback('bad')}
                style={{
                  background: selectedFeedback === 'bad' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border: selectedFeedback === 'bad' ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '6px',
                  color: selectedFeedback === 'bad' ? '#EF4444' : '#94A3B8',
                  cursor: 'pointer'
                }}
                title="Bad Mix"
              >
                <ThumbsDown size={14} />
              </button>
              <button
                onClick={() => handleFeedback('vocals_clashed')}
                style={{
                  background:
                    selectedFeedback === 'vocals_clashed' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border:
                    selectedFeedback === 'vocals_clashed'
                      ? '1px solid #F59E0B'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: selectedFeedback === 'vocals_clashed' ? '#F59E0B' : '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600
                }}
                title="Vocals Clashed"
              >
                Vocal Clash
              </button>
            </div>
          </div>
          {feedbackToast && (
            <div style={{ fontSize: '11px', color: '#10B981', textAlign: 'right' }}>{feedbackToast}</div>
          )}
        </div>

        {/* Right: Next Track Prepared & Transition Card */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#EC4899', letterSpacing: '0.05em' }}>
                NEXT UP • DECK {activeDeckId === 'A' ? 'B' : 'A'}
              </span>
              {nextUpcoming && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(236, 72, 153, 0.15)',
                    color: '#EC4899',
                    border: '1px solid rgba(236, 72, 153, 0.3)'
                  }}
                >
                  {nextUpcoming.plannedTransition?.family.replace('_', ' ') ?? 'Beatmix'}
                </span>
              )}
            </div>

            {nextUpcoming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {nextUpcoming.track.coverArtPath ? (
                  <img
                    src={`file:///${nextUpcoming.track.coverArtPath.replace(/\\/g, '/')}`}
                    alt={nextUpcoming.track.title}
                    style={{ width: '54px', height: '54px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Music size={22} color="#94A3B8" />
                  </div>
                )}
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}
                  >
                    {nextUpcoming.track.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                    {nextUpcoming.track.artist}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '13px' }}>No upcoming track in queue</div>
            )}
          </div>

          {/* Explanation Card */}
          {nextUpcoming?.plannedTransition && (
            <div
              style={{
                marginTop: '14px',
                background: 'rgba(236, 72, 153, 0.08)',
                border: '1px solid rgba(236, 72, 153, 0.2)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#F8FAFC',
                lineHeight: 1.4
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EC4899', fontWeight: 600 }}>
                <Sparkles size={14} />
                <span>Planned Transition</span>
              </div>
              <div style={{ marginTop: '4px', color: '#E2E8F0' }}>
                {nextUpcoming.plannedTransition.explanation}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. Upcoming Set (Queue Management & Locking) */}
      <section
        data-testid="upcoming-set-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'rgba(18, 24, 38, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              UPCOMING SET ({upcomingQueue.length} Tracks)
            </h2>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
              Autonomous lookahead sequence • Pinned tracks are preserved upon regeneration
            </span>
          </div>

          <button
            data-testid="regenerate-set-btn"
            onClick={handleRegenerate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '6px 14px',
              color: '#F8FAFC',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <RefreshCw size={14} />
            <span>Regenerate Set</span>
          </button>
        </div>

        {upcomingQueue.length === 0 ? (
          <div
            style={{
              padding: '30px',
              textAlign: 'center',
              color: '#94A3B8',
              fontSize: '13px'
            }}
          >
            No tracks in upcoming set. Click Start DJ or add tracks to library.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {upcomingQueue.map((item, index) => {
              const analysis = analysesMap.get(item.track.id);
              return (
                <div
                  key={item.id}
                  data-testid={`set-item-${item.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: item.isLocked ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    border: item.isLocked
                      ? '1px solid rgba(0, 242, 254, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '10px 16px'
                  }}
                >
                  {/* Left: Position, Art, Track Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', width: '20px' }}>
                      #{index + 1}
                    </span>

                    {item.track.coverArtPath ? (
                      <img
                        src={`file:///${item.track.coverArtPath.replace(/\\/g, '/')}`}
                        alt={item.track.title}
                        style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Music size={18} color="#94A3B8" />
                      </div>
                    )}

                    <div style={{ overflow: 'hidden', paddingRight: '12px' }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}
                      >
                        {item.track.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94A3B8' }}>{item.track.artist}</div>
                    </div>
                  </div>

                  {/* Middle: Badges (BPM, Key, Transition Family, Readiness) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '16px' }}>
                    {analysis?.bpm && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#F8FAFC'
                        }}
                      >
                        {Math.round(analysis.bpm)} BPM
                      </span>
                    )}

                    {analysis?.camelotCode && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          color: '#A78BFA'
                        }}
                      >
                        {analysis.camelotCode}
                      </span>
                    )}

                    {item.plannedTransition && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(236, 72, 153, 0.15)',
                          color: '#EC4899'
                        }}
                      >
                        {item.plannedTransition.family.replace('_', ' ')}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor:
                          item.readinessStatus === 'ready'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : item.readinessStatus === 'fallback_ready'
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color:
                          item.readinessStatus === 'ready'
                            ? '#10B981'
                            : item.readinessStatus === 'fallback_ready'
                            ? '#38BDF8'
                            : '#F59E0B'
                      }}
                    >
                      {item.readinessStatus === 'ready'
                        ? 'Stems Ready'
                        : item.readinessStatus === 'fallback_ready'
                        ? 'Beatmix Ready'
                        : 'Analyzing'}
                    </span>
                  </div>

                  {/* Right: Actions (Lock Pin, Move Up/Down, Remove) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => handleLockToggle(item.id, item.isLocked)}
                      style={{
                        background: item.isLocked ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        color: item.isLocked ? '#00F2FE' : '#94A3B8',
                        cursor: 'pointer'
                      }}
                      title={item.isLocked ? 'Unlock track' : 'Pin track position'}
                    >
                      {item.isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>

                    <button
                      disabled={index === 0}
                      onClick={() => handleMoveQueue(index, index - 1)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '6px',
                        color: index === 0 ? '#475569' : '#94A3B8',
                        cursor: index === 0 ? 'default' : 'pointer'
                      }}
                      title="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>

                    <button
                      disabled={index === upcomingQueue.length - 1}
                      onClick={() => handleMoveQueue(index, index + 1)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '6px',
                        color: index === upcomingQueue.length - 1 ? '#475569' : '#94A3B8',
                        cursor: index === upcomingQueue.length - 1 ? 'default' : 'pointer'
                      }}
                      title="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>

                    <button
                      onClick={() => handleRemoveQueue(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '6px',
                        color: '#EF4444',
                        cursor: 'pointer'
                      }}
                      title="Remove from set"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
