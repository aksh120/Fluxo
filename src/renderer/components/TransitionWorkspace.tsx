/**
 * TransitionWorkspace.tsx
 * Signature visual component for Fluxo DJ Studio
 * Renders shared dual-track aligned timeline, phrase grids, vocal activity overlays,
 * bass/vocal handoff markers, transition family selector, and human-readable plan explanation.
 */

import React from 'react';
import {
  Sparkles,
  Zap,
  Mic,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import type { Track } from '../../shared/types';
import type { TransitionPlan, TransitionFamily } from '../audio/TransitionPlanner';

export interface TransitionWorkspaceProps {
  trackA: Track | null;
  trackB: Track | null;
  plan: TransitionPlan | null;
  progress: number; // 0.0 to 1.0
  isActive: boolean;
  isAnalyzing?: boolean;
  onTriggerTransition: () => void;
  onSelectFamily: (family: TransitionFamily) => void;
  onCancelTransition?: () => void;
  onPreviewTransition?: () => void;
}

const FAMILIES: { id: TransitionFamily; label: string; icon: string }[] = [
  { id: 'vocal_crossover', label: 'Vocal Crossover', icon: '🎤' },
  { id: 'bass_swap', label: 'Bass Swap', icon: '⚡' },
  { id: 'phrase_beatmix', label: 'Phrase Beatmix', icon: '🎚️' },
  { id: 'instrumental_handoff', label: 'Inst. Handoff', icon: '🥁' },
  { id: 'breakdown_build', label: 'Breakdown / Build', icon: '📈' },
  { id: 'drop_transition', label: 'Drop Punch', icon: '💥' },
  { id: 'echo_out', label: 'Echo Out', icon: '🌊' }
];

export const TransitionWorkspace: React.FC<TransitionWorkspaceProps> = ({
  trackA,
  trackB,
  plan,
  progress,
  isActive,
  isAnalyzing = false,
  onTriggerTransition,
  onSelectFamily,
  onCancelTransition,
  onPreviewTransition
}) => {
  const hasBothTracks = Boolean(trackA && trackB);

  // Confidence styling
  const confidencePct = plan ? Math.round(plan.confidence * 100) : 0;
  const confidenceColor =
    confidencePct >= 85 ? 'text-emerald-400' : confidencePct >= 70 ? 'text-yellow-400' : 'text-rose-400';

  return (
    <div
      data-testid="transition-workspace"
      className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-2xl flex flex-col gap-4 text-white"
    >
      {/* Workspace Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-wide flex items-center gap-2">
              Transition Workspace
              {isActive && (
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full animate-pulse">
                  Mixing Live ({Math.round(progress * 100)}%)
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              AI-assisted phrase matching, vocal activity analysis & frequency management
            </p>
          </div>
        </div>

        {/* Confidence & Analysis Status */}
        <div className="flex items-center gap-3">
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/50">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Analyzing Stems & Phrasing...</span>
            </div>
          )}

          {plan && hasBothTracks && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
              <span className="text-slate-400">Match Confidence:</span>
              <span className={`font-bold ${confidenceColor}`}>{confidencePct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Dual Timeline Canvas */}
      <div className="relative w-full h-32 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between p-3">
        {hasBothTracks ? (
          <>
            {/* Track A Strip (Outgoing - Cyan) */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase w-14 truncate">
                Deck A
              </span>
              <div className="relative flex-1 h-10 bg-slate-900 rounded-md overflow-hidden border border-slate-800">
                {/* Simulated waveform peak blocks */}
                <div className="absolute inset-0 flex items-center justify-around opacity-40 px-2">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-cyan-400 rounded-full"
                      style={{ height: `${20 + ((i * 17) % 70)}%` }}
                    />
                  ))}
                </div>

                {/* Vocal Region Overlay */}
                <div
                  className="absolute top-0 bottom-0 bg-purple-500/25 border-x border-purple-400/50 flex items-center justify-center text-[9px] text-purple-200 font-semibold"
                  style={{ left: '20%', width: '55%' }}
                >
                  <Mic className="w-3 h-3 mr-1 text-purple-300" />
                  Active Vocal Phrase
                </div>

                {/* Transition Out Region Bracket */}
                <div
                  className="absolute top-0 bottom-0 bg-cyan-500/20 border-r-2 border-cyan-400 flex items-center justify-end pr-2 text-[9px] text-cyan-300 font-bold"
                  style={{ left: '60%', width: '38%' }}
                >
                  Outgoing Mix
                </div>
              </div>
            </div>

            {/* Overlap & Handoff Indicators */}
            <div className="relative w-full h-5 flex items-center">
              {/* Bass Swap Marker */}
              <div
                className="absolute flex items-center gap-1 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/60 text-[9px] font-bold text-amber-300 shadow-sm"
                style={{ left: '70%' }}
              >
                <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                Bass Swap
              </div>

              {/* Vocal Handoff Marker */}
              <div
                className="absolute flex items-center gap-1 -translate-x-1/2 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/60 text-[9px] font-bold text-purple-300 shadow-sm"
                style={{ left: '80%' }}
              >
                <Mic className="w-2.5 h-2.5 text-purple-400" />
                Vocal Handoff
              </div>

              {/* Active playback crossfader cursor */}
              {isActive && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white] z-10 transition-all duration-75"
                  style={{ left: `${60 + progress * 35}%` }}
                />
              )}
            </div>

            {/* Track B Strip (Incoming - Magenta) */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-wider text-pink-400 uppercase w-14 truncate">
                Deck B
              </span>
              <div className="relative flex-1 h-10 bg-slate-900 rounded-md overflow-hidden border border-slate-800">
                {/* Waveform peaks */}
                <div className="absolute inset-0 flex items-center justify-around opacity-40 px-2">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-pink-400 rounded-full"
                      style={{ height: `${20 + ((i * 23) % 75)}%` }}
                    />
                  ))}
                </div>

                {/* Instrumental Intro Lead-in */}
                <div
                  className="absolute top-0 bottom-0 bg-cyan-500/25 border-r border-cyan-400/50 flex items-center pl-2 text-[9px] text-cyan-200 font-semibold"
                  style={{ left: '0%', width: '45%' }}
                >
                  Clean Instrumental
                </div>

                {/* Incoming Vocal Enter point */}
                <div
                  className="absolute top-0 bottom-0 bg-pink-500/25 border-x border-pink-400/50 flex items-center justify-center text-[9px] text-pink-200 font-semibold"
                  style={{ left: '45%', width: '50%' }}
                >
                  <Mic className="w-3 h-3 mr-1 text-pink-300" />
                  Incoming Vocal Phrase
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1">
            <Sliders className="w-6 h-6 text-slate-600" />
            <span className="text-xs">Load tracks into both Deck A and Deck B to plan transition</span>
          </div>
        )}
      </div>

      {/* Dynamic Explanation Card */}
      {plan && hasBothTracks && (
        <div
          data-testid="plan-explanation-card"
          className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-3"
        >
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-0.5">
              Plan Analysis • {plan.family.replace('_', ' ').toUpperCase()} ({plan.timing.durationBars} Bars)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{plan.explanation}</p>
          </div>
        </div>
      )}

      {/* Transition Family Picker Strip */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Transition Style Family
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {FAMILIES.map((fam) => {
            const isSelected = plan?.family === fam.id;
            return (
              <button
                key={fam.id}
                onClick={() => onSelectFamily(fam.id)}
                disabled={!hasBothTracks || isActive}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span>{fam.icon}</span>
                <span>{fam.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Transport Triggers */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Timing Window:</span>
          <span className="font-mono text-slate-200">
            {plan ? `${Math.round(plan.timing.durationSeconds)}s (${plan.timing.durationBars} bars)` : '16 bars'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onPreviewTransition && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviewTransition}
              disabled={!hasBothTracks || isActive}
            >
              Audition Preview
            </Button>
          )}

          {isActive ? (
            <Button variant="danger" size="sm" onClick={onCancelTransition}>
              Cancel Transition
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onTriggerTransition}
              disabled={!hasBothTracks}
              className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold px-5 shadow-lg shadow-cyan-500/25"
            >
              <Zap className="w-4 h-4 mr-1.5 fill-slate-950" />
              Execute DJ Transition
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
