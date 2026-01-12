import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { registerGitHandlers } from '../git';
import type { AppServices } from '../types';

// Mock IpcMain
class MockIpcMain {
  private handlers: Map<string, (event: unknown, ...args: unknown[]) => unknown> = new Map();

  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) {
    this.handlers.set(channel, listener);
  }

  async invoke(channel: string, ...args: unknown[]) {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    return handler({}, ...args);
  }

  clear() {
    this.handlers.clear();
  }
}

// Mock GitExecutor run result
interface MockRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

describe('Git IPC Handlers - Remote Pull Request', () => {
  let mockIpcMain: MockIpcMain;
  let mockGitExecutor: { run: ReturnType<typeof vi.fn> };
  let mockSessionManager: { getSession: ReturnType<typeof vi.fn> };
  let mockServices: AppServices;

  beforeEach(() => {
    mockIpcMain = new MockIpcMain();

    mockGitExecutor = {
      run: vi.fn(),
    };

    mockSessionManager = {
      getSession: vi.fn(),
    };

    mockServices = {
      gitExecutor: mockGitExecutor,
      sessionManager: mockSessionManager,
      gitStagingManager: { stageHunk: vi.fn(), restoreHunk: vi.fn() },
      gitStatusManager: { refreshSessionGitStatus: vi.fn() },
      gitDiffManager: { getDiff: vi.fn() },
      worktreeManager: {},
      configManager: {},
    } as unknown as AppServices;

    registerGitHandlers(mockIpcMain as unknown as IpcMain, mockServices);
  });

  describe('sessions:get-remote-pull-request', () => {
    const sessionId = 'test-session-123';
    const worktreePath = '/path/to/worktree';

    beforeEach(() => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath });
    });

    it('should return null when session has no worktreePath', async () => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath: null });

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({ success: false, error: 'Session worktree not found' });
    });

    it('should return null when session is not found', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({ success: false, error: 'Session worktree not found' });
    });

    it('should parse SSH remote URL and fetch PR with --repo flag', async () => {
      // Mock git remote get-url origin
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@github.com:BohuTANG/blog-hexo.git\n',
          stderr: '',
        } as MockRunResult)
        // Mock git branch --show-current
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'feature-branch\n',
          stderr: '',
        } as MockRunResult)
        // Mock gh pr view
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ number: 123, url: 'https://github.com/BohuTANG/blog-hexo/pull/123', state: 'OPEN' }),
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({
        success: true,
        data: { number: 123, url: 'https://github.com/BohuTANG/blog-hexo/pull/123', merged: false },
      });

      // Verify gh pr view was called with --repo and branch
      const ghPrViewCall = mockGitExecutor.run.mock.calls[2];
      expect(ghPrViewCall[0].argv).toContain('--repo');
      expect(ghPrViewCall[0].argv).toContain('BohuTANG/blog-hexo');
      expect(ghPrViewCall[0].argv).toContain('feature-branch');
    });

    it('should parse HTTPS remote URL and fetch PR with --repo flag', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'https://github.com/owner/repo.git\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'main\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ number: 42, url: 'https://github.com/owner/repo/pull/42', state: 'MERGED' }),
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({
        success: true,
        data: { number: 42, url: 'https://github.com/owner/repo/pull/42', merged: true },
      });

      // Verify --repo contains owner/repo from HTTPS URL
      const ghPrViewCall = mockGitExecutor.run.mock.calls[2];
      expect(ghPrViewCall[0].argv).toContain('owner/repo');
    });

    it('should return null when no PR exists for the branch', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@github.com:owner/repo.git\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'new-branch\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 1, // gh pr view returns exit code 1 when no PR found
          stdout: '',
          stderr: 'no pull requests found',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({ success: true, data: null });
    });

    it('should fallback to gh pr view without --repo when remote URL parsing fails', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 1, // git remote get-url origin fails
          stdout: '',
          stderr: 'fatal: No such remote',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ number: 99, url: 'https://github.com/test/test/pull/99', state: 'OPEN' }),
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({
        success: true,
        data: { number: 99, url: 'https://github.com/test/test/pull/99', merged: false },
      });

      // Verify gh pr view was called without --repo flag
      const ghPrViewCall = mockGitExecutor.run.mock.calls[1];
      expect(ghPrViewCall[0].argv).not.toContain('--repo');
    });

    it('should handle non-GitHub remotes gracefully', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@gitlab.com:owner/repo.git\n', // GitLab, not GitHub
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 1, // gh pr view fails for non-GitHub
          stdout: '',
          stderr: 'none of the git remotes configured for this repository point to a known GitHub host',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({ success: true, data: null });
    });

    it('should detect merged PR state', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@github.com:owner/repo.git\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'merged-branch\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ number: 50, url: 'https://github.com/owner/repo/pull/50', state: 'MERGED' }),
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({
        success: true,
        data: { number: 50, url: 'https://github.com/owner/repo/pull/50', merged: true },
      });
    });

    it('should handle malformed JSON response gracefully', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@github.com:owner/repo.git\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'branch\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'not valid json',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({ success: true, data: null });
    });

    it('should handle empty branch name', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@github.com:owner/repo.git\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '', // Empty branch (detached HEAD)
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ number: 1, url: 'https://github.com/owner/repo/pull/1', state: 'OPEN' }),
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      // Should fallback to gh pr view without --repo when branch is empty
      expect(result.success).toBe(true);
    });

    it('should handle SSH URL without .git suffix', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'git@github.com:owner/repo\n', // No .git suffix
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'branch\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ number: 10, url: 'https://github.com/owner/repo/pull/10', state: 'OPEN' }),
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-remote-pull-request', sessionId);

      expect(result).toEqual({
        success: true,
        data: { number: 10, url: 'https://github.com/owner/repo/pull/10', merged: false },
      });

      // Verify owner/repo was parsed correctly
      const ghPrViewCall = mockGitExecutor.run.mock.calls[2];
      expect(ghPrViewCall[0].argv).toContain('owner/repo');
    });
  });
});

