import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

const terminalInstances = vi.hoisted(() => [] as any[]);

vi.mock('xterm', () => {
  class MockTerminal {
    options: Record<string, unknown> = {};
    cols = 80;
    rows = 24;
    writes: string[] = [];
    focus = vi.fn();
    open = vi.fn();
    loadAddon = vi.fn();
    scrollToBottom = vi.fn();
    dispose = vi.fn();
    onDataHandler?: (data: string) => void;

    constructor() {
      terminalInstances.push(this);
    }

    onData = (handler: (data: string) => void) => {
      this.onDataHandler = handler;
      return { dispose: vi.fn() };
    };

    write = (data: string) => {
      this.writes.push(data);
    };

    writeln = (data: string) => {
      this.writes.push(data);
    };
  }

  return { Terminal: MockTerminal };
});

vi.mock('xterm-addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn();
  },
}));

vi.mock('../../utils/api', () => ({
  API: {
    sessions: {
      preCreateTerminal: vi.fn(),
      getTerminalOutputs: vi.fn(),
      sendTerminalInput: vi.fn(),
      resizeTerminal: vi.fn(),
    },
  },
}));

import { TerminalPanel } from './TerminalPanel';
import { API } from '../../utils/api';

describe('TerminalPanel', () => {
  let originalRaf: typeof window.requestAnimationFrame;
  let originalCaf: typeof window.cancelAnimationFrame;
  let originalElectronApi: any;

  beforeEach(() => {
    terminalInstances.length = 0;
    vi.clearAllMocks();

    (API.sessions.preCreateTerminal as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (API.sessions.getTerminalOutputs as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [] });

    originalRaf = window.requestAnimationFrame;
    originalCaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);

    originalElectronApi = (window as any).electronAPI;
    (window as any).electronAPI = { ...originalElectronApi };
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
    (window as any).electronAPI = originalElectronApi;
  });

  it('focuses terminal when focusRequestId is set', async () => {
    render(<TerminalPanel sessionId="s1" panelId="p1" height={200} focusRequestId={1} />);

    await waitFor(() => expect(terminalInstances.length).toBe(1));
    await waitFor(() => expect(terminalInstances[0].open).toHaveBeenCalled());
    await waitFor(() => expect(terminalInstances[0].focus).toHaveBeenCalled());
  });

  it('sends terminal input to the API', async () => {
    render(<TerminalPanel sessionId="s1" panelId="p1" height={200} />);

    await waitFor(() => expect(terminalInstances.length).toBe(1));
    const terminal = terminalInstances[0];
    await waitFor(() => expect(typeof terminal.onDataHandler).toBe('function'));

    terminal.onDataHandler('ls');
    expect(API.sessions.sendTerminalInput).toHaveBeenCalledWith('s1', 'ls');
  });

  it('writes output events for the active session panel', async () => {
    const outputHandlers: Array<(event: any) => void> = [];
    (window as any).electronAPI = {
      ...(window as any).electronAPI,
      events: {
        onTerminalOutput: (handler: (event: any) => void) => {
          outputHandlers.push(handler);
          return () => undefined;
        },
      },
    };

    render(<TerminalPanel sessionId="s1" panelId="p1" height={200} />);

    await waitFor(() => expect(terminalInstances.length).toBe(1));
    await waitFor(() => expect(outputHandlers.length).toBe(1));

    outputHandlers[0]({
      sessionId: 's1',
      panelId: 'p1',
      type: 'stdout',
      data: 'hello',
    });

    await waitFor(() => expect(terminalInstances[0].writes).toContain('hello'));
  });
});
