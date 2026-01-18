import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import type { ToolPanel } from '@snowtree/core/types/panels';
import { useEnsureTerminalPanel } from './useEnsureTerminalPanel';

vi.mock('../../utils/api', () => ({
  API: {
    sessions: {
      ensureTerminalPanel: vi.fn(),
    },
  },
}));

import { API } from '../../utils/api';

type HarnessProps = {
  session: { id: string } | null;
  initialPanel?: ToolPanel | null;
};

function Harness({ session, initialPanel = null }: HarnessProps) {
  const [panel, setPanel] = useState<ToolPanel | null>(initialPanel);
  useEnsureTerminalPanel(session, panel, setPanel);
  return <div data-testid="panel-id">{panel?.id ?? 'none'}</div>;
}

describe('useEnsureTerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensures a terminal panel when missing', async () => {
    const session = { id: 's1' };
    (API.sessions.ensureTerminalPanel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: 'tp-1', sessionId: 's1', type: 'terminal' },
    });

    render(<Harness session={session} />);

    await waitFor(() => expect(API.sessions.ensureTerminalPanel).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.getByTestId('panel-id').textContent).toBe('tp-1'));
  });

  it('does not call ensure when panel already exists', async () => {
    const session = { id: 's1' };
    const panel = { id: 'tp-2', sessionId: 's1', type: 'terminal' } as ToolPanel;

    render(<Harness session={session} initialPanel={panel} />);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(API.sessions.ensureTerminalPanel).not.toHaveBeenCalled();
    expect(screen.getByTestId('panel-id').textContent).toBe('tp-2');
  });

  it('does not call ensure without a session', async () => {
    render(<Harness session={null} />);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(API.sessions.ensureTerminalPanel).not.toHaveBeenCalled();
    expect(screen.getByTestId('panel-id').textContent).toBe('none');
  });
});
