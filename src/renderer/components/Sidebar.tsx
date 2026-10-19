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
  Sparkles,
  Compass
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export type AppView = 'library' | 'autopilot' | 'party' | 'studio' | 'beginner' | 'creator' | 'youtube' | 'settings';

export interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  subtitle?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const ENABLE_MIX_CREATOR = false;

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navSections: NavSection[] = [
    {
      title: 'Music & Sources',
      items: [
        {
          id: 'library',
          label: 'Music Library',
          icon: <Music size={18} />,
          subtitle: 'Local audio files'
        },
        {
          id: 'youtube',
          label: 'YouTube Music',
          icon: <Youtube size={18} color="#EF4444" />,
          badge: 'STREAM',
          subtitle: 'Search & extract'
        }
      ]
    },
    {
      title: 'DJ & Playback Modes',
      items: [
        {
          id: 'autopilot',
          label: 'Autopilot',
          icon: <Compass size={18} color="var(--accent-cyan)" />,
          badge: 'AI DJ',
          subtitle: 'Hands-free auto sets'
        },
        {
          id: 'studio',
          label: 'DJ Studio',
          icon: <Disc size={18} />,
          badge: 'PRO',
          subtitle: 'Dual decks & mixer'
        },
        {
          id: 'party',
          label: 'Party Mode',
          icon: <Radio size={18} />,
          badge: 'AUTO',
          subtitle: 'Crowd vibe mixing'
        },
        {
          id: 'beginner',
          label: 'Beginner Player',
          icon: <Sparkles size={18} color="var(--accent-cyan)" />,
          subtitle: 'Simple 1-click mix'
        },
        ...(ENABLE_MIX_CREATOR
          ? [
              {
                id: 'creator' as AppView,
                label: 'Mix Creator',
                icon: <Sliders size={18} />,
                subtitle: 'Timeline mashups'
              }
            ]
          : [])
      ]
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings size={18} />,
          subtitle: 'Audio & cache'
        }
      ]
    }
  ];

  return (
    <aside
      data-testid="app-sidebar"
      style={{
        width: isCollapsed ? '68px' : '234px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-glass)',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-normal)',
        flexShrink: 0,
        userSelect: 'none',
        overflowY: 'auto'
      }}
    >
      {/* Grouped Navigation Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {navSections.map((section, sIndex) => (
          <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Section Header */}
            {!isCollapsed ? (
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted, #64748B)',
                  padding: sIndex === 0 ? '0 12px 4px 12px' : '8px 12px 4px 12px'
                }}
              >
                {section.title}
              </div>
            ) : sIndex > 0 ? (
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-glass, rgba(255, 255, 255, 0.08))',
                  margin: '6px 8px'
                }}
              />
            ) : null}

            {/* Section Items */}
            {section.items.map((item) => {
              const isActive = activeView === item.id;
              const buttonElement = (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  aria-label={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
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
                      color: isActive ? 'var(--accent-cyan)' : 'inherit',
                      flexShrink: 0
                    }}
                  >
                    {item.icon}
                  </span>

                  {!isCollapsed && (
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left',
                        flex: 1
                      }}
                    >
                      {item.label}
                    </span>
                  )}

                  {!isCollapsed && item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: isActive
                          ? 'rgba(0, 242, 254, 0.2)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        flexShrink: 0
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
                  <Tooltip key={item.id} content={`${section.title}: ${item.label}`} position="right">
                    {buttonElement}
                  </Tooltip>
                );
              }

              return buttonElement;
            })}
          </div>
        ))}
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
          transition: 'color var(--transition-fast)',
          marginTop: '12px'
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
