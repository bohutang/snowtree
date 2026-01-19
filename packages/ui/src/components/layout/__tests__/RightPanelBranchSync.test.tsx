import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightPanel } from '../RightPanel/index';
import type { Session } from '../../../types/session';
import type { RightPanelData } from '../useRightPanelData';

// Mock the useRightPanelData hook
vi.mock('../useRightPanelData', () => ({
  useRightPanelData: vi.fn(),
}));

import { useRightPanelData } from '../useRightPanelData';

const mockUseRightPanelData = useRightPanelData as ReturnType<typeof vi.fn>;

describe('RightPanel - Branch Sync Button States', () => {
  const mockSession: Session = {
    id: 'test-session-123',
    name: 'Test Session',
    status: 'active',
    createdAt: new Date().toISOString(),
    baseBranch: 'main',
    toolType: 'claude',
  };

  const mockOnFileClick = vi.fn();
  const mockOnPushPR = vi.fn();
  const mockOnUpdateBranch = vi.fn();
  const mockOnSyncPR = vi.fn();

  const defaultMockData: RightPanelData = {
    commits: [],
    workingTree: { staged: [], unstaged: [], untracked: [] },
    workingTreeDiffs: { all: '', staged: '' },
    remotePullRequest: null,
    branchSyncStatus: null,
    prSyncStatus: null,
    commitFiles: [],
    selection: { kind: 'working' },
    isLoading: false,
    isMutating: false,
    error: null,
    selectWorkingTree: vi.fn(),
    selectCommit: vi.fn(),
    refresh: vi.fn(),
    refreshBranchSync: vi.fn(),
    stageAll: vi.fn(),
    stageFile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRightPanelData.mockReturnValue(defaultMockData);
  });

  const validTimestamp = new Date().toISOString();

  describe('Push & Create/Sync PR Button', () => {
    it('should be disabled when no session commits exist', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: -1, commit_message: 'base commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'abc123' }],
        prSyncStatus: { localAhead: 0, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      const pushButton = screen.getByTestId('right-panel-sync-remote-pr');
      expect(pushButton).toBeDisabled();
    });

    it('should be disabled when localAhead is 0 and PR exists', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      const pushButton = screen.getByTestId('right-panel-sync-remote-pr');
      expect(pushButton).toBeDisabled();
    });

    it('should be enabled when localAhead > 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 2, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      const pushButton = screen.getByTestId('right-panel-sync-remote-pr');
      expect(pushButton).not.toBeDisabled();
    });

    it('should show synced badge when localAhead is 0 and PR exists', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      expect(screen.getByText('✓ synced')).toBeInTheDocument();
    });

    it('should show ahead count badge when localAhead > 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 3, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      expect(screen.getByText('↑3')).toBeInTheDocument();
    });

    it('should be disabled when PR is merged', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'merged' },
        prSyncStatus: { localAhead: 2, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      const pushButton = screen.getByTestId('right-panel-sync-remote-pr');
      expect(pushButton).toBeDisabled();
    });
  });

  describe('Sync PR Changes Button', () => {
    it('should be disabled when remoteAhead is 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      const syncButton = screen.getByTestId('right-panel-fetch-pr-updates');
      expect(syncButton).toBeDisabled();
    });

    it('should be enabled when remoteAhead > 0 and no uncommitted changes', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        workingTree: { staged: [], unstaged: [], untracked: [] },
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 3, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      const syncButton = screen.getByTestId('right-panel-fetch-pr-updates');
      expect(syncButton).not.toBeDisabled();
    });

    it('should be disabled when there are uncommitted changes', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        workingTree: { staged: [{ path: 'test.ts', additions: 1, deletions: 0, type: 'modified' }], unstaged: [], untracked: [] },
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 3, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      const syncButton = screen.getByTestId('right-panel-fetch-pr-updates');
      expect(syncButton).toBeDisabled();
    });

    it('should show synced badge when remoteAhead is 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      // There are multiple "synced" badges on the page, check both exist
      const syncedBadges = screen.getAllByText('✓ synced');
      expect(syncedBadges.length).toBeGreaterThan(0);
    });

    it('should show behind count badge when remoteAhead > 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 5, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      expect(screen.getByText('↓5')).toBeInTheDocument();
    });

    it('should be disabled when PR is merged', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'merged' },
        prSyncStatus: { localAhead: 0, remoteAhead: 3, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      const syncButton = screen.getByTestId('right-panel-fetch-pr-updates');
      expect(syncButton).toBeDisabled();
    });

    it('should show warning when uncommitted changes exist and remoteAhead > 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        workingTree: { staged: [{ path: 'test.ts', additions: 1, deletions: 0, type: 'modified' }], unstaged: [], untracked: [] },
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 0, remoteAhead: 3, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onSyncPR={mockOnSyncPR}
        />
      );

      expect(screen.getByText('Commit changes first')).toBeInTheDocument();
    });
  });

  describe('Update from Main Button', () => {
    it('should be disabled when commitsBehindMain is 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        branchSyncStatus: { commitsBehindMain: 0, baseBranch: 'main' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      const updateButton = screen.getByTestId('right-panel-update-branch');
      expect(updateButton).toBeDisabled();
    });

    it('should be enabled when commitsBehindMain > 0 and no uncommitted changes', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        workingTree: { staged: [], unstaged: [], untracked: [] },
        branchSyncStatus: { commitsBehindMain: 5, baseBranch: 'main' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      const updateButton = screen.getByTestId('right-panel-update-branch');
      expect(updateButton).not.toBeDisabled();
    });

    it('should be disabled when there are uncommitted changes', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        workingTree: { staged: [], unstaged: [{ path: 'test.ts', additions: 1, deletions: 0, type: 'modified' }], untracked: [] },
        branchSyncStatus: { commitsBehindMain: 5, baseBranch: 'main' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      const updateButton = screen.getByTestId('right-panel-update-branch');
      expect(updateButton).toBeDisabled();
    });

    it('should show latest badge when commitsBehindMain is 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        branchSyncStatus: { commitsBehindMain: 0, baseBranch: 'main' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      expect(screen.getByText('✓ latest')).toBeInTheDocument();
    });

    it('should show behind count badge when commitsBehindMain > 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        branchSyncStatus: { commitsBehindMain: 10, baseBranch: 'main' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      expect(screen.getByText('↓10')).toBeInTheDocument();
    });

    it('should show custom base branch name in button text', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        branchSyncStatus: { commitsBehindMain: 5, baseBranch: 'master' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      expect(screen.getByText('Update from master')).toBeInTheDocument();
    });

    it('should show warning when uncommitted changes exist and commitsBehindMain > 0', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        workingTree: { staged: [], unstaged: [], untracked: [{ path: 'new.ts', additions: 10, deletions: 0, type: 'added' }] },
        branchSyncStatus: { commitsBehindMain: 5, baseBranch: 'main' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      // Get the specific warning text near the Update button
      const warnings = screen.getAllByText('Commit changes first');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('PR Info Display', () => {
    it('should display PR number when PR exists', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: { number: 456, url: 'https://github.com/owner/repo/pull/456', state: 'open' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
        />
      );

      expect(screen.getByText('PR #456')).toBeInTheDocument();
    });

    it('should display merged badge when PR is merged', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: { number: 789, url: 'https://github.com/owner/repo/pull/789', state: 'merged' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
        />
      );

      expect(screen.getByText('merged')).toBeInTheDocument();
    });

    it('should display "No pull request yet" when no PR exists', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        remotePullRequest: null,
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
        />
      );

      expect(screen.getByText('No pull request yet')).toBeInTheDocument();
    });
  });

  describe('Button Text', () => {
    it('should show "Push & Create PR" when no PR exists', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: null,
        prSyncStatus: { localAhead: 1, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      expect(screen.getByText('Push & Create PR')).toBeInTheDocument();
    });

    it('should show "Push & Sync PR" when PR exists', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        prSyncStatus: { localAhead: 1, remoteAhead: 0, branch: 'feature' },
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
        />
      );

      expect(screen.getByText('Push & Sync PR')).toBeInTheDocument();
    });
  });

  describe('Loading and Mutation States', () => {
    it('should disable all buttons when isLoading is true', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        branchSyncStatus: { commitsBehindMain: 5, baseBranch: 'main' },
        prSyncStatus: { localAhead: 2, remoteAhead: 3, branch: 'feature' },
        isLoading: true,
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
          onSyncPR={mockOnSyncPR}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      expect(screen.getByTestId('right-panel-sync-remote-pr')).toBeDisabled();
      expect(screen.getByTestId('right-panel-fetch-pr-updates')).toBeDisabled();
      expect(screen.getByTestId('right-panel-update-branch')).toBeDisabled();
    });

    it('should disable all buttons when isMutating is true', () => {
      mockUseRightPanelData.mockReturnValue({
        ...defaultMockData,
        commits: [{ id: 1, commit_message: 'commit', timestamp: validTimestamp, stats_additions: 0, stats_deletions: 0, stats_files_changed: 0, after_commit_hash: 'def456' }],
        remotePullRequest: { number: 123, url: 'https://github.com/owner/repo/pull/123', state: 'open' },
        branchSyncStatus: { commitsBehindMain: 5, baseBranch: 'main' },
        prSyncStatus: { localAhead: 2, remoteAhead: 3, branch: 'feature' },
        isMutating: true,
      });

      render(
        <RightPanel
          session={mockSession}
          onFileClick={mockOnFileClick}
          onPushPR={mockOnPushPR}
          onSyncPR={mockOnSyncPR}
          onUpdateBranch={mockOnUpdateBranch}
        />
      );

      expect(screen.getByTestId('right-panel-sync-remote-pr')).toBeDisabled();
      expect(screen.getByTestId('right-panel-fetch-pr-updates')).toBeDisabled();
      expect(screen.getByTestId('right-panel-update-branch')).toBeDisabled();
    });
  });
});
