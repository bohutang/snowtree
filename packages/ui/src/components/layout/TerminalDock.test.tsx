import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TerminalDock } from './TerminalDock';
import { useTerminalDock } from './useTerminalDock';

vi.mock('./useTerminalDock', () => ({
  useTerminalDock: vi.fn(),
}));

vi.mock('./TerminalPanel', () => ({
  TerminalPanel: () => <div data-testid="terminal-panel" />,
}));

describe('TerminalDock', () => {
  const useTerminalDockMock = useTerminalDock as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useTerminalDockMock.mockReset();
  });

  it('renders nothing when collapsed', () => {
    useTerminalDockMock.mockReturnValue({
      terminalHeight: 240,
      terminalCollapsed: true,
      isResizing: false,
      focusRequestId: 0,
      handleResizeStart: vi.fn(),
    });

    const containerRef = { current: document.createElement('div') };
    render(<TerminalDock sessionId="s1" panelId="p1" containerRef={containerRef} />);

    expect(screen.queryByTestId('terminal-panel')).toBeNull();
    expect(screen.queryByTestId('terminal-resize-handle')).toBeNull();
    expect(useTerminalDockMock).toHaveBeenCalledWith('s1', containerRef);
  });

  it('renders resize handle and panel when expanded', () => {
    useTerminalDockMock.mockReturnValue({
      terminalHeight: 240,
      terminalCollapsed: false,
      isResizing: false,
      focusRequestId: 1,
      handleResizeStart: vi.fn(),
    });

    const containerRef = { current: document.createElement('div') };
    render(<TerminalDock sessionId="s1" panelId="p1" containerRef={containerRef} />);

    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-resize-handle')).toBeInTheDocument();
  });
});
