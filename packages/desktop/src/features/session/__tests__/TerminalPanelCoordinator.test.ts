import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerminalPanelCoordinator } from '../TerminalPanelCoordinator';
import type { ToolPanel } from '@snowtree/core/types/panels';
import type { DatabaseService } from '../../../infrastructure/database/database';

const buildPanel = (overrides?: Partial<ToolPanel>): ToolPanel => ({
  id: 'p1',
  sessionId: 's1',
  type: 'terminal',
  title: 'Terminal',
  state: { isActive: false, hasBeenViewed: false },
  metadata: { createdAt: 'now', lastActiveAt: 'now', position: 0 },
  ...overrides,
});

describe('TerminalPanelCoordinator', () => {
  let db: { addSessionOutput: ReturnType<typeof vi.fn>; addPanelOutput: ReturnType<typeof vi.fn> };
  let panels: { getPanel: ReturnType<typeof vi.fn>; getPanelsForSession: ReturnType<typeof vi.fn>; createPanel: ReturnType<typeof vi.fn> };
  let coordinator: TerminalPanelCoordinator;

  beforeEach(() => {
    db = {
      addSessionOutput: vi.fn(),
      addPanelOutput: vi.fn(),
    };
    panels = {
      getPanel: vi.fn(),
      getPanelsForSession: vi.fn(),
      createPanel: vi.fn(),
    };
    coordinator = new TerminalPanelCoordinator(db as unknown as DatabaseService, panels as any);
  });

  it('caches terminal panels by session', () => {
    const panel = buildPanel();
    panels.getPanelsForSession.mockReturnValue([panel]);
    panels.getPanel.mockReturnValue(panel);

    const first = coordinator.getPanel('s1');
    const second = coordinator.getPanel('s1');

    expect(first).toBe(panel);
    expect(second).toBe(panel);
    expect(panels.getPanelsForSession).toHaveBeenCalledTimes(1);
    expect(panels.getPanel).toHaveBeenCalledTimes(1);
  });

  it('creates a terminal panel when missing', async () => {
    const panel = buildPanel({ id: 'p2' });
    panels.getPanelsForSession.mockReturnValue([]);
    panels.createPanel.mockResolvedValue(panel);

    const result = await coordinator.ensurePanel('s1', '/tmp/worktree');

    expect(result).toBe(panel);
    expect(panels.createPanel).toHaveBeenCalledWith({
      sessionId: 's1',
      type: 'terminal',
      title: 'Terminal',
      initialState: {
        isInitialized: false,
        cwd: '/tmp/worktree',
      },
    }, { activate: false });
  });

  it('reuses an existing terminal panel', async () => {
    const panel = buildPanel();
    panels.getPanelsForSession.mockReturnValue([panel]);

    const result = await coordinator.ensurePanel('s1');

    expect(result).toBe(panel);
    expect(panels.createPanel).not.toHaveBeenCalled();
  });

  it('records output on the terminal panel when available', () => {
    const panel = buildPanel();
    panels.getPanelsForSession.mockReturnValue([panel]);
    panels.getPanel.mockReturnValue(panel);
    db.addPanelOutput.mockReturnValue(42);

    const result = coordinator.recordOutput('s1', 'stdout', 'hello');

    expect(db.addPanelOutput).toHaveBeenCalledWith(panel.id, 'stdout', 'hello');
    expect(db.addSessionOutput).not.toHaveBeenCalled();
    expect(result).toEqual({ panelId: panel.id, outputId: 42 });
  });

  it('falls back to session output when no panel exists', () => {
    panels.getPanelsForSession.mockReturnValue([]);

    const result = coordinator.recordOutput('s1', 'stderr', 'oops');

    expect(db.addSessionOutput).toHaveBeenCalledWith('s1', 'stderr', 'oops');
    expect(result).toEqual({});
  });

  it('clears cached panel when output recording fails', () => {
    const panel = buildPanel();
    panels.getPanelsForSession.mockReturnValue([panel]);
    panels.getPanel.mockReturnValue(panel);
    db.addPanelOutput.mockImplementation(() => {
      throw new Error('fail');
    });

    coordinator.recordOutput('s1', 'stdout', 'hello');
    expect(db.addSessionOutput).toHaveBeenCalledWith('s1', 'stdout', 'hello');

    panels.getPanel.mockClear();
    panels.getPanelsForSession.mockClear();

    coordinator.getPanel('s1');

    expect(panels.getPanel).not.toHaveBeenCalled();
    expect(panels.getPanelsForSession).toHaveBeenCalledWith('s1');
  });
});
