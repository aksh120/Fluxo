import React from 'react';
import { Minus, Square, X, Music, CheckCircle2, AlertCircle } from 'lucide-react';

export interface AppHeaderProps {
  platformInfo?: {
    platform: string;
    version: string;
    ffmpegAvailable: boolean;
    pythonAvailable: boolean;
  } | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ platformInfo }) => {
  const handleMinimize = () => window.fluxoAPI?.minimize();
  const handleMaximize = () => window.fluxoAPI?.maximize();
  const handleClose = () => window.fluxoAPI?.close();

  return (
    <header
      data-testid="app-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '42px',
        padding: '0 16px',
        backgroundColor: '#0B0F19',
        borderBottom: '1px solid var(--border-glass)',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        flexShrink: 0
      } as React.CSSProperties}
    >
      {/* Brand & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'var(--gradient-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-cyan)'
          }}
        >
          <Music size={13} color="#0B0F19" strokeWidth={2.6} />
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '0.04em',
            color: 'var(--text-primary)'
          }}
        >
          FLUXO
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginLeft: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>Intelligent Music Crossover</span>
          <span style={{ color: 'var(--border-glass-hover)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>v1.0.0</span>
        </span>
      </div>

      {/* Subsystem Health Status Indicators */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties}
      >
        {platformInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: platformInfo.ffmpegAvailable ? 'var(--accent-emerald)' : 'var(--accent-amber)'
              }}
              title={platformInfo.ffmpegAvailable ? 'FFmpeg Core Connected' : 'FFmpeg Not Found'}
            >
              {platformInfo.ffmpegAvailable ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>FFMPEG</span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: platformInfo.pythonAvailable ? 'var(--accent-emerald)' : 'var(--accent-amber)'
              }}
              title={platformInfo.pythonAvailable ? 'Python 3.12 ML Worker Ready' : 'Python Not Found'}
            >
              {platformInfo.pythonAvailable ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>AI WORKER</span>
            </div>
          </div>
        )}

        {/* Window Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '8px' }}>
          <button
            onClick={handleMinimize}
            aria-label="Minimize window"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleMaximize}
            aria-label="Maximize window"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Maximize"
          >
            <Square size={12} />
          </button>
          <button
            onClick={handleClose}
            aria-label="Close window"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};
