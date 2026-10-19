import React, { useRef, useState, useCallback } from 'react';

export interface RotaryKnobProps {
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  step?: number;
  label: string;
  size?: number; // diameter in pixels (default 44px)
  accent?: 'cyan' | 'magenta' | 'indigo';
  unit?: string;
  onChange: (value: number) => void;
  onKillToggle?: () => void;
  isKilled?: boolean;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  min,
  max,
  defaultValue = 1.0,
  step = 0.01,
  label,
  size = 46,
  accent = 'cyan',
  unit = '',
  onChange,
  onKillToggle,
  isKilled = false
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  // Map value to angle (-135deg to +135deg)
  const normValue = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const angle = -135 + normValue * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = dragStartY.current - moveEvent.clientY;
      const range = max - min;
      // 150px drag traverses full range
      const deltaVal = (deltaY / 150) * range;
      let newVal = Math.min(max, Math.max(min, dragStartValue.current + deltaVal));
      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = useCallback(() => {
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const getAccentColor = () => {
    if (isKilled) return 'var(--accent-rose)';
    switch (accent) {
      case 'magenta':
        return 'var(--accent-magenta)';
      case 'indigo':
        return 'var(--accent-indigo)';
      case 'cyan':
      default:
        return 'var(--accent-cyan)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          fontWeight: 700,
          color: isKilled ? 'var(--accent-rose)' : 'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase'
        }}
      >
        {label}
      </span>

      {/* Rotary Knob Body */}
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${value.toFixed(2)}${unit} (Double click to reset)`}
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#121927',
          border: isKilled ? '2px solid var(--accent-rose)' : `2px solid rgba(255, 255, 255, 0.1)`,
          boxShadow: isDragging ? `0 0 14px ${getAccentColor()}` : '0 4px 10px rgba(0, 0, 0, 0.5)',
          cursor: 'ns-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow var(--transition-fast)'
        }}
      >
        {/* Inner metal ring */}
        <div
          style={{
            width: `${size - 10}px`,
            height: `${size - 10}px`,
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #1A2438, #0E1420)',
            position: 'relative'
          }}
        >
          {/* Indicator Marker Line */}
          <div
            style={{
              position: 'absolute',
              top: '3px',
              left: '50%',
              width: '2px',
              height: `${(size - 10) / 2 - 4}px`,
              backgroundColor: getAccentColor(),
              boxShadow: `0 0 6px ${getAccentColor()}`,
              borderRadius: '1px',
              transformOrigin: `center ${(size - 10) / 2 - 3}px`,
              transform: `translateX(-50%) rotate(${angle}deg)`
            }}
          />
        </div>
      </div>

      {/* Value Display / Kill Switch Button */}
      {onKillToggle ? (
        <button
          onClick={onKillToggle}
          title="Toggle Kill (-inf dB)"
          style={{
            marginTop: '2px',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '3px',
            border: isKilled ? '1px solid var(--accent-rose)' : '1px solid rgba(255,255,255,0.08)',
            backgroundColor: isKilled ? 'rgba(244, 63, 94, 0.2)' : 'rgba(0,0,0,0.3)',
            color: isKilled ? 'var(--accent-rose)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          {isKilled ? 'KILL' : `${value.toFixed(1)}${unit}`}
        </button>
      ) : (
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            marginTop: '2px'
          }}
        >
          {value.toFixed(1)}{unit}
        </span>
      )}
    </div>
  );
};
