import React from 'react';
import { Mic, Music2, Scissors, VolumeX, Headphones } from 'lucide-react';
import { Slider } from './Slider';
import { Button } from './Button';
import type { StemPlayerState } from '../audio/StemDeckPlayer';

export interface StemMixerProps {
  deckId: 'A' | 'B';
  stemState: StemPlayerState;
  isSeparating?: boolean;
  onSeparateStems: () => void;
  onVocalVolumeChange: (vol: number) => void;
  onInstrumentalVolumeChange: (vol: number) => void;
  onVocalMuteToggle: () => void;
  onInstrumentalMuteToggle: () => void;
  onVocalSoloToggle: () => void;
  onInstrumentalSoloToggle: () => void;
}

export const StemMixer: React.FC<StemMixerProps> = ({
  deckId,
  stemState,
  isSeparating = false,
  onSeparateStems,
  onVocalVolumeChange,
  onInstrumentalVolumeChange,
  onVocalMuteToggle,
  onInstrumentalMuteToggle,
  onVocalSoloToggle,
  onInstrumentalSoloToggle
}) => {
  const accentColor = deckId === 'A' ? 'var(--accent-cyan)' : 'var(--accent-magenta)';

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scissors size={14} color={accentColor} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            STEM ISOLATION MIXER
          </span>
        </div>

        {stemState.hasStems ? (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--accent-emerald)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}
          >
            STEMS ACTIVE
          </span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSeparateStems}
            disabled={isSeparating}
            leftIcon={<Scissors size={12} className={isSeparating ? 'pulse-beat' : ''} />}
          >
            {isSeparating ? 'ISOLATING STEMS...' : 'ISOLATE VOCALS'}
          </Button>
        )}
      </div>

      {/* Dual Stem Faders: Vocals vs Instrumental */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Vocal Stem Control */}
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: stemState.isVocalSolo ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mic size={14} color="var(--accent-cyan)" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>VOCALS</span>
            </div>

            {/* Mute & Solo Buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={onVocalMuteToggle}
                title="Mute Vocals"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  borderRadius: '2px',
                  border: stemState.isVocalMuted ? '1px solid var(--accent-magenta)' : '1px solid var(--border-subtle)',
                  backgroundColor: stemState.isVocalMuted ? 'var(--accent-magenta)' : 'transparent',
                  color: stemState.isVocalMuted ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                M
              </button>
              <button
                onClick={onVocalSoloToggle}
                title="Solo Vocals (Acapella mode)"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  borderRadius: '2px',
                  border: stemState.isVocalSolo ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  backgroundColor: stemState.isVocalSolo ? 'var(--accent-cyan)' : 'transparent',
                  color: stemState.isVocalSolo ? '#0B0F19' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                S
              </button>
            </div>
          </div>

          <Slider
            label=""
            value={stemState.vocalVolume}
            min={0}
            max={1.5}
            step={0.01}
            color="var(--accent-cyan)"
            onChange={onVocalVolumeChange}
            valueDisplay={`${Math.round(stemState.vocalVolume * 100)}%`}
          />
        </div>

        {/* Instrumental Stem Control */}
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: stemState.isInstrumentalSolo ? '1px solid var(--accent-magenta)' : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Music2 size={14} color="var(--accent-magenta)" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>INSTRUMENTAL</span>
            </div>

            {/* Mute & Solo Buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={onInstrumentalMuteToggle}
                title="Mute Instrumental"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  borderRadius: '2px',
                  border: stemState.isInstrumentalMuted ? '1px solid var(--accent-magenta)' : '1px solid var(--border-subtle)',
                  backgroundColor: stemState.isInstrumentalMuted ? 'var(--accent-magenta)' : 'transparent',
                  color: stemState.isInstrumentalMuted ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                M
              </button>
              <button
                onClick={onInstrumentalSoloToggle}
                title="Solo Instrumental"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  borderRadius: '2px',
                  border: stemState.isInstrumentalSolo ? '1px solid var(--accent-magenta)' : '1px solid var(--border-subtle)',
                  backgroundColor: stemState.isInstrumentalSolo ? 'var(--accent-magenta)' : 'transparent',
                  color: stemState.isInstrumentalSolo ? '#0B0F19' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                S
              </button>
            </div>
          </div>

          <Slider
            label=""
            value={stemState.instrumentalVolume}
            min={0}
            max={1.5}
            step={0.01}
            color="var(--accent-magenta)"
            onChange={onInstrumentalVolumeChange}
            valueDisplay={`${Math.round(stemState.instrumentalVolume * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
};
