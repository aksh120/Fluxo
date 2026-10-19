import React, { useState } from 'react';
import {
  Music,
  Radio,
  Disc,
  Sliders,
  Youtube,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export type AppView = 'library' | 'party' | 'studio' | 'beginner' | 'creator' | 'youtube' | 'settings';

export interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems: NavItem[] = [
    {
      id: 'library',
      label: 'Music Library',
      icon: <Music size={18} />
    },
    {
      id: 'party',
      label: 'Party Mode',
      icon: <Radio size={18} />,
      badge: 'AUTO'
    },
    {
      id: 'studio',
      label: 'DJ Studio',
      icon: <Disc size={18} />
    },
    {
      id: 'beginner',
      label: 'Beginner Player',
      icon: <Sparkles size={18} color="var(--accent-cyan)" />
    },
    {
      id: 'creator',
      label: 'Mix Creator',
      icon: <Sliders size={18} />
    },
    {
      id: 'youtube',
      label: 'YouTube Music',
      icon: <Youtube size={18} color="#EF4444" />,
      badge: 'EXTRACT'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={18} />
    }
  ];

  return (
    <aside
      data-testid="app-sidebar"
      style={{
        width: isCollapsed ? '68px' : '220px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-glass)',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-normal)',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {/* Navigation Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const buttonElement = (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              aria-label={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: isCollapsed ? '10px 0' : '10px 14px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--bg-card-hover)' : 'transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                outline: 'none',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'var(--accent-cyan)' : 'inherit'
                }}
              >
                {item.icon}
              </span>

              {!isCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}

              {!isCollapsed && item.badge && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '9px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: isActive ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)'
                  }}
                >
                  {item.badge}
                </span>
              )}

              {isActive && isCollapsed && (
                <div
                  style={{
                    position: 'absolute',
                    left: '2px',
                    width: '3px',
                    height: '18px',
                    borderRadius: '2px',
                    backgroundColor: 'var(--accent-cyan)',
                    boxShadow: 'var(--shadow-glow-cyan)'
                  }}
                />
              )}
            </button>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.id} content={item.label} position="right">
                {buttonElement}
              </Tooltip>
            );
          }

          return buttonElement;
        })}
      </div>

      {/* Collapse Toggle Footer */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '10px',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '12px',
          transition: 'color var(--transition-fast)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!isCollapsed && <span>Collapse Sidebar</span>}
      </button>
    </aside>
  );
};
