/**
 * StudioLibraryPanel.tsx
 * Professional DJ Studio Left Panel: Integrated Music Library
 * Displays real accessible library & extracted YouTube cache tracks.
 * Features instant search, harmonic key/BPM filter pills, drag-and-drop onto Deck A or B,
 * and quick deck load buttons.
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Music,
  Disc,
  Plus,
  Play,
  ArrowRight,
  Filter,
  Check,
  Zap,
  SlidersHorizontal
} from 'lucide-react';
import { BpmBadge, KeyBadge, Badge } from './Badge';
import { Button } from './Button';
import type { Track } from '../../shared/types';

export interface StudioLibraryPanelProps {
  tracks: Track[];
  onLoadDeckA: (track: Track) => void;
  onLoadDeckB: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  referenceBpm?: number;
  referenceKey?: string;
  className?: string;
}

export const StudioLibraryPanel: React.FC<StudioLibraryPanelProps> = ({
  tracks,
  onLoadDeckA,
  onLoadDeckB,
  onAddToQueue,
  referenceBpm,
  referenceKey,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'bpm_match' | 'key_match'>('all');

  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      // 1. Text search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.bpm && t.bpm.toString().includes(q)) ||
        (t.key && t.key.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // 2. Filter mode
      if (filterMode === 'bpm_match' && referenceBpm && t.bpm) {
        const ratio = t.bpm / referenceBpm;
        const isClose =
          Math.abs(ratio - 1.0) <= 0.08 ||
          Math.abs(ratio - 0.5) <= 0.05 ||
          Math.abs(ratio - 2.0) <= 0.1;
        if (!isClose) return false;
      }

      if (filterMode === 'key_match' && referenceKey && t.key) {
        const refNum = parseInt(referenceKey, 10);
        const tNum = parseInt(t.key, 10);
        if (!isNaN(refNum) && !isNaN(tNum)) {
          const diff = Math.abs(refNum - tNum);
          const circ = Math.min(diff, 12 - diff);
          if (circ > 1) return false; // Only identical or adjacent
        }
      }

      return true;
    });
  }, [tracks, searchQuery, filterMode, referenceBpm, referenceKey]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      data-testid="studio-library-panel"
      className={`w-80 h-full bg-slate-900/95 border-r border-slate-800 flex flex-col backdrop-blur-xl shrink-0 ${className}`}
    >
      {/* Search & Header Strip */}
      <div className="p-3.5 border-b border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Studio Library ({tracks.length})
            </span>
          </div>
          {referenceBpm && (
            <span className="text-[10px] text-slate-400 font-mono">
              Ref: {Math.round(referenceBpm)} BPM {referenceKey ? `• ${referenceKey}` : ''}
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search title, artist, BPM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-colors ${
              filterMode === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('bpm_match')}
            disabled={!referenceBpm}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-30 ${
              filterMode === 'bpm_match'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            BPM Match
          </button>
          <button
            onClick={() => setFilterMode('key_match')}
            disabled={!referenceKey}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-30 ${
              filterMode === 'key_match'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Key Match
          </button>
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
        {filteredTracks.length > 0 ? (
          filteredTracks.map((track) => (
            <div
              key={track.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify(track));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              data-testid={`library-row-${track.id}`}
              className="p-2.5 rounded-xl hover:bg-slate-800/60 transition-all flex flex-col gap-1.5 group cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-700/60"
            >
              <div className="flex items-center gap-2.5">
                {/* Vinyl / Cover Art Thumbnail */}
                <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                  {track.coverArt ? (
                    <img src={track.coverArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                    {track.title}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{track.artist}</div>
                </div>

                <div className="text-[10px] font-mono text-slate-500">
                  {formatDuration(track.duration)}
                </div>
              </div>

              {/* Metadata Badges & Load Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  {track.bpm ? (
                    <BpmBadge bpm={track.bpm} size="sm" />
                  ) : (
                    <span className="text-[10px] text-slate-600 font-mono">-- BPM</span>
                  )}
                  {track.key ? (
                    <KeyBadge camelotKey={track.key} size="sm" />
                  ) : null}
                </div>

                {/* Quick Deck Load Action Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onLoadDeckA(track)}
                    title="Load to Deck A"
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition-colors border border-cyan-500/40"
                  >
                    Deck A
                  </button>
                  <button
                    onClick={() => onLoadDeckB(track)}
                    title="Load to Deck B"
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300 hover:bg-pink-500 hover:text-slate-950 transition-colors border border-pink-500/40"
                  >
                    Deck B
                  </button>
                  {onAddToQueue && (
                    <button
                      onClick={() => onAddToQueue(track)}
                      title="Add to Play Queue"
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
            <Music className="w-8 h-8 text-slate-700" />
            <p className="text-xs">
              {searchQuery ? 'No tracks match your query' : 'No local audio files or extracted tracks in library'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
