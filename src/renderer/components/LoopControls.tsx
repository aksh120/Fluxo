import React from 'react';
import { Repeat } from 'lucide-react';
import type { LoopLength, LoopState } from '../audio/LoopController';

export interface LoopControlsProps {
  deckId: 'A' | 'B';
  loopState: LoopState;
  onActivateLoop: (beats: LoopLength) => void;
  onToggleLoop: () => void;
  onHalveLoop: () => void;
  onDoubleLoop: () => void;
  onSetIn?: () => void;
  onSetOut?: () => void;
}

export const LoopControls: React.FC<LoopControlsProps> = ({
  deckId,
  loopState,
  onActivateLoop,
  onToggleLoop,
  onHalveLoop,
  onDoubleLoop,
  onSetIn,
  onSetOut
}) => {
  const lengths: LoopLength[] = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
  const accentColor = deckId === 'A' ? 'var(--accent-cyan)' : 'var(--accent-magenta)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Repeat size={13} color={loopState.isActive ? accentColor : 'var(--text-muted)'} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            BEAT LOOP
          </span>
        </div>

        {/* Master Active / Exit Loop Toggle */}
        <button
          onClick={onToggleLoop}
          data-testid={`loop-toggle-${deckId}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 'var(--radius-xs)',
            border: loopState.isActive ? `1px solid ${accentColor}` : '1px solid var(--border-subtle)',
            backgroundColor: loopState.isActive ? `${accentColor}25` : 'rgba(0, 0, 0, 0.3)',
            color: loopState.isActive ? accentColor : 'var(--text-muted)',
            boxShadow: loopState.isActive ? `0 0 10px ${accentColor}40` : 'none',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          {loopState.isActive ? `LOOP ACTIVE (${loopState.lengthBeats} BEATS)` : 'LOOP OFF'}
        </button>
      </div>

      {/* Beat Length Selector Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
        {lengths.map((len) => {
          const isSelected = loopState.isActive && loopState.lengthBeats === len;
          const label = len === 0.25 ? '1/4' : len === 0.5 ? '1/2' : `${len}`;

          return (
            <button
              key={len}
              onClick={() => onActivateLoop(len)}
              data-testid={`loop-btn-${deckId}-${label}`}
              title={`Loop ${label} beats`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: isSelected ? 800 : 600,
                padding: '6px 2px',
                borderRadius: 'var(--radius-xs)',
                border: isSelected ? `1px solid ${accentColor}` : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? accentColor : 'rgba(255, 255, 255, 0.04)',
                color: isSelected ? '#0B0F19' : 'var(--text-secondary)',
                boxShadow: isSelected ? `0 0 8px ${accentColor}50` : 'none',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all var(--transition-fast)'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Fine Loop Controls: 1/2x, 2x, IN, OUT */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={onHalveLoop}
          title="Halve active loop length"
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          /2
        </button>
        <button
          onClick={onDoubleLoop}
          title="Double active loop length"
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          2x
        </button>
        {onSetIn && (
          <button
            onClick={onSetIn}
            title="Set Loop IN point"
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            IN
          </button>
        )}
        {onSetOut && (
          <button
            onClick={onSetOut}
            title="Set Loop OUT point"
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            OUT
          </button>
        )}
      </div>
    </div>
  );
};
