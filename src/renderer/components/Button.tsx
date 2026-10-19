import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'deck-a' | 'deck-b' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--gradient-cyan)',
          color: '#0B0F19',
          border: 'none',
          boxShadow: 'var(--shadow-glow-cyan)',
          fontWeight: 600
        };
      case 'deck-a':
        return {
          background: 'rgba(0, 242, 254, 0.12)',
          color: 'var(--deck-a-primary)',
          border: '1px solid var(--deck-a-border)',
          boxShadow: 'var(--deck-a-glow)',
          fontWeight: 600
        };
      case 'deck-b':
        return {
          background: 'rgba(243, 85, 160, 0.12)',
          color: 'var(--deck-b-primary)',
          border: '1px solid var(--deck-b-border)',
          boxShadow: 'var(--deck-b-glow)',
          fontWeight: 600
        };
      case 'danger':
        return {
          background: 'rgba(244, 63, 94, 0.15)',
          color: 'var(--accent-rose)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          fontWeight: 500
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: 'none'
        };
      case 'secondary':
      default:
        return {
          background: 'var(--glass-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-glass)'
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '6px 12px',
          fontSize: '12px',
          borderRadius: 'var(--radius-sm)',
          gap: '6px'
        };
      case 'lg':
        return {
          padding: '12px 24px',
          fontSize: '15px',
          borderRadius: 'var(--radius-md)',
          gap: '10px'
        };
      case 'md':
      default:
        return {
          padding: '8px 16px',
          fontSize: '13px',
          borderRadius: 'var(--radius-md)',
          gap: '8px'
        };
    }
  };

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all var(--transition-fast)',
        width: fullWidth ? '100%' : 'auto',
        outline: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style
      }}
      className={`fluxo-button ${className}`}
      {...props}
    >
      {leftIcon && <span style={{ display: 'flex', alignItems: 'center' }}>{leftIcon}</span>}
      {children && <span>{children}</span>}
      {rightIcon && <span style={{ display: 'flex', alignItems: 'center' }}>{rightIcon}</span>}
    </button>
  );
};
