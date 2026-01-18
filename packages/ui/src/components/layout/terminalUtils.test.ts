import { describe, it, expect } from 'vitest';
import { clampTerminalHeight, TERMINAL_LAYOUT_LIMITS, isTerminalEventTarget } from './terminalUtils';

describe('clampTerminalHeight', () => {
  it('clamps to min height when cursor is too low', () => {
    const height = clampTerminalHeight({
      containerHeight: 800,
      containerBottom: 800,
      cursorY: 790,
    });

    expect(height).toBe(TERMINAL_LAYOUT_LIMITS.minHeight);
  });

  it('clamps to conversation-safe max height', () => {
    const height = clampTerminalHeight({
      containerHeight: 500,
      containerBottom: 500,
      cursorY: 100,
    });

    const expected = Math.max(
      TERMINAL_LAYOUT_LIMITS.minHeight,
      Math.min(TERMINAL_LAYOUT_LIMITS.maxHeight, 500 - TERMINAL_LAYOUT_LIMITS.minConversationHeight)
    );

    expect(height).toBe(expected);
  });

  it('returns raw height when within limits', () => {
    const height = clampTerminalHeight({
      containerHeight: 900,
      containerBottom: 900,
      cursorY: 700,
    });

    expect(height).toBe(200);
  });
});

describe('isTerminalEventTarget', () => {
  it('returns false for non-elements', () => {
    expect(isTerminalEventTarget(null)).toBe(false);
    expect(isTerminalEventTarget(document)).toBe(false);
  });

  it('returns true when target is inside terminal panel', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-terminal-panel', '');
    const button = document.createElement('button');
    panel.appendChild(button);
    document.body.appendChild(panel);

    expect(isTerminalEventTarget(button)).toBe(true);

    panel.remove();
  });

  it('returns false when target is outside terminal panel', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    expect(isTerminalEventTarget(button)).toBe(false);

    button.remove();
  });
});
