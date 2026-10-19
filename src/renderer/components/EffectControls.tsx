import React from 'react';
import { Waves, Sparkles } from 'lucide-react';
import { RotaryKnob } from './RotaryKnob';
import type { EchoSyncBeat, EffectsState } from '../audio/AudioEffectsChain';

export interface EffectControlsProps {
  deckId: 'A' | 'B';
  effectsState: EffectsState;
  onSetEchoBeat: (beat: EchoSyncBeat) => void;
  onSetEchoMix: (mix: number) => void;
  onSetEchoFeedback: (feedback: number) => void;
  onSetFlangerMix: (mix: number) => void;
  onSetFlangerRate: (rateHz: number) => void;
}

export const EffectControls: React.FC<EffectControlsProps> = ({
  deckId,
  effectsState,
  onSetEchoBeat,
  onSetEchoMix,
  onSetEchoFeedback,
  onSetFlangerMix,
  onSetFlangerRate
}) => {
  const echoBeats: Array<{ beat: EchoSyncBeat; label: string }> = [
    { beat: 0.25, label: '1/4' },
    { beat: 0.5, label: '1/2' },
    { beat: 0.75, label: '3/4' },
    { beat: 1.0, label: '1' }
  ];

  const accentColor = deckId === 'A' ? 'var(--accent-cyan)' : 'var(--accent-magenta)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Waves size={13} color="var(--accent-cyan)" />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            DSP EFFECTS
          </span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Beat-Synchronized Delay & Flange
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Echo / Delay Module */}
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: effectsState.echoEnabled ? `1px solid ${accentColor}` : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>ECHO / DELAY</span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: effectsState.echoEnabled ? accentColor : 'var(--text-muted)'
              }}
            >
              {effectsState.echoEnabled ? `${Math.round(effectsState.echoMix * 100)}% WET` : 'OFF'}
            </span>
          </div>

          {/* Beat Sync Selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {echoBeats.map((b) => {
              const isSelected = effectsState.echoBeat === b.beat;
              return (
                <button
                  key={b.label}
                  onClick={() => onSetEchoBeat(b.beat)}
                  title={`Sync echo to ${b.label} beat`}
                  style={{
                    flex: 1,
                    padding: '4px 2px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: isSelected ? 800 : 500,
                    borderRadius: '2px',
                    border: isSelected ? `1px solid ${accentColor}` : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? `${accentColor}25` : 'transparent',
                    color: isSelected ? accentColor : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          {/* Knobs: Mix & Feedback */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <RotaryKnob
              label="WET MIX"
              value={effectsState.echoMix}
              min={0}
              max={1.0}
              step={0.01}
              color={accentColor}
              size={48}
              onChange={onSetEchoMix}
              valueDisplay={`${Math.round(effectsState.echoMix * 100)}%`}
            />
            <RotaryKnob
              label="FEEDBACK"
              value={effectsState.echoFeedback}
              min={0}
              max={0.85}
              step={0.01}
              color={accentColor}
              size={48}
              onChange={onSetEchoFeedback}
              valueDisplay={`${Math.round(effectsState.echoFeedback * 100)}%`}
            />
          </div>
        </div>

        {/* Flanger Module */}
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: effectsState.flangerEnabled ? `1px solid ${accentColor}` : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} color="var(--accent-cyan)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>FLANGER</span>
            </div>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: effectsState.flangerEnabled ? accentColor : 'var(--text-muted)'
              }}
            >
              {effectsState.flangerEnabled ? `${Math.round(effectsState.flangerMix * 100)}% WET` : 'OFF'}
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: '16px' }}>
            <RotaryKnob
              label="FLANGE MIX"
              value={effectsState.flangerMix}
              min={0}
              max={1.0}
              step={0.01}
              color={accentColor}
              size={48}
              onChange={onSetFlangerMix}
              valueDisplay={`${Math.round(effectsState.flangerMix * 100)}%`}
            />
            <RotaryKnob
              label="LFO RATE"
              value={effectsState.flangerRate}
              min={0.1}
              max={3.0}
              step={0.1}
              color={accentColor}
              size={48}
              onChange={onSetFlangerRate}
              valueDisplay={`${effectsState.flangerRate.toFixed(1)}Hz`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
