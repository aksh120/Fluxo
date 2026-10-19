import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { KeyboardShortcutManager, ShortcutDefinition } from '../utils/KeyboardShortcutManager';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = KeyboardShortcutManager.SHORTCUTS;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      data-testid="shortcuts-modal"
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#0F172A',
          border: '1px solid var(--border-glass-hover)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 172, 254, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <Keyboard size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Keyboard Shortcuts & Hotkeys
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                Full hands-free DJ performance controls and accessibility hotkeys
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px'
            }}
            aria-label="Close shortcuts modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
          {shortcuts.map((sc) => (
            <div
              key={sc.combination}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {sc.description}
              </span>

              <kbd
                style={{
                  padding: '3px 8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                {sc.combination}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          <span>Press <strong>?</strong> anywhere in the app to toggle this reference.</span>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
