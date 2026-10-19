import React from 'react';
import { X, Plus } from 'lucide-react';
import type { CuePadSlot } from '../audio/CuePointManager';

export interface CuePadsProps {
  deckId: 'A' | 'B';
  slots: CuePadSlot[];
  currentTime?: number;
  onJumpToCue: (padIndex: number) => void;
  onSetCue: (padIndex: number) => void;
  onDeleteCue: (padIndex: number) => void;
}

export const CuePads: React.FC<CuePadsProps> = ({
  deckId,
  slots,
  onJumpToCue,
  onSetCue,
  onDeleteCue
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          HOT CUES (1 - 8)
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Click to jump • Shift-Click to clear
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px'
        }}
      >
        {slots.map((slot) => {
          const isAssigned = slot.cue !== null;
          const color = isAssigned && slot.cue?.color ? slot.cue.color : slot.defaultColor;

          return (
            <button
              key={slot.padIndex}
              data-testid={`cue-pad-${deckId}-${slot.padIndex + 1}`}
              onClick={(e) => {
                if (e.shiftKey) {
                  onDeleteCue(slot.padIndex);
                } else if (isAssigned) {
                  onJumpToCue(slot.padIndex);
                } else {
                  onSetCue(slot.padIndex);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onDeleteCue(slot.padIndex);
              }}
              title={
                isAssigned
                  ? `${slot.cue?.name}: ${formatTime(slot.cue?.timestamp || 0)} (Shift-Click to delete)`
                  : `Set Hot Cue ${slot.padIndex + 1}`
              }
              style={{
                position: 'relative',
                height: '46px',
                borderRadius: 'var(--radius-sm)',
                border: isAssigned ? `1.5px solid ${color}` : '1px solid var(--border-subtle)',
                backgroundColor: isAssigned ? `${color}20` : 'rgba(0, 0, 0, 0.3)',
                boxShadow: isAssigned ? `0 0 12px ${color}35` : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isAssigned ? color : 'var(--text-muted)'
                  }}
                >
                  {slot.padIndex + 1}
                </span>
                {!isAssigned && <Plus size={10} color="var(--text-muted)" />}
              </div>

              {isAssigned && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '2px'
                  }}
                >
                  {formatTime(slot.cue?.timestamp || 0)}
                </span>
              )}

              {/* Quick Delete overlay trigger on hover */}
              {isAssigned && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCue(slot.padIndex);
                  }}
                  title="Delete Cue"
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    padding: '2px',
                    borderRadius: '2px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={10} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
