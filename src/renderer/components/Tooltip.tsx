import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'bottom':
        return {
          top: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          right: 'calc(100% + 6px)',
          top: '50%',
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          left: 'calc(100% + 6px)',
          top: '50%',
          transform: 'translateY(-50%)'
        };
      case 'top':
      default:
        return {
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)'
        };
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 1000,
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            color: '#F8FAFC',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            ...getPositionStyles()
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
