import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-pty before importing CodexExecutor
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  default: {
    spawn: vi.fn(),
  },
}));

// Mock the session manager
const mockSessionManager = {
  getSession: vi.fn(),
  addTimelineEvent: vi.fn(),
  updateSessionStatus: vi.fn(),
  addPanelConversationMessage: vi.fn(),
  persistPanelAgentSessionId: vi.fn(),
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  verbose: vi.fn(),
  debug: vi.fn(),
};

// Import after mocks
const { CodexExecutor } = await import('../CodexExecutor');

describe('CodexExecutor', () => {
  let executor: InstanceType<typeof CodexExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new CodexExecutor(
      mockSessionManager as any,
      mockLogger as any
    );
  });

  describe('conversationId persistence across process restarts', () => {
    it('should retain conversationId after cleanupResources', async () => {
      const panelId = 'panel-1';
      const sessionId = 'session-1';
      const conversationId = 'conv-123';

      // Simulate setting a conversationId (normally done in spawn)
      (executor as any).conversationIdByPanel.set(panelId, {
        conversationId,
        rolloutPath: '/path/to/rollout',
      });

      // Simulate a process entry
      (executor as any).processes.set(panelId, { sessionId });

      // Call cleanupResources (happens when process is interrupted/killed)
      await executor.cleanupResources(sessionId);

      // conversationId should still be present
      const stored = (executor as any).conversationIdByPanel.get(panelId);
      expect(stored).toBeDefined();
      expect(stored.conversationId).toBe(conversationId);
    });

    it('should reuse existing conversationId on subsequent spawn', async () => {
      const panelId = 'panel-1';
      const existingConversationId = 'conv-existing-123';

      // Pre-set an existing conversationId (simulating previous session)
      (executor as any).conversationIdByPanel.set(panelId, {
        conversationId: existingConversationId,
        rolloutPath: '/path/to/rollout',
      });

      // Mock the methods that would be called during spawn
      const initializeSpy = vi.spyOn(executor, 'initialize').mockResolvedValue();
      const newConversationSpy = vi.spyOn(executor, 'newConversation').mockResolvedValue({
        conversationId: 'conv-new-456',
        rolloutPath: '/new/path',
      });
      const addListenerSpy = vi.spyOn(executor, 'addConversationListener').mockResolvedValue();
      const sendMessageSpy = vi.spyOn(executor, 'sendUserMessage').mockResolvedValue();

      // Mock super.spawn to avoid actual process spawning
      vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(executor)), 'spawn')
        .mockResolvedValue();

      await executor.spawn({
        panelId,
        sessionId: 'session-1',
        worktreePath: '/test/path',
        prompt: 'test prompt',
      });

      // newConversation should NOT be called because we reuse existing
      expect(newConversationSpy).not.toHaveBeenCalled();

      // The stored conversationId should still be the existing one
      const stored = (executor as any).conversationIdByPanel.get(panelId);
      expect(stored.conversationId).toBe(existingConversationId);

      // Listener should be added with existing conversationId
      expect(addListenerSpy).toHaveBeenCalledWith(panelId, existingConversationId);
    });

    it('should create new conversationId when none exists', async () => {
      const panelId = 'panel-new';
      const newConversationId = 'conv-new-789';

      // Mock the methods
      vi.spyOn(executor, 'initialize').mockResolvedValue();
      const newConversationSpy = vi.spyOn(executor, 'newConversation').mockResolvedValue({
        conversationId: newConversationId,
        rolloutPath: '/new/path',
      });
      vi.spyOn(executor, 'addConversationListener').mockResolvedValue();
      vi.spyOn(executor, 'sendUserMessage').mockResolvedValue();
      vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(executor)), 'spawn')
        .mockResolvedValue();

      await executor.spawn({
        panelId,
        sessionId: 'session-1',
        worktreePath: '/test/path',
        prompt: 'test prompt',
      });

      // newConversation SHOULD be called
      expect(newConversationSpy).toHaveBeenCalled();

      // The new conversationId should be stored
      const stored = (executor as any).conversationIdByPanel.get(panelId);
      expect(stored.conversationId).toBe(newConversationId);
    });

    it('should persist conversationId across multiple interrupt-restart cycles', async () => {
      const panelId = 'panel-cycle';
      const sessionId = 'session-cycle';
      const originalConversationId = 'conv-original';

      // Set initial conversationId
      (executor as any).conversationIdByPanel.set(panelId, {
        conversationId: originalConversationId,
      });

      // Simulate multiple interrupt-restart cycles
      for (let i = 0; i < 3; i++) {
        // Simulate process entry
        (executor as any).processes.set(panelId, { sessionId });

        // Cleanup (interrupt)
        await executor.cleanupResources(sessionId);

        // Verify conversationId persists
        const stored = (executor as any).conversationIdByPanel.get(panelId);
        expect(stored).toBeDefined();
        expect(stored.conversationId).toBe(originalConversationId);
      }
    });
  });
});
