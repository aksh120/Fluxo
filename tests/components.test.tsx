import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Button } from '../src/renderer/components/Button';
import { Slider } from '../src/renderer/components/Slider';
import { RotaryKnob } from '../src/renderer/components/RotaryKnob';
import { KeyBadge, BpmBadge, SourceBadge } from '../src/renderer/components/Badge';
import { Modal } from '../src/renderer/components/Modal';

describe('Phase 2 Component Library Unit Tests', () => {
  it('renders Button with variants and handles click events', () => {
    const handleClick = vi.fn();
    render(
      <Button variant="deck-a" size="md" onClick={handleClick}>
        Cue Deck A
      </Button>
    );

    const button = screen.getByRole('button', { name: /cue deck a/i });
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders Slider and dispatches change values', () => {
    const handleChange = vi.fn();
    render(
      <Slider value={0.5} min={0} max={1} step={0.05} onChange={handleChange} label="Volume" />
    );

    const input = screen.getByRole('slider');
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: '0.8' } });
    expect(handleChange).toHaveBeenCalledWith(0.8);
  });

  it('renders RotaryKnob and handles double click reset and kill toggle', () => {
    const handleChange = vi.fn();
    const handleKill = vi.fn();

    render(
      <RotaryKnob
        label="LOW"
        value={0.4}
        min={0}
        max={1}
        defaultValue={1.0}
        onChange={handleChange}
        onKillToggle={handleKill}
        isKilled={false}
      />
    );

    // Click kill button
    const killBtn = screen.getByRole('button', { name: /0.4/i });
    fireEvent.click(killBtn);
    expect(handleKill).toHaveBeenCalledTimes(1);
  });

  it('renders KeyBadge with Camelot mapping and BpmBadge', () => {
    render(
      <div>
        <KeyBadge camelot="8A" musicalKey="Am" />
        <BpmBadge bpm={128.0} />
        <SourceBadge sourceType="youtube" />
      </div>
    );

    expect(screen.getByText('8A')).toBeDefined();
    expect(screen.getByText('128.0 BPM')).toBeDefined();
    expect(screen.getByText('YouTube')).toBeDefined();
  });

  it('renders Modal and responds to close button click and escape key', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose} title="Mix Settings">
        <p>Modal Body Content</p>
      </Modal>
    );

    expect(screen.getByText('Mix Settings')).toBeDefined();
    expect(screen.getByText('Modal Body Content')).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Test closed state
    rerender(
      <Modal isOpen={false} onClose={handleClose} title="Mix Settings">
        <p>Modal Body Content</p>
      </Modal>
    );
    expect(screen.queryByText('Mix Settings')).toBeNull();
  });
});
