import React from 'react';

export interface KeyBadgeProps {
  camelot?: string; // e.g. "8A", "8B", "11B"
  musicalKey?: string; // e.g. "Am", "C"
}

// Camelot Wheel color spectrum mapping
const CAMELOT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1A': { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.35)' },
  '1B': { bg: 'rgba(239, 68, 68, 0.25)', text: '#FCA5A5', border: 'rgba(239, 68, 68, 0.5)' },
  '2A': { bg: 'rgba(249, 115, 22, 0.15)', text: '#FB923C', border: 'rgba(249, 115, 22, 0.35)' },
  '2B': { bg: 'rgba(249, 115, 22, 0.25)', text: '#FDBA74', border: 'rgba(249, 115, 22, 0.5)' },
  '3A': { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.35)' },
  '3B': { bg: 'rgba(245, 158, 11, 0.25)', text: '#FCD34D', border: 'rgba(245, 158, 11, 0.5)' },
  '4A': { bg: 'rgba(234, 179, 8, 0.15)', text: '#FACC15', border: 'rgba(234, 179, 8, 0.35)' },
  '4B': { bg: 'rgba(234, 179, 8, 0.25)', text: '#FDE047', border: 'rgba(234, 179, 8, 0.5)' },
  '5A': { bg: 'rgba(132, 204, 22, 0.15)', text: '#A3E635', border: 'rgba(132, 204, 22, 0.35)' },
  '5B': { bg: 'rgba(132, 204, 22, 0.25)', text: '#BEF264', border: 'rgba(132, 204, 22, 0.5)' },
  '6A': { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80', border: 'rgba(34, 197, 94, 0.35)' },
  '6B': { bg: 'rgba(34, 197, 94, 0.25)', text: '#86EFAC', border: 'rgba(34, 197, 94, 0.5)' },
  '7A': { bg: 'rgba(20, 184, 166, 0.15)', text: '#2DD4BF', border: 'rgba(20, 184, 166, 0.35)' },
  '7B': { bg: 'rgba(20, 184, 166, 0.25)', text: '#5EEAD4', border: 'rgba(20, 184, 166, 0.5)' },
  '8A': { bg: 'rgba(6, 182, 212, 0.15)', text: '#22D3EE', border: 'rgba(6, 182, 212, 0.35)' },
  '8B': { bg: 'rgba(6, 182, 212, 0.25)', text: '#67E8F9', border: 'rgba(6, 182, 212, 0.5)' },
  '9A': { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.35)' },
  '9B': { bg: 'rgba(59, 130, 246, 0.25)', text: '#93C5FD', border: 'rgba(59, 130, 246, 0.5)' },
  '10A': { bg: 'rgba(99, 102, 241, 0.15)', text: '#818CF8', border: 'rgba(99, 102, 241, 0.35)' },
  '10B': { bg: 'rgba(99, 102, 241, 0.25)', text: '#A5B4FC', border: 'rgba(99, 102, 241, 0.5)' },
  '11A': { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.35)' },
  '11B': { bg: 'rgba(168, 85, 247, 0.25)', text: '#D8B4FE', border: 'rgba(168, 85, 247, 0.5)' },
  '12A': { bg: 'rgba(236, 72, 153, 0.15)', text: '#F472B6', border: 'rgba(236, 72, 153, 0.35)' },
  '12B': { bg: 'rgba(236, 72, 153, 0.25)', text: '#F9A8D4', border: 'rgba(236, 72, 153, 0.5)' }
};

export const KeyBadge: React.FC<KeyBadgeProps> = ({ camelot, musicalKey }) => {
  if (!camelot && !musicalKey) {
    return (
      <span className="badge-camelot" style={{ color: 'var(--text-muted)' }}>
        --
      </span>
    );
  }

  const colorScheme = camelot ? CAMELOT_COLORS[camelot.toUpperCase()] : null;
  const bg = colorScheme ? colorScheme.bg : 'rgba(255, 255, 255, 0.05)';
  const text = colorScheme ? colorScheme.text : 'var(--text-secondary)';
  const border = colorScheme ? colorScheme.border : 'rgba(255, 255, 255, 0.1)';

  return (
    <span
      className="badge-camelot"
      title={musicalKey ? `${camelot ?? ''} (${musicalKey})` : camelot}
      style={{
        backgroundColor: bg,
        color: text,
        borderColor: border
      }}
    >
      {camelot ?? musicalKey}
    </span>
  );
};

export interface BpmBadgeProps {
  bpm?: number;
}

export const BpmBadge: React.FC<BpmBadgeProps> = ({ bpm }) => {
  return (
    <span className="badge-bpm">
      {bpm ? `${bpm.toFixed(1)} BPM` : '-- BPM'}
    </span>
  );
};

export interface SourceBadgeProps {
  sourceType: 'local' | 'youtube';
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ sourceType }) => {
  const isYt = sourceType === 'youtube';
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        padding: '2px 6px',
        borderRadius: 'var(--radius-xs)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: isYt ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 254, 0.1)',
        color: isYt ? '#EF4444' : 'var(--accent-cyan)',
        border: `1px solid ${isYt ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 242, 254, 0.25)'}`
      }}
    >
      {isYt ? 'YouTube' : 'Local'}
    </span>
  );
};

export interface BadgeProps {
  variant?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose' | 'neutral';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'cyan',
  size = 'md',
  children,
  title
}) => {
  const variantStyles: Record<string, { bg: string; text: string; border: string }> = {
    cyan: { bg: 'rgba(0, 242, 254, 0.1)', text: 'var(--accent-cyan)', border: 'rgba(0, 242, 254, 0.3)' },
    purple: { bg: 'rgba(121, 40, 202, 0.15)', text: '#C084FC', border: 'rgba(121, 40, 202, 0.35)' },
    emerald: { bg: 'rgba(0, 245, 160, 0.12)', text: 'var(--accent-emerald)', border: 'rgba(0, 245, 160, 0.3)' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.35)' },
    rose: { bg: 'rgba(255, 0, 128, 0.12)', text: 'var(--accent-magenta)', border: 'rgba(255, 0, 128, 0.3)' },
    neutral: { bg: 'rgba(255, 255, 255, 0.06)', text: 'var(--text-secondary)', border: 'rgba(255, 255, 255, 0.12)' }
  };

  const current = variantStyles[variant] || variantStyles.cyan;
  const isSm = size === 'sm';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isSm ? '10px' : '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        padding: isSm ? '2px 6px' : '3px 8px',
        borderRadius: 'var(--radius-xs)',
        backgroundColor: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        letterSpacing: '0.02em',
        lineHeight: 1.2
      }}
    >
      {children}
    </span>
  );
};

