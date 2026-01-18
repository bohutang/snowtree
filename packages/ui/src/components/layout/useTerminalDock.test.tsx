import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useRef } from 'react';
import { useTerminalDock } from './useTerminalDock';
import { TERMINAL_LAYOUT_KEYS, TERMINAL_LAYOUT_LIMITS } from './terminalUtils';

function Harness({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalCollapsed, terminalHeight, focusRequestId } = useTerminalDock(sessionId, containerRef);

  return (
    <div>
      <div ref={containerRef} data-testid="container" />
      <div data-testid="collapsed">{terminalCollapsed ? 'true' : 'false'}</div>
      <div data-testid="height">{terminalHeight}</div>
      <div data-testid="focus">{focusRequestId}</div>
      <div data-terminal-panel>
        <button type="button" data-testid="terminal-focus-target">focus</button>
      </div>
    </div>
  );
}

describe('useTerminalDock', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads per-session storage values', () => {
    localStorage.setItem(`${TERMINAL_LAYOUT_KEYS.height}:s1`, '320');
    localStorage.setItem(`${TERMINAL_LAYOUT_KEYS.collapsed}:s1`, 'false');

    render(<Harness sessionId="s1" />);

    expect(screen.getByTestId('height').textContent).toBe('320');
    expect(screen.getByTestId('collapsed').textContent).toBe('false');
  });

  it('falls back to legacy keys when session storage is missing', () => {
    localStorage.setItem(TERMINAL_LAYOUT_KEYS.collapsed, 'false');
    localStorage.setItem(TERMINAL_LAYOUT_KEYS.height, String(TERMINAL_LAYOUT_LIMITS.defaultHeight + 20));

    render(<Harness sessionId="s2" />);

    expect(screen.getByTestId('collapsed').textContent).toBe('false');
    expect(screen.getByTestId('height').textContent).toBe(String(TERMINAL_LAYOUT_LIMITS.defaultHeight + 20));
  });

  it('toggles with ctrl+/- and increments focus id on expand', async () => {
    render(<Harness sessionId="s3" />);

    expect(screen.getByTestId('collapsed').textContent).toBe('true');
    expect(screen.getByTestId('focus').textContent).toBe('0');

    fireEvent.keyDown(window, { key: '+', code: 'Equal', ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId('collapsed').textContent).toBe('false'));
    expect(screen.getByTestId('focus').textContent).toBe('1');

    fireEvent.keyDown(window, { key: '-', code: 'Minus', ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId('collapsed').textContent).toBe('true'));
    expect(screen.getByTestId('focus').textContent).toBe('1');
  });

  it('blurs focused terminal element when collapsing', async () => {
    localStorage.setItem(`${TERMINAL_LAYOUT_KEYS.collapsed}:s4`, 'false');
    render(<Harness sessionId="s4" />);

    const target = screen.getByTestId('terminal-focus-target');
    target.focus();
    expect(target).toHaveFocus();

    fireEvent.keyDown(window, { key: '-', code: 'Minus', ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId('collapsed').textContent).toBe('true'));
    expect(target).not.toHaveFocus();
  });

  it('loads state when switching sessions', async () => {
    localStorage.setItem(`${TERMINAL_LAYOUT_KEYS.collapsed}:s5`, 'false');
    localStorage.setItem(`${TERMINAL_LAYOUT_KEYS.collapsed}:s6`, 'true');

    const { rerender } = render(<Harness sessionId="s5" />);
    expect(screen.getByTestId('collapsed').textContent).toBe('false');

    rerender(<Harness sessionId="s6" />);
    await waitFor(() => expect(screen.getByTestId('collapsed').textContent).toBe('true'));
  });
});