describe('Git IPC Handlers - Branch Sync Status', () => {
  let mockIpcMain: MockIpcMain;
  let mockGitExecutor: { run: ReturnType<typeof vi.fn> };
  let mockSessionManager: { getSession: ReturnType<typeof vi.fn> };
  let mockServices: AppServices;

  beforeEach(() => {
    mockIpcMain = new MockIpcMain();

    mockGitExecutor = {
      run: vi.fn(),
    };

    mockSessionManager = {
      getSession: vi.fn(),
    };

    mockServices = {
      gitExecutor: mockGitExecutor,
      sessionManager: mockSessionManager,
      gitStagingManager: { stageHunk: vi.fn(), restoreHunk: vi.fn() },
      gitStatusManager: { refreshSessionGitStatus: vi.fn() },
      gitDiffManager: { getDiff: vi.fn() },
      worktreeManager: {},
      configManager: {},
    } as unknown as AppServices;

    registerGitHandlers(mockIpcMain as unknown as IpcMain, mockServices);
  });

  describe('sessions:get-commits-behind-main', () => {
    const sessionId = 'test-session-123';
    const worktreePath = '/path/to/worktree';

    beforeEach(() => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath, baseBranch: 'main' });
    });

    it('should return error when session has no worktreePath', async () => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath: null });

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      expect(result).toEqual({ success: false, error: 'Session worktree not found' });
    });

    it('should return error when session is not found', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      expect(result).toEqual({ success: false, error: 'Session worktree not found' });
    });

    it('should return commits behind main count', async () => {
      mockGitExecutor.run
        // git fetch origin main
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        // git rev-list HEAD..origin/main --count
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '5\n',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      expect(result).toEqual({
        success: true,
        data: { behind: 5, baseBranch: 'main' },
      });
    });

    it('should return 0 when branch is up to date', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '0\n',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      expect(result).toEqual({
        success: true,
        data: { behind: 0, baseBranch: 'main' },
      });
    });

    it('should use custom baseBranch from session', async () => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath, baseBranch: 'master' });

      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '3\n',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      expect(result).toEqual({
        success: true,
        data: { behind: 3, baseBranch: 'master' },
      });

      // Verify fetch was called with correct branch
      const fetchCall = mockGitExecutor.run.mock.calls[0];
      expect(fetchCall[0].argv).toContain('master');
    });

    it('should return 0 when origin/main does not exist', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 128, // fatal: ambiguous argument
          stdout: '',
          stderr: 'fatal: ambiguous argument',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      expect(result).toEqual({
        success: true,
        data: { behind: 0, baseBranch: 'main' },
      });
    });

    it('should handle fetch failure gracefully', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 1, // fetch fails
          stdout: '',
          stderr: 'fatal: could not fetch',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '2\n',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-commits-behind-main', sessionId);

      // Should still work even if fetch fails (use local refs)
      expect(result).toEqual({
        success: true,
        data: { behind: 2, baseBranch: 'main' },
      });
    });
  });

  describe('sessions:get-pr-remote-commits', () => {
    const sessionId = 'test-session-123';
    const worktreePath = '/path/to/worktree';

    beforeEach(() => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath });
    });

    it('should return error when session has no worktreePath', async () => {
      mockSessionManager.getSession.mockReturnValue({ worktreePath: null });

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({ success: false, error: 'Session worktree not found' });
    });

    it('should return error when session is not found', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({ success: false, error: 'Session worktree not found' });
    });

    it('should return ahead and behind counts', async () => {
      mockGitExecutor.run
        // git branch --show-current
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'feature-branch\n',
          stderr: '',
        } as MockRunResult)
        // git fetch origin feature-branch
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        // git show-ref --verify --quiet refs/remotes/origin/feature-branch
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        // git rev-list origin/feature-branch..HEAD --count (local ahead)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '3\n',
          stderr: '',
        } as MockRunResult)
        // git rev-list HEAD..origin/feature-branch --count (remote ahead)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '2\n',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({
        success: true,
        data: { ahead: 3, behind: 2, branch: 'feature-branch' },
      });
    });

    it('should return zeros when branch is synced', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'main\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '0\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '0\n',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({
        success: true,
        data: { ahead: 0, behind: 0, branch: 'main' },
      });
    });

    it('should return zeros when remote branch does not exist', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'new-branch\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 1, // fetch fails for non-existent branch
          stdout: '',
          stderr: 'fatal: could not fetch',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 1, // show-ref fails
          stdout: '',
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({
        success: true,
        data: { ahead: 0, behind: 0, branch: 'new-branch' },
      });
    });

    it('should return null branch when in detached HEAD state', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '', // Empty for detached HEAD
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({
        success: true,
        data: { ahead: 0, behind: 0, branch: null },
      });
    });

    it('should handle only local commits ahead', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'feature\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '5\n', // 5 local commits ahead
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '0\n', // 0 remote commits ahead
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({
        success: true,
        data: { ahead: 5, behind: 0, branch: 'feature' },
      });
    });

    it('should handle only remote commits ahead', async () => {
      mockGitExecutor.run
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'feature\n',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '0\n', // 0 local commits ahead
          stderr: '',
        } as MockRunResult)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '4\n', // 4 remote commits ahead
          stderr: '',
        } as MockRunResult);

      const result = await mockIpcMain.invoke('sessions:get-pr-remote-commits', sessionId);

      expect(result).toEqual({
        success: true,
        data: { ahead: 0, behind: 4, branch: 'feature' },
      });
    });
  });
});
