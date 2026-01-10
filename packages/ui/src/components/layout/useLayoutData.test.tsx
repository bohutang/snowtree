import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useLayoutData } from './useLayoutData';

vi.mock('../../utils/withTimeout', () => ({
  withTimeout: (p: Promise<unknown>) => p,
}));

vi.mock('../../utils/api', () => ({
  API: {
    sessions: {
      get: vi.fn(),
      getGitCommands: vi.fn(),
      stop: vi.fn(),
    },
  },
}));

import { API } from '../../utils/api';

function Harness() {
  const { selectedTool, setSelectedTool, sendMessageToTool } = useLayoutData('s1');
  return (
    <div>
      <div data-testid="selected">{selectedTool}</div>
      <button type="button" onClick={() => setSelectedTool('codex')}>select-codex</button>
      <button type="button" onClick={() => sendMessageToTool('claude', 'commit', { skipCheckpointAutoCommit: true })}>send-claude</button>
    </div>
  );
}

describe('useLayoutData', () => {
  beforeEach(() => {
    (API.sessions.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: 's1', name: 's1', status: 'waiting', createdAt: new Date().toISOString(), toolType: 'claude' },
    });
    (API.sessions.getGitCommands as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { currentBranch: 'main' } });
    (API.sessions.stop as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    (globalThis as unknown as { window: Window & typeof globalThis }).window.electronAPI = {
      panels: {
        list: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'p1', sessionId: 's1', type: 'claude', name: 'Claude' }] }),
        create: vi.fn(),
        continue: vi.fn().mockResolvedValue({ success: true }),
      },
      events: {
        onSessionCreated: vi.fn(() => undefined),
        onSessionUpdated: vi.fn(() => undefined),
      },
    } as any;
  });

  it('does not reset selected tool when sendMessageToTool targets a different tool', async () => {
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('claude'));

    fireEvent.click(screen.getByText('select-codex'));
    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('codex'));

    fireEvent.click(screen.getByText('send-claude'));

    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('codex'));
  });
});
