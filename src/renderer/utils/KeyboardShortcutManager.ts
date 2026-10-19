export interface ShortcutActionMap {
  onPlayPause?: () => void;
  onTriggerTransition?: () => void;
  onNudgeDeck?: (direction: 'up' | 'down') => void;
  onJumpCue?: (cueIndex: number) => void;
  onToggleLoop?: () => void;
  onToggleMute?: () => void;
  onSwitchActiveDeck?: () => void;
  onToggleHelp?: () => void;
}

export interface ShortcutDefinition {
  key: string;
  combination: string;
  description: string;
  category: 'Playback' | 'Transitions' | 'Performance' | 'Navigation';
}

export class KeyboardShortcutManager {
  private actions: ShortcutActionMap;
  private isEnabled = true;
  private boundHandler: (e: KeyboardEvent) => void;

  public static readonly SHORTCUTS: ShortcutDefinition[] = [
    {
      key: 'Space',
      combination: 'Space',
      description: 'Play / Pause active virtual deck',
      category: 'Playback'
    },
    {
      key: 'Shift+ArrowRight',
      combination: 'Shift + →',
      description: 'Trigger immediate beatmatched crossover ("MIX NOW")',
      category: 'Transitions'
    },
    {
      key: 'Shift+ArrowLeft',
      combination: 'Shift + ←',
      description: 'Tempo pitch-bend nudge (down/slow down)',
      category: 'Performance'
    },
    {
      key: 'Shift+ArrowUp',
      combination: 'Shift + ↑',
      description: 'Tempo pitch-bend nudge (up/speed up)',
      category: 'Performance'
    },
    {
      key: '1-8',
      combination: '1 – 8',
      description: 'Jump to color-coded Hot Cue pad (1 through 8)',
      category: 'Performance'
    },
    {
      key: 'l',
      combination: 'L',
      description: 'Activate / Exit beatgrid loop on active deck',
      category: 'Performance'
    },
    {
      key: 'm',
      combination: 'M',
      description: 'Mute / Unmute active deck',
      category: 'Playback'
    },
    {
      key: 's',
      combination: 'S',
      description: 'Switch active deck focus (Deck A ⇄ Deck B)',
      category: 'Navigation'
    },
    {
      key: '?',
      combination: 'Shift + / (?)',
      description: 'Open keyboard shortcuts cheatsheet modal',
      category: 'Navigation'
    }
  ];

  constructor(actions: ShortcutActionMap = {}) {
    this.actions = actions;
    this.boundHandler = this.handleKeyDown.bind(this);
  }

  public setActions(actions: ShortcutActionMap): void {
    this.actions = { ...this.actions, ...actions };
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public attach(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundHandler);
    }
  }

  public detach(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundHandler);
    }
  }

  public handleKeyDown(e: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Ignore hotkeys when typing into input or textarea elements
    const target = e.target as HTMLElement | null;
    if (target && typeof target.tagName === 'string') {
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
        return;
      }
    }

    // 1. Play / Pause
    if (e.code === 'Space') {
      e.preventDefault();
      this.actions.onPlayPause?.();
      return;
    }

    // 2. Mix Next / Immediate Transition (Shift + Right or Enter)
    if ((e.shiftKey && e.key === 'ArrowRight') || e.key === 'Enter') {
      e.preventDefault();
      this.actions.onTriggerTransition?.();
      return;
    }

    // 3. Pitch Nudge (Shift + Left / Shift + Up)
    if (e.shiftKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      this.actions.onNudgeDeck?.('down');
      return;
    }
    if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      this.actions.onNudgeDeck?.('up');
      return;
    }

    // 4. Hot Cue Pads (1 through 8)
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= 8) {
      e.preventDefault();
      this.actions.onJumpCue?.(num - 1); // 0-indexed pad
      return;
    }

    // 5. Toggle Loop (L)
    if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.actions.onToggleLoop?.();
      return;
    }

    // 6. Toggle Mute (M)
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.actions.onToggleMute?.();
      return;
    }

    // 7. Switch Deck (S)
    if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.actions.onSwitchActiveDeck?.();
      return;
    }

    // 8. Help (? or /)
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      this.actions.onToggleHelp?.();
      return;
    }
  }
}
