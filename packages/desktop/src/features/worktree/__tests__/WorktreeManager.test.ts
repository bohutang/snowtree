import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorktreeManager } from '../WorktreeManager';
import { createMockGitExecutor, mockGitCommand, clearMockGitCommands, setupDefaultWorktreeGitMocks, createWorktreeMockImplementation } from '../../../__tests__/helpers/mockGitExecutor';
import type { GitExecutor } from '../../../executors/git';

describe('WorktreeManager', () => {
  let worktreeManager: WorktreeManager;
  let mockGitExecutor: GitExecutor;

  beforeEach(() => {
    clearMockGitCommands();
    mockGitExecutor = createMockGitExecutor();
    worktreeManager = new WorktreeManager(mockGitExecutor);
  });

  describe('createWorktree', () => {
    it('should create worktree with branch name', async () => {
      setupDefaultWorktreeGitMocks(mockGitExecutor);

      const result = await worktreeManager.createWorktree(
        '/tmp/project',
        'feature-1'
      );

      expect(result.branchName).toBe('feature-1');
      expect(result.worktreePath).toContain('feature-1');
    });

    it('should initialize non-git repository', async () => {
      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation({
          'rev-parse --is-inside-work-tree': () => Promise.reject(new Error('not a git repository')),
        })
      );

      await worktreeManager.createWorktree('/tmp/project', 'feature-1', 'Test');

      expect(mockGitExecutor.run).toHaveBeenCalledWith(
        expect.objectContaining({ argv: expect.arrayContaining(['init']) })
      );
    });

    it('should create initial commit in empty repository', async () => {
      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation({
          'rev-parse HEAD': () => Promise.reject(new Error('no commits')),
        })
      );

      await worktreeManager.createWorktree('/tmp/project', 'feature-1', 'Test');

      expect(mockGitExecutor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['commit']),
        })
      );
    });

    it('should detect origin/HEAD as base branch', async () => {
      setupDefaultWorktreeGitMocks(mockGitExecutor);

      const result = await worktreeManager.createWorktree(
        '/tmp/project',
        'feature-1',
        'Test'
      );

      expect(result.baseBranch).toBe('main');
    });

    it('should fallback to origin/main when origin/HEAD unavailable', async () => {
      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation({
          'symbolic-ref': () => Promise.reject(new Error('no origin/HEAD')),
        })
      );

      const result = await worktreeManager.createWorktree(
        '/tmp/project',
        'feature-1',
        'Test'
      );

      expect(result.baseBranch).toBe('main');
    });

    it('should fallback to origin/master when main unavailable', async () => {
      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation({
          'symbolic-ref': () => Promise.reject(new Error('no origin/HEAD')),
          'show-ref --verify --quiet refs/remotes/origin/main': () => Promise.reject(new Error('not found')),
        })
      );

      const result = await worktreeManager.createWorktree(
        '/tmp/project',
        'feature-1',
        'Test'
      );

      expect(result.baseBranch).toBe('master');
    });

    it('should use HEAD as last resort base branch', async () => {
      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation({
          'remote get-url origin': () => Promise.reject(new Error('no origin')),
        })
      );

      const result = await worktreeManager.createWorktree(
        '/tmp/project',
        'feature-1',
        'Test'
      );

      expect(result.baseCommit).toBe('abc123def456');
    });

    it('should reject if branch already exists', async () => {
      (mockGitExecutor.run as any).mockImplementation((opts: any) => {
        const cmd = opts.argv ? opts.argv.join(' ') : '';

        // Check for the actual branch name 'Test', not the worktree name 'feature-1'
        if (cmd.includes('show-ref --verify --quiet refs/heads/Test')) {
          return Promise.resolve({
            commandDisplay: cmd,
            commandCopy: cmd,
            stdout: 'abc123 refs/heads/Test',
            stderr: '',
            exitCode: 0,
            durationMs: 0,
            operationId: 'test-op-id',
          });
        }

        return createWorktreeMockImplementation()(opts);
      });

      await expect(
        worktreeManager.createWorktree('/tmp/project', 'feature-1', 'Test')
      ).rejects.toThrow('already exists');
    });

    it('should fetch from origin if remote exists', async () => {
      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation()
      );

      await worktreeManager.createWorktree('/tmp/project', 'feature-1', 'Test');

      expect(mockGitExecutor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['fetch']),
        })
      );
    });

    it('should prefer upstream when origin is a fork of upstream', async () => {
      const ok = (cmd: string, stdout = '') =>
        Promise.resolve({
          commandDisplay: cmd,
          commandCopy: cmd,
          stdout,
          stderr: '',
          exitCode: 0,
          durationMs: 0,
          operationId: 'test-op-id',
        });

      (mockGitExecutor.run as any).mockImplementation(
        createWorktreeMockImplementation({
          'remote get-url origin': (cmd) => ok(cmd, 'git@github.com:forkowner/snowtree.git'),
          'remote get-url upstream': (cmd) => ok(cmd, 'git@github.com:datafuselabs/snowtree.git'),
          'symbolic-ref refs/remotes/upstream/HEAD': (cmd) => ok(cmd, 'refs/remotes/upstream/main'),
          'rev-parse upstream/': (cmd) => ok(cmd, 'abc123def456'),
        })
      );

      await worktreeManager.createWorktree('/tmp/project', 'feature-1', 'Test');

      expect(mockGitExecutor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['git', 'fetch', 'upstream'],
        })
      );
    });
  });

  describe('removeWorktreePath', () => {
    it('should remove worktree', async () => {
      await worktreeManager.removeWorktreePath('/tmp/project', '/tmp/worktree');

      expect(mockGitExecutor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['worktree', 'remove']),
        })
      );
    });

    it('should force remove when specified', async () => {
      await worktreeManager.removeWorktreePath('/tmp/project', '/tmp/worktree', true);

      expect(mockGitExecutor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['--force']),
        })
      );
    });

    it('should handle already removed worktree gracefully', async () => {
      (mockGitExecutor.run as any).mockResolvedValue({
        commandDisplay: 'git worktree remove /tmp/worktree --force',
        commandCopy: 'git worktree remove /tmp/worktree --force',
        stdout: '',
        stderr: 'not a working tree',
        exitCode: 0,
        durationMs: 0,
        operationId: 'test-op-id',
      });

      await worktreeManager.removeWorktreePath('/tmp/project', '/tmp/worktree');
    });
  });

  describe('listWorktrees', () => {
    it('should parse worktree list output', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main

worktree /path/to/feature
HEAD def789ghi012
branch refs/heads/feature-1`,
      });

      const worktrees = await worktreeManager.listWorktrees('/tmp/project');

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0].path).toBe('/path/to/main');
      expect(worktrees[1].path).toBe('/path/to/feature');
    });

    it('should extract branch names', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: `worktree /path/to/main
HEAD abc123
branch refs/heads/main`,
      });

      const worktrees = await worktreeManager.listWorktrees('/tmp/project');

      expect(worktrees[0].branch).toBe('main');
    });

    it('should handle detached HEAD state', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: `worktree /path/to/detached
HEAD abc123
detached`,
      });

      const worktrees = await worktreeManager.listWorktrees('/tmp/project');

      expect(worktrees[0].detached).toBe(true);
      expect(worktrees[0].branch).toBeNull();
    });

    it('should return empty array for no worktrees', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: '',
      });

      const worktrees = await worktreeManager.listWorktrees('/tmp/project');

      expect(worktrees).toEqual([]);
    });
  });

  describe('listWorktreesDetailed', () => {
    it('should include file statistics', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: `worktree /path/to/main
HEAD abc123
branch refs/heads/main`,
      });

      mockGitCommand(mockGitExecutor, 'diff --shortstat', {
        stdout: '5 files changed, 100 insertions(+), 50 deletions(-)',
      });

      const worktrees = await worktreeManager.listWorktreesDetailed('/tmp/project');

      expect(worktrees[0].filesChanged).toBe(5);
      expect(worktrees[0].additions).toBe(100);
      expect(worktrees[0].deletions).toBe(50);
    });

    it('should parse diff stat output correctly', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: `worktree /path/to/main
HEAD abc123
branch refs/heads/main`,
      });

      mockGitCommand(mockGitExecutor, 'diff --shortstat', {
        stdout: '1 file changed, 10 insertions(+)',
      });

      const worktrees = await worktreeManager.listWorktreesDetailed('/tmp/project');

      expect(worktrees[0].filesChanged).toBe(1);
      expect(worktrees[0].additions).toBe(10);
      expect(worktrees[0].deletions).toBe(0);
    });

    it('should handle no changes gracefully', async () => {
      mockGitCommand(mockGitExecutor, 'worktree list', {
        stdout: `worktree /path/to/main
HEAD abc123
branch refs/heads/main`,
      });

      mockGitCommand(mockGitExecutor, 'diff --shortstat', {
        stdout: '',
      });

      const worktrees = await worktreeManager.listWorktreesDetailed('/tmp/project');

      expect(worktrees[0].filesChanged).toBe(0);
      expect(worktrees[0].additions).toBe(0);
      expect(worktrees[0].deletions).toBe(0);
    });
  });

  describe('getProjectMainBranch', () => {
    it('should return current branch name', async () => {
      mockGitCommand(mockGitExecutor, 'branch --show-current', {
        stdout: 'main\n',
      });

      const branch = await worktreeManager.getProjectMainBranch('/tmp/project');

      expect(branch).toBe('main');
    });

    it('should handle detached HEAD state', async () => {
      mockGitCommand(mockGitExecutor, 'branch --show-current', {
        stdout: '',
      });

      await expect(
        worktreeManager.getProjectMainBranch('/tmp/project')
      ).rejects.toThrow('detached HEAD state');
    });

    it('should trim whitespace from branch name', async () => {
      mockGitCommand(mockGitExecutor, 'branch --show-current', {
        stdout: '  develop  \n',
      });

      const branch = await worktreeManager.getProjectMainBranch('/tmp/project');

      expect(branch).toBe('develop');
    });
  });

  describe('initializeProject', () => {
    it('should not fail if directory already exists', async () => {
      await expect(
        worktreeManager.initializeProject('/tmp/project')
      ).resolves.not.toThrow();
    });
  });
});
