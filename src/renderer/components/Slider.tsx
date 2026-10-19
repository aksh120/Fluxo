import React from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  accent?: 'cyan' | 'magenta' | 'indigo' | 'neutral';
  orientation?: 'horizontal' | 'vertical';
  height?: number | string;
  width?: number | string;
  centerDetent?: boolean;
  label?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  accent = 'cyan',
  orientation = 'horizontal',
  height,
  width,
  centerDetent = false,
  label,
  disabled = false
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const getAccentColor = () => {
    switch (accent) {
      case 'magenta':
        return 'var(--accent-magenta)';
      case 'indigo':
        return 'var(--accent-indigo)';
      case 'neutral':
        return 'var(--text-secondary)';
      case 'cyan':
      default:
        return 'var(--accent-cyan)';
    }
  };

  const isVertical = orientation === 'vertical';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        gap: '8px',
        opacity: disabled ? 0.4 : 1,
        width: width ?? (isVertical ? 'auto' : '100%'),
        height: height ?? (isVertical ? '140px' : 'auto')
      }}
    >
      {label && (
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}
        >
          {label}
        </span>
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: isVertical ? '24px' : '100%',
          height: isVertical ? '100%' : '24px'
        }}
      >
        {/* Visual Custom Track */}
        <div
          style={{
            position: 'absolute',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            pointerEvents: 'none',
            ...(isVertical
              ? { width: '6px', height: '100%', left: '9px' }
              : { height: '6px', width: '100%', top: '9px' })
          }}
        >
          {/* Active Fill Track */}
          <div
            style={{
              position: 'absolute',
              borderRadius: 'var(--radius-full)',
              backgroundColor: getAccentColor(),
              boxShadow: `0 0 8px ${getAccentColor()}`,
              ...(isVertical
                ? {
                    width: '100%',
                    bottom: 0,
                    height: `${percentage}%`
                  }
                : {
                    height: '100%',
                    left: 0,
                    width: `${percentage}%`
                  })
            }}
          />

          {/* Center Detent Indicator */}
          {centerDetent && (
            <div
              style={{
                position: 'absolute',
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
                borderRadius: '1px',
                pointerEvents: 'none',
                ...(isVertical
                  ? { width: '12px', height: '2px', left: '-3px', top: '50%' }
                  : { height: '12px', width: '2px', top: '-3px', left: '50%' })
              }}
            />
          )}
        </div>

        {/* Underlying Range Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          style={{
            position: 'absolute',
            width: isVertical ? '100%' : '100%',
            height: isVertical ? '100%' : '100%',
            opacity: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            margin: 0,
            zIndex: 2
          }}
        />

        {/* Visual Slider Thumb */}
        <div
          style={{
            position: 'absolute',
            width: isVertical ? '20px' : '14px',
            height: isVertical ? '14px' : '20px',
            borderRadius: isVertical ? '4px' : '4px',
            backgroundColor: '#F8FAFC',
            border: `2px solid ${getAccentColor()}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            transition: 'border-color var(--transition-fast)',
            ...(isVertical
              ? {
                  left: '12px',
                  top: `${100 - percentage}%`
                }
              : {
                  top: '12px',
                  left: `${percentage}%`
                })
          }}
        />
      </div>
    </div>
  );
};
