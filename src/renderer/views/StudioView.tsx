import React, { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  Disc,
  Zap,
  Volume2,
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Cpu,
  Speaker,
  Activity,
  Music,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { RotaryKnob } from '../components/RotaryKnob';
import { Slider } from '../components/Slider';
import { Button } from '../components/Button';
import { KeyBadge, BpmBadge, Badge } from '../components/Badge';
import { ScrollingWaveformCanvas } from '../components/ScrollingWaveformCanvas';
import { CuePads } from '../components/CuePads';
import { LoopControls } from '../components/LoopControls';
import { EffectControls } from '../components/EffectControls';
import { StemMixer } from '../components/StemMixer';
import { TransitionWorkspace } from '../components/TransitionWorkspace';
import { StudioLibraryPanel } from '../components/StudioLibraryPanel';
import { TransitionPlanner, type TransitionFamily } from '../audio/TransitionPlanner';
import type { DjOperatingMode } from '../audio/DjStudioModeManager';
import type { LoopLength, LoopState } from '../audio/LoopController';
import type { EchoSyncBeat, EffectsState } from '../audio/AudioEffectsChain';
import type { StemPlayerState } from '../audio/StemDeckPlayer';
import type { CuePadSlot } from '../audio/CuePointManager';
import type { DeckState, Track } from '../../shared/types';
import type { TransitionStyle } from '../audio/TransitionEngine';

export interface StudioViewProps {
  deckA: DeckState;
  deckB: DeckState;
  onUpdateDeckA: (updates: Partial<DeckState>) => void;
  onUpdateDeckB: (updates: Partial<DeckState>) => void;
  crossfaderPos: number; // -1.0 (all Deck A) to +1.0 (all Deck B)
  onCrossfaderChange: (pos: number) => void;
  onTriggerTransition?: (style?: TransitionStyle) => void;
  onSyncDeck?: (targetDeckId: 'A' | 'B') => void;
  onPitchBend?: (deckId: 'A' | 'B', direction: 1 | -1) => void;
  onSeekDeckA?: (seconds: number) => void;
  onSeekDeckB?: (seconds: number) => void;
  isTransitionActive?: boolean;

  // Integrated Library & Audio Device Props
  libraryTracks?: Track[];
  onLoadTrackToDeckA?: (track: Track) => void;
  onLoadTrackToDeckB?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  audioOutputDevice?: string;
  onSelectAudioOutputDevice?: (deviceId: string) => void;
  audioDevices?: MediaDeviceInfo[];
  isAnalyzing?: boolean;
  analysisStatus?: string;

  // Phase 10 Hot Cues, Loops, Effects & Stems
  onActivateLoopA?: (beats: LoopLength) => void;
  onActivateLoopB?: (beats: LoopLength) => void;
  onToggleLoopA?: () => void;
  onToggleLoopB?: () => void;
  onHalveLoopA?: () => void;
  onDoubleLoopA?: () => void;
  onHalveLoopB?: () => void;
  onDoubleLoopB?: () => void;
  onJumpCueA?: (padIndex: number) => void;
  onJumpCueB?: (padIndex: number) => void;
  onSetCueA?: (padIndex: number) => void;
  onSetCueB?: (padIndex: number) => void;
  onDeleteCueA?: (padIndex: number) => void;
  onDeleteCueB?: (padIndex: number) => void;
  onSetEchoMixA?: (mix: number) => void;
  onSetEchoMixB?: (mix: number) => void;
  onSetFlangerMixA?: (mix: number) => void;
  onSetFlangerMixB?: (mix: number) => void;
  onSeparateStemsA?: () => void;
  onSeparateStemsB?: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  deckA,
  deckB,
  onUpdateDeckA,
  onUpdateDeckB,
  crossfaderPos,
  onCrossfaderChange,
  onTriggerTransition,
  onSyncDeck,
  onPitchBend,
  onSeekDeckA,
  onSeekDeckB,
  isTransitionActive = false,
  libraryTracks = [],
  onLoadTrackToDeckA,
  onLoadTrackToDeckB,
  onAddToQueue,
  audioOutputDevice = 'Default Speakers (WASAPI)',
  onSelectAudioOutputDevice,
  audioDevices = [],
  isAnalyzing = false,
  analysisStatus = 'System Ready',
  onActivateLoopA,
  onActivateLoopB,
  onToggleLoopA,
  onToggleLoopB,
  onHalveLoopA,
  onDoubleLoopA,
  onHalveLoopB,
  onDoubleLoopB,
  onJumpCueA,
  onJumpCueB,
  onSetCueA,
  onSetCueB,
  onDeleteCueA,
  onDeleteCueB,
  onSetEchoMixA,
  onSetEchoMixB,
  onSetFlangerMixA,
  onSetFlangerMixB,
  onSeparateStemsA,
  onSeparateStemsB
}) => {
  const [selectedStyle, setSelectedStyle] = useState<TransitionStyle>('bass_swap');
  const [selectedTransitionFamily, setSelectedTransitionFamily] = useState<TransitionFamily>('vocal_crossover');
  const [djMode, setDjMode] = useState<DjOperatingMode>('automatic');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [planner] = useState(() => new TransitionPlanner());

  const [deckATab, setDeckATab] = useState<'cues' | 'loops' | 'fx' | 'stems'>('cues');
  const [deckBTab, setDeckBTab] = useState<'cues' | 'loops' | 'fx' | 'stems'>('cues');

  const [loopStateA, setLoopStateA] = useState<LoopState>({
    isActive: false,
    lengthBeats: 4,
    startPosition: 0,
    endPosition: 0,
    duration: 0,
    hasLoopRegion: false
  });
  const [loopStateB, setLoopStateB] = useState<LoopState>({
    isActive: false,
    lengthBeats: 4,
    startPosition: 0,
    endPosition: 0,
    duration: 0,
    hasLoopRegion: false
  });

  const [cueSlotsA, setCueSlotsA] = useState<CuePadSlot[]>(
    new Array(8).fill(null).map((_, i) => ({ padIndex: i, cue: null, defaultColor: '#00F2FE' }))
  );
  const [cueSlotsB, setCueSlotsB] = useState<CuePadSlot[]>(
    new Array(8).fill(null).map((_, i) => ({ padIndex: i, cue: null, defaultColor: '#FE0979' }))
  );

  const [effectsStateA, setEffectsStateA] = useState<EffectsState>({
    echoEnabled: false,
    echoBeat: 0.5,
    echoMix: 0,
    echoFeedback: 0.45,
    flangerEnabled: false,
    flangerMix: 0,
    flangerRate: 0.5
  });
  const [effectsStateB, setEffectsStateB] = useState<EffectsState>({
    echoEnabled: false,
    echoBeat: 0.5,
    echoMix: 0,
    echoFeedback: 0.45,
    flangerEnabled: false,
    flangerMix: 0,
    flangerRate: 0.5
  });

  const [stemStateA, setStemStateA] = useState<StemPlayerState>({
    hasStems: false,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    vocalVolume: 1.0,
    instrumentalVolume: 1.0,
    isVocalMuted: false,
    isInstrumentalMuted: false,
    isVocalSolo: false,
    isInstrumentalSolo: false
  });
  const [stemStateB, setStemStateB] = useState<StemPlayerState>({
    hasStems: false,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    vocalVolume: 1.0,
    instrumentalVolume: 1.0,
    isVocalMuted: false,
    isInstrumentalMuted: false,
    isVocalSolo: false,
    isInstrumentalSolo: false
  });

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getEffectiveBpm = (deck: DeckState) => {
    const baseBpm = deck.currentTrack?.bpm ?? 128.0;
    return (baseBpm * deck.playbackRate).toFixed(1);
  };

  const getPitchPercent = (deck: DeckState) => {
    const pct = (deck.playbackRate - 1.0) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  const transitionPlan = useMemo(() => {
    if (!deckA.currentTrack || !deckB.currentTrack) return null;
    return planner.planTransition(
      deckA.currentTrack as any,
      deckA.currentTrack as any,
      deckB.currentTrack as any,
      deckB.currentTrack as any,
      null,
      null,
      stemStateA.hasStems,
      stemStateB.hasStems,
      selectedTransitionFamily
    );
  }, [
    deckA.currentTrack,
    deckB.currentTrack,
    selectedTransitionFamily,
    stemStateA.hasStems,
    stemStateB.hasStems
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
      {/* 0. Professional DJ Studio Top Bar */}
      <div
        data-testid="dj-studio-top-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          backdropFilter: 'blur(16px)'
        }}
      >
        {/* Session Name & Live Glow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--deck-a-primary)',
                boxShadow: '0 0 10px var(--deck-a-primary)'
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '14px',
                letterSpacing: '0.08em',
                color: '#ffffff'
              }}
            >
              LIVE AI DJ STUDIO
            </span>
          </div>

          {/* Operating Mode Selector */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            {(['automatic', 'assisted', 'manual'] as DjOperatingMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDjMode(mode)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  backgroundColor: djMode === mode ? 'var(--deck-a-primary)' : 'transparent',
                  color: djMode === mode ? '#0B0F19' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {mode === 'automatic' ? 'Auto DJ' : mode === 'assisted' ? 'Assisted' : 'Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Audio Device & Master VU Meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Speaker size={14} color="var(--deck-a-primary)" />
            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {audioOutputDevice}
            </span>
          </div>

          {/* Master VU Meter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Master Output Level">
            <Activity size={14} color="var(--text-muted)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '6px',
                    height: '14px',
                    borderRadius: '2px',
                    backgroundColor:
                      (deckA.isPlaying || deckB.isPlaying) && i < 6
                        ? '#10B981'
                        : (deckA.isPlaying || deckB.isPlaying) && i < 7
                        ? '#F59E0B'
                        : 'rgba(255, 255, 255, 0.1)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: CPU Load & Library Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--text-muted)',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Cpu size={12} color="var(--deck-a-primary)" />
            <span>CPU ~3.8% • 256 smp • 5.8ms</span>
          </div>

          <button
            onClick={() => setIsLibraryOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: isLibraryOpen ? '1px solid var(--deck-a-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: isLibraryOpen ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: isLibraryOpen ? 'var(--deck-a-primary)' : '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Music size={14} />
            <span>Library ({libraryTracks.length})</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Frame with Optional Library Drawer */}
      <div style={{ display: 'flex', gap: '14px', flex: 1, minHeight: 0 }}>
        {isLibraryOpen && (
          <StudioLibraryPanel
            tracks={libraryTracks}
            onLoadDeckA={(t) => onLoadTrackToDeckA?.(t)}
            onLoadDeckB={(t) => onLoadTrackToDeckB?.(t)}
            onAddToQueue={onAddToQueue}
            referenceBpm={deckA.currentTrack?.bpm || deckB.currentTrack?.bpm}
            referenceKey={deckA.currentTrack?.camelotCode || deckB.currentTrack?.camelotCode}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '14px', minWidth: 0, overflowY: 'auto' }}>
          {/* 1. Full-Width 60 FPS Scrolling Waveform Canvas (Stacked Deck A & B) */}
          <ScrollingWaveformCanvas
            deckA={deckA}
            deckB={deckB}
            height={140}
            onSeekDeckA={onSeekDeckA}
            onSeekDeckB={onSeekDeckB}
          />

          {/* 2. Dual Decks + Central Mixer Workspace */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px 1fr', gap: '14px', flexShrink: 0 }}>
        {/* ========================================================= */}
        {/* VIRTUAL DECK A PANEL                                      */}
        {/* ========================================================= */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--deck-a-border)',
            boxShadow: deckA.isPlaying ? 'var(--deck-a-glow)' : 'var(--shadow-sm)'
          }}
        >
          {/* Deck Header & Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--deck-a-primary)'
                }}
              >
                DECK A
              </span>
              <Disc
                size={18}
                color="var(--deck-a-primary)"
                className={deckA.isPlaying ? 'spin-vinyl' : ''}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {deckA.currentTrack?.camelotCode && (
                <KeyBadge
                  camelot={deckA.currentTrack.camelotCode}
                  musicalKey={deckA.currentTrack.musicalKey}
                />
              )}
              {deckA.currentTrack?.bpm && (
                <BpmBadge bpm={Number(getEffectiveBpm(deckA))} />
              )}
            </div>
          </div>

          {/* Track Details & Cover */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(0, 242, 254, 0.15)'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                flexShrink: 0
              }}
            >
              {deckA.currentTrack?.coverArtPath ? (
                <img
                  src={`file://${deckA.currentTrack.coverArtPath}`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Disc size={20} color="var(--deck-a-primary)" />
                </div>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--text-primary)'
                }}
              >
                {deckA.currentTrack?.title || 'No Track Loaded'}
              </h4>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {deckA.currentTrack?.artist || 'Load a track from library'}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--deck-a-primary)' }}>
              {formatTime(deckA.currentTime)}
            </span>
          </div>

          {/* 3-Band Linkwitz-Riley EQ & Filter Knobs with Kill Switches */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '6px 0',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <RotaryKnob
              label="HIGH"
              value={deckA.highGain}
              min={0}
              max={2}
              defaultValue={1.0}
              accent="cyan"
              onChange={(val) => onUpdateDeckA({ highGain: val })}
              onKillToggle={() => onUpdateDeckA({ highGain: deckA.highGain === 0 ? 1 : 0 })}
              isKilled={deckA.highGain === 0}
            />
            <RotaryKnob
              label="MID"
              value={deckA.midGain}
              min={0}
              max={2}
              defaultValue={1.0}
              accent="cyan"
              onChange={(val) => onUpdateDeckA({ midGain: val })}
              onKillToggle={() => onUpdateDeckA({ midGain: deckA.midGain === 0 ? 1 : 0 })}
              isKilled={deckA.midGain === 0}
            />
            <RotaryKnob
              label="LOW"
              value={deckA.lowGain}
              min={0}
              max={2}
              defaultValue={1.0}
              accent="cyan"
              onChange={(val) => onUpdateDeckA({ lowGain: val })}
              onKillToggle={() => onUpdateDeckA({ lowGain: deckA.lowGain === 0 ? 1 : 0 })}
              isKilled={deckA.lowGain === 0}
            />
            <RotaryKnob
              label="FILTER"
              value={deckA.filterFreq ? (deckA.filterFreq - 1000) / 1000 : 0}
              min={-1}
              max={1}
              defaultValue={0}
              accent="cyan"
              onChange={(val) => onUpdateDeckA({ filterFreq: 1000 + val * 1000 })}
            />
          </div>

          {/* Tempo Slider & Pitch Bend Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>TEMPO</span>
                <span style={{ color: 'var(--deck-a-primary)' }}>{getPitchPercent(deckA)}</span>
              </div>
              <Slider
                min={0.84}
                max={1.16}
                step={0.001}
                value={deckA.playbackRate}
                onChange={(val) => onUpdateDeckA({ playbackRate: val })}
                accent="cyan"
              />
            </div>

            {/* Pitch Bend Buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                title="Pitch Bend -"
                onMouseDown={() => onPitchBend && onPitchBend('A', -1)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0, 242, 254, 0.1)',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  color: 'var(--deck-a-primary)',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                -
              </button>
              <button
                title="Pitch Bend +"
                onMouseDown={() => onPitchBend && onPitchBend('A', 1)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0, 242, 254, 0.1)',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  color: 'var(--deck-a-primary)',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Primary Transport Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant={deckA.isPlaying ? 'primary' : 'secondary'}
              size="md"
              onClick={() => onUpdateDeckA({ isPlaying: !deckA.isPlaying })}
              leftIcon={deckA.isPlaying ? <Pause size={16} /> : <Play size={16} />}
              style={{ flex: 1, backgroundColor: deckA.isPlaying ? 'var(--deck-a-primary)' : undefined }}
            >
              {deckA.isPlaying ? 'PAUSE' : 'PLAY'}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => onUpdateDeckA({ currentTime: 0, isPlaying: true })}
            >
              CUE
            </Button>

            <Button
              variant="ghost"
              size="md"
              title="Sync tempo & downbeat to Deck B"
              onClick={() => onSyncDeck && onSyncDeck('A')}
            >
              SYNC
            </Button>
          </div>

          {/* Creative Performance Section: Hot Cues, Beat Loops, DSP Effects, Stem Isolation */}
          <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['cues', 'loops', 'fx', 'stems'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDeckATab(tab)}
                  data-testid={`deck-a-tab-${tab}`}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: deckATab === tab ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: deckATab === tab ? '1px solid var(--deck-a-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: deckATab === tab ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                    color: deckATab === tab ? 'var(--deck-a-primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {tab === 'cues' ? 'HOT CUES' : tab === 'loops' ? 'LOOPS' : tab === 'fx' ? 'DSP FX' : 'STEMS'}
                </button>
              ))}
            </div>

            {deckATab === 'cues' && (
              <CuePads
                deckId="A"
                slots={cueSlotsA}
                currentTime={deckA.currentTime}
                onJumpToCue={(idx) => {
                  onJumpCueA?.(idx);
                  const target = cueSlotsA[idx].cue?.timestamp;
                  if (target !== undefined) onSeekDeckA?.(target);
                }}
                onSetCue={(idx) => {
                  onSetCueA?.(idx);
                  setCueSlotsA((prev) => {
                    const next = [...prev];
                    next[idx] = {
                      ...next[idx],
                      cue: {
                        id: `cue_A_${idx}`,
                        trackId: deckA.currentTrack?.id || 'track-a',
                        name: `Hot Cue ${idx + 1}`,
                        timestamp: deckA.currentTime,
                        type: 'cue',
                        color: '#00F2FE'
                      }
                    };
                    return next;
                  });
                }}
                onDeleteCue={(idx) => {
                  onDeleteCueA?.(idx);
                  setCueSlotsA((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], cue: null };
                    return next;
                  });
                }}
              />
            )}

            {deckATab === 'loops' && (
              <LoopControls
                deckId="A"
                loopState={loopStateA}
                onActivateLoop={(len) => {
                  setLoopStateA((prev) => ({
                    ...prev,
                    isActive: true,
                    lengthBeats: len,
                    startPosition: deckA.currentTime,
                    endPosition: deckA.currentTime + len * (60 / (deckA.currentTrack?.bpm || 124))
                  }));
                  onActivateLoopA?.(len);
                }}
                onToggleLoop={() => {
                  setLoopStateA((prev) => ({ ...prev, isActive: !prev.isActive }));
                  onToggleLoopA?.();
                }}
                onHalveLoop={() => {
                  setLoopStateA((prev) => ({
                    ...prev,
                    lengthBeats: Math.max(0.25, prev.lengthBeats * 0.5) as LoopLength
                  }));
                  onHalveLoopA?.();
                }}
                onDoubleLoop={() => {
                  setLoopStateA((prev) => ({
                    ...prev,
                    lengthBeats: Math.min(32, prev.lengthBeats * 2) as LoopLength
                  }));
                  onDoubleLoopA?.();
                }}
              />
            )}

            {deckATab === 'fx' && (
              <EffectControls
                deckId="A"
                effectsState={effectsStateA}
                onSetEchoBeat={(b) => setEffectsStateA((prev) => ({ ...prev, echoBeat: b }))}
                onSetEchoMix={(m) => {
                  setEffectsStateA((prev) => ({ ...prev, echoMix: m, echoEnabled: m > 0.01 }));
                  onSetEchoMixA?.(m);
                }}
                onSetEchoFeedback={(f) => setEffectsStateA((prev) => ({ ...prev, echoFeedback: f }))}
                onSetFlangerMix={(m) => {
                  setEffectsStateA((prev) => ({ ...prev, flangerMix: m, flangerEnabled: m > 0.01 }));
                  onSetFlangerMixA?.(m);
                }}
                onSetFlangerRate={(r) => setEffectsStateA((prev) => ({ ...prev, flangerRate: r }))}
              />
            )}

            {deckATab === 'stems' && (
              <StemMixer
                deckId="A"
                stemState={stemStateA}
                onSeparateStems={() => {
                  onSeparateStemsA?.();
                  setStemStateA((prev) => ({ ...prev, hasStems: true }));
                }}
                onVocalVolumeChange={(v) => setStemStateA((prev) => ({ ...prev, vocalVolume: v }))}
                onInstrumentalVolumeChange={(v) => setStemStateA((prev) => ({ ...prev, instrumentalVolume: v }))}
                onVocalMuteToggle={() => setStemStateA((prev) => ({ ...prev, isVocalMuted: !prev.isVocalMuted }))}
                onInstrumentalMuteToggle={() => setStemStateA((prev) => ({ ...prev, isInstrumentalMuted: !prev.isInstrumentalMuted }))}
                onVocalSoloToggle={() => setStemStateA((prev) => ({ ...prev, isVocalSolo: !prev.isVocalSolo, isInstrumentalSolo: false }))}
                onInstrumentalSoloToggle={() => setStemStateA((prev) => ({ ...prev, isInstrumentalSolo: !prev.isInstrumentalSolo, isVocalSolo: false }))}
              />
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTRAL DJ MIXER & CROSSFADER PANEL                       */}
        {/* ========================================================= */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={16} color="var(--accent-cyan)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px' }}>
              MASTER MIXER
            </span>
          </div>

          {/* Dual Deck Level Meters */}
          <div style={{ display: 'flex', gap: '16px', height: '100px', alignItems: 'flex-end', padding: '10px 0' }}>
            {/* Deck A Meter */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '12px',
                  height: '80px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'flex-end'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${deckA.isPlaying ? Math.min(100, deckA.volume * 90) : 0}%`,
                    backgroundColor: 'var(--deck-a-primary)',
                    boxShadow: '0 0 8px var(--deck-a-primary)'
                  }}
                />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--deck-a-primary)' }}>A</span>
            </div>

            {/* Deck B Meter */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '12px',
                  height: '80px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'flex-end'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${deckB.isPlaying ? Math.min(100, deckB.volume * 90) : 0}%`,
                    backgroundColor: 'var(--deck-b-primary)',
                    boxShadow: '0 0 8px var(--deck-b-primary)'
                  }}
                />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--deck-b-primary)' }}>B</span>
            </div>
          </div>

          {/* Intelligent Transition Trigger & Style */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value as TransitionStyle)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="bass_swap">Bass Swap</option>
              <option value="blend">Smooth Blend</option>
              <option value="filter_sweep">Filter Sweep</option>
              <option value="echo_out">Echo Out</option>
              <option value="cut">Cut on the 1</option>
            </select>

            <Button
              variant="primary"
              size="sm"
              disabled={isTransitionActive}
              onClick={() => onTriggerTransition && onTriggerTransition(selectedStyle)}
              leftIcon={<Zap size={14} />}
              style={{ width: '100%', boxShadow: 'var(--shadow-glow-cyan)' }}
            >
              {isTransitionActive ? 'MIXING...' : 'MIX NOW'}
            </Button>
          </div>

          {/* Master Crossfader with Instant Cut Snaps */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              CROSSFADER
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button
                onClick={() => onCrossfaderChange(-1.0)}
                title="Cut to Deck A"
                style={{
                  background: 'none',
                  border: 'none',
                  color: crossfaderPos <= -0.9 ? 'var(--deck-a-primary)' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ◀ DECK A
              </button>
              <button
                onClick={() => onCrossfaderChange(0.0)}
                title="Center Crossfader"
                style={{
                  background: 'none',
                  border: 'none',
                  color: Math.abs(crossfaderPos) < 0.1 ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                CENTER
              </button>
              <button
                onClick={() => onCrossfaderChange(1.0)}
                title="Cut to Deck B"
                style={{
                  background: 'none',
                  border: 'none',
                  color: crossfaderPos >= 0.9 ? 'var(--deck-b-primary)' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                DECK B ▶
              </button>
            </div>

            <Slider
              min={-1}
              max={1}
              step={0.01}
              value={crossfaderPos}
              onChange={onCrossfaderChange}
              accent="purple"
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* VIRTUAL DECK B PANEL                                      */}
        {/* ========================================================= */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--deck-b-border)',
            boxShadow: deckB.isPlaying ? 'var(--deck-b-glow)' : 'var(--shadow-sm)'
          }}
        >
          {/* Deck Header & Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--deck-b-primary)'
                }}
              >
                DECK B
              </span>
              <Disc
                size={18}
                color="var(--deck-b-primary)"
                className={deckB.isPlaying ? 'spin-vinyl' : ''}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {deckB.currentTrack?.camelotCode && (
                <KeyBadge
                  camelot={deckB.currentTrack.camelotCode}
                  musicalKey={deckB.currentTrack.musicalKey}
                />
              )}
              {deckB.currentTrack?.bpm && (
                <BpmBadge bpm={Number(getEffectiveBpm(deckB))} />
              )}
            </div>
          </div>

          {/* Track Details & Cover */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 0, 128, 0.15)'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                flexShrink: 0
              }}
            >
              {deckB.currentTrack?.coverArtPath ? (
                <img
                  src={`file://${deckB.currentTrack.coverArtPath}`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Disc size={20} color="var(--deck-b-primary)" />
                </div>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--text-primary)'
                }}
              >
                {deckB.currentTrack?.title || 'No Track Loaded'}
              </h4>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {deckB.currentTrack?.artist || 'Load a track from library'}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--deck-b-primary)' }}>
              {formatTime(deckB.currentTime)}
            </span>
          </div>

          {/* 3-Band Linkwitz-Riley EQ & Filter Knobs with Kill Switches */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '6px 0',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <RotaryKnob
              label="HIGH"
              value={deckB.highGain}
              min={0}
              max={2}
              defaultValue={1.0}
              accent="magenta"
              onChange={(val) => onUpdateDeckB({ highGain: val })}
              onKillToggle={() => onUpdateDeckB({ highGain: deckB.highGain === 0 ? 1 : 0 })}
              isKilled={deckB.highGain === 0}
            />
            <RotaryKnob
              label="MID"
              value={deckB.midGain}
              min={0}
              max={2}
              defaultValue={1.0}
              accent="magenta"
              onChange={(val) => onUpdateDeckB({ midGain: val })}
              onKillToggle={() => onUpdateDeckB({ midGain: deckB.midGain === 0 ? 1 : 0 })}
              isKilled={deckB.midGain === 0}
            />
            <RotaryKnob
              label="LOW"
              value={deckB.lowGain}
              min={0}
              max={2}
              defaultValue={1.0}
              accent="magenta"
              onChange={(val) => onUpdateDeckB({ lowGain: val })}
              onKillToggle={() => onUpdateDeckB({ lowGain: deckB.lowGain === 0 ? 1 : 0 })}
              isKilled={deckB.lowGain === 0}
            />
            <RotaryKnob
              label="FILTER"
              value={deckB.filterFreq ? (deckB.filterFreq - 1000) / 1000 : 0}
              min={-1}
              max={1}
              defaultValue={0}
              accent="magenta"
              onChange={(val) => onUpdateDeckB({ filterFreq: 1000 + val * 1000 })}
            />
          </div>

          {/* Tempo Slider & Pitch Bend Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>TEMPO</span>
                <span style={{ color: 'var(--deck-b-primary)' }}>{getPitchPercent(deckB)}</span>
              </div>
              <Slider
                min={0.84}
                max={1.16}
                step={0.001}
                value={deckB.playbackRate}
                onChange={(val) => onUpdateDeckB({ playbackRate: val })}
                accent="magenta"
              />
            </div>

            {/* Pitch Bend Buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                title="Pitch Bend -"
                onMouseDown={() => onPitchBend && onPitchBend('B', -1)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 0, 128, 0.1)',
                  border: '1px solid rgba(255, 0, 128, 0.3)',
                  color: 'var(--deck-b-primary)',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                -
              </button>
              <button
                title="Pitch Bend +"
                onMouseDown={() => onPitchBend && onPitchBend('B', 1)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 0, 128, 0.1)',
                  border: '1px solid rgba(255, 0, 128, 0.3)',
                  color: 'var(--deck-b-primary)',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Primary Transport Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant={deckB.isPlaying ? 'primary' : 'secondary'}
              size="md"
              onClick={() => onUpdateDeckB({ isPlaying: !deckB.isPlaying })}
              leftIcon={deckB.isPlaying ? <Pause size={16} /> : <Play size={16} />}
              style={{ flex: 1, backgroundColor: deckB.isPlaying ? 'var(--deck-b-primary)' : undefined }}
            >
              {deckB.isPlaying ? 'PAUSE' : 'PLAY'}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => onUpdateDeckB({ currentTime: 0, isPlaying: true })}
            >
              CUE
            </Button>

            <Button
              variant="ghost"
              size="md"
              title="Sync tempo & downbeat to Deck A"
              onClick={() => onSyncDeck && onSyncDeck('B')}
            >
              SYNC
            </Button>
          </div>

          {/* Creative Performance Section: Hot Cues, Beat Loops, DSP Effects, Stem Isolation */}
          <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['cues', 'loops', 'fx', 'stems'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDeckBTab(tab)}
                  data-testid={`deck-b-tab-${tab}`}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: deckBTab === tab ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: deckBTab === tab ? '1px solid var(--deck-b-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: deckBTab === tab ? 'rgba(255, 0, 128, 0.15)' : 'transparent',
                    color: deckBTab === tab ? 'var(--deck-b-primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {tab === 'cues' ? 'HOT CUES' : tab === 'loops' ? 'LOOPS' : tab === 'fx' ? 'DSP FX' : 'STEMS'}
                </button>
              ))}
            </div>

            {deckBTab === 'cues' && (
              <CuePads
                deckId="B"
                slots={cueSlotsB}
                currentTime={deckB.currentTime}
                onJumpToCue={(idx) => {
                  onJumpCueB?.(idx);
                  const target = cueSlotsB[idx].cue?.timestamp;
                  if (target !== undefined) onSeekDeckB?.(target);
                }}
                onSetCue={(idx) => {
                  onSetCueB?.(idx);
                  setCueSlotsB((prev) => {
                    const next = [...prev];
                    next[idx] = {
                      ...next[idx],
                      cue: {
                        id: `cue_B_${idx}`,
                        trackId: deckB.currentTrack?.id || 'track-b',
                        name: `Hot Cue ${idx + 1}`,
                        timestamp: deckB.currentTime,
                        type: 'cue',
                        color: '#FE0979'
                      }
                    };
                    return next;
                  });
                }}
                onDeleteCue={(idx) => {
                  onDeleteCueB?.(idx);
                  setCueSlotsB((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], cue: null };
                    return next;
                  });
                }}
              />
            )}

            {deckBTab === 'loops' && (
              <LoopControls
                deckId="B"
                loopState={loopStateB}
                onActivateLoop={(len) => {
                  setLoopStateB((prev) => ({
                    ...prev,
                    isActive: true,
                    lengthBeats: len,
                    startPosition: deckB.currentTime,
                    endPosition: deckB.currentTime + len * (60 / (deckB.currentTrack?.bpm || 124))
                  }));
                  onActivateLoopB?.(len);
                }}
                onToggleLoop={() => {
                  setLoopStateB((prev) => ({ ...prev, isActive: !prev.isActive }));
                  onToggleLoopB?.();
                }}
                onHalveLoop={() => {
                  setLoopStateB((prev) => ({
                    ...prev,
                    lengthBeats: Math.max(0.25, prev.lengthBeats * 0.5) as LoopLength
                  }));
                  onHalveLoopB?.();
                }}
                onDoubleLoop={() => {
                  setLoopStateB((prev) => ({
                    ...prev,
                    lengthBeats: Math.min(32, prev.lengthBeats * 2) as LoopLength
                  }));
                  onDoubleLoopB?.();
                }}
              />
            )}

            {deckBTab === 'fx' && (
              <EffectControls
                deckId="B"
                effectsState={effectsStateB}
                onSetEchoBeat={(b) => setEffectsStateB((prev) => ({ ...prev, echoBeat: b }))}
                onSetEchoMix={(m) => {
                  setEffectsStateB((prev) => ({ ...prev, echoMix: m, echoEnabled: m > 0.01 }));
                  onSetEchoMixB?.(m);
                }}
                onSetEchoFeedback={(f) => setEffectsStateB((prev) => ({ ...prev, echoFeedback: f }))}
                onSetFlangerMix={(m) => {
                  setEffectsStateB((prev) => ({ ...prev, flangerMix: m, flangerEnabled: m > 0.01 }));
                  onSetFlangerMixB?.(m);
                }}
                onSetFlangerRate={(r) => setEffectsStateB((prev) => ({ ...prev, flangerRate: r }))}
              />
            )}

            {deckBTab === 'stems' && (
              <StemMixer
                deckId="B"
                stemState={stemStateB}
                onSeparateStems={() => {
                  onSeparateStemsB?.();
                  setStemStateB((prev) => ({ ...prev, hasStems: true }));
                }}
                onVocalVolumeChange={(v) => setStemStateB((prev) => ({ ...prev, vocalVolume: v }))}
                onInstrumentalVolumeChange={(v) => setStemStateB((prev) => ({ ...prev, instrumentalVolume: v }))}
                onVocalMuteToggle={() => setStemStateB((prev) => ({ ...prev, isVocalMuted: !prev.isVocalMuted }))}
                onInstrumentalMuteToggle={() => setStemStateB((prev) => ({ ...prev, isInstrumentalMuted: !prev.isInstrumentalMuted }))}
                onVocalSoloToggle={() => setStemStateB((prev) => ({ ...prev, isVocalSolo: !prev.isVocalSolo, isInstrumentalSolo: false }))}
                onInstrumentalSoloToggle={() => setStemStateB((prev) => ({ ...prev, isInstrumentalSolo: !prev.isInstrumentalSolo, isVocalSolo: false }))}
              />
            )}
          </div>
        </div>
      </div>

      {/* 3. Transition Workspace (Signature Visual Subsystem) */}
      <TransitionWorkspace
        trackA={deckA.currentTrack as any}
        trackB={deckB.currentTrack as any}
        plan={transitionPlan}
        progress={isTransitionActive ? 0.5 : 0.0}
        isActive={isTransitionActive}
        isAnalyzing={isAnalyzing}
        onTriggerTransition={() => onTriggerTransition?.(selectedTransitionFamily as any)}
        onSelectFamily={(fam) => {
          setSelectedTransitionFamily(fam);
          setSelectedStyle(fam as any);
        }}
      />
    </div>
  </div>
</div>
);
};
