import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, ChevronDown, GitCommit, GitPullRequest, Download, RotateCw } from 'lucide-react';
import { useRightPanelData, type Commit } from '../useRightPanelData';
import type { FileChange, RightPanelProps } from '../types';
import type { DiffTarget } from '../../../types/diff';
import { colors } from './constants';
import { computeTrackedFiles, computeUntrackedFiles } from './utils';
import { CommitList } from './CommitList';
import { FileChangeList } from './FileChangeList';
import type { WorkingTreeScope } from './types';

export const RightPanel: React.FC<RightPanelProps> = React.memo(
  ({
    session,
    onFileClick,
    onCommitUncommittedChanges,
    isCommitDisabled,
    onCommitClick,
    onPushPR,
    isPushPRDisabled,
  }) => {
    const [appVersion, setAppVersion] = useState<string>('');
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateVersion, setUpdateVersion] = useState<string>('');
    const [updateDownloading, setUpdateDownloading] = useState(false);
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    const [updateError, setUpdateError] = useState<string>('');

    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedFileScope, setSelectedFileScope] = useState<
      WorkingTreeScope | 'commit' | null
    >(null);
    const [isCommitsExpanded, setIsCommitsExpanded] = useState(true);
    const [isChangesExpanded, setIsChangesExpanded] = useState(true);

    const {
      commits,
      workingTree,
      commitFiles,
      selection,
      isLoading,
      isMutating,
      error,
      selectWorkingTree,
      selectCommit,
      refresh,
      stageAll,
      stageFile,
    } = useRightPanelData(session.id);

    useEffect(() => {
      let mounted = true;

      (async () => {
        if (!window.electronAPI?.invoke) return;
        try {
          const version = await window.electronAPI.invoke('get-app-version');
          if (!mounted) return;
          if (typeof version === 'string') setAppVersion(version);
        } catch {
          // ignore
        }
      })();

      const events = window.electronAPI?.events;
      if (
        !events ||
        typeof events.onUpdateAvailable !== 'function' ||
        typeof events.onUpdateDownloaded !== 'function'
      ) {
        return () => {
          mounted = false;
        };
      }

      const unsubscribes = [
        events.onUpdateAvailable((version) => {
          setUpdateAvailable(true);
          setUpdateVersion(version);
          setUpdateDownloaded(false);
          setUpdateError('');
        }),
        events.onUpdateDownloaded(() => {
          setUpdateDownloading(false);
          setUpdateDownloaded(true);
        }),
      ];

      return () => {
        mounted = false;
        unsubscribes.forEach((u) => u());
      };
    }, [session.id]);

    const handleDownloadUpdate = useCallback(async () => {
      if (!window.electronAPI?.updater) return;
      setUpdateDownloading(true);
      setUpdateError('');
      try {
        const res = await window.electronAPI.updater.download();
        if (!res?.success) {
          setUpdateDownloading(false);
          setUpdateError(res?.error || 'Failed to download update');
        }
      } catch (e) {
        setUpdateDownloading(false);
        setUpdateError(e instanceof Error ? e.message : String(e));
      }
    }, []);

    const handleInstallUpdate = useCallback(async () => {
      if (!window.electronAPI?.updater) return;
      try {
        await window.electronAPI.updater.install();
      } catch {
        // ignore
      }
    }, []);

    const handleOpenReleases = useCallback(async () => {
      const tag = appVersion ? `v${appVersion.replace(/^v/, '')}` : '';
      const url = tag
        ? `https://github.com/bohutang/snowtree/releases/tag/${tag}`
        : 'https://github.com/bohutang/snowtree/releases';
      try {
        await window.electronAPI?.invoke?.('shell:openExternal', url);
      } catch {
        // ignore
      }
    }, [appVersion]);

    const isWorkingTreeSelected = selection?.kind === 'working';
    const selectedCommitHash =
      selection?.kind === 'commit' ? selection.hash : null;

    const trackedFiles = useMemo(
      () => computeTrackedFiles(workingTree),
      [workingTree]
    );
    const trackedList = useMemo(
      () => trackedFiles.filter((x) => !x.file.isNew),
      [trackedFiles]
    );
    const untrackedList = useMemo(
      () => computeUntrackedFiles(workingTree, trackedFiles),
      [workingTree, trackedFiles]
    );

    const workingFilesForDiffOverlay = useMemo(() => {
      const tracked = trackedList.map((x) => x.file);
      const untracked = untrackedList.map((x) => x.file);
      return [...tracked, ...untracked];
    }, [trackedList, untrackedList]);

    const totalChanges = isWorkingTreeSelected
      ? (workingTree?.staged.length || 0) +
        (workingTree?.unstaged.length || 0) +
        (workingTree?.untracked.length || 0)
      : commitFiles.length;

    const selectedCommit = isWorkingTreeSelected
      ? commits.find((c) => c.id === 0)
      : selectedCommitHash
        ? commits.find(
            (c) => c.id !== 0 && c.after_commit_hash === selectedCommitHash
          )
        : null;

    const stagedFileCount = workingTree?.staged.length || 0;
    const canStageAll = Boolean(
      (workingTree?.unstaged.length || 0) + (workingTree?.untracked.length || 0)
    );
    const canUnstageAll = Boolean(workingTree?.staged.length || 0);

    const handleCommitSelect = useCallback(
      (commit: Commit) => {
        setSelectedFile(null);
        setSelectedFileScope(null);
        if (commit.id === 0) {
          selectWorkingTree();
          onCommitClick?.({ kind: 'working', scope: 'all' }, []);
        } else {
          selectCommit(commit.after_commit_hash);
          onCommitClick?.({ kind: 'commit', hash: commit.after_commit_hash }, []);
        }
      },
      [selectWorkingTree, selectCommit, onCommitClick]
    );

    const handleCommitFileClick = useCallback(
      (file: FileChange) => {
        setSelectedFile(file.path);
        setSelectedFileScope('commit');
        if (selectedCommitHash) {
          onFileClick(
            file.path,
            { kind: 'commit', hash: selectedCommitHash },
            commitFiles
          );
        }
      },
      [onFileClick, selectedCommitHash, commitFiles]
    );

    const handleWorkingFileClick = useCallback(
      (scope: WorkingTreeScope, file: FileChange, groupFiles: FileChange[]) => {
        setSelectedFile(file.path);
        setSelectedFileScope(scope);
        onFileClick(file.path, { kind: 'working', scope }, groupFiles);
      },
      [onFileClick]
    );

    const handleStageAll = useCallback(
      (stage: boolean) => {
        void stageAll(stage);
      },
      [stageAll]
    );

    const handleStageFile = useCallback(
      (filePath: string, stage: boolean) => {
        void stageFile(filePath, stage);
      },
      [stageFile]
    );

    const selectedTarget: DiffTarget | null = isWorkingTreeSelected
      ? { kind: 'working', scope: 'all' }
      : selectedCommitHash
        ? { kind: 'commit', hash: selectedCommitHash }
        : null;

    const isDisabled = isLoading || isMutating;

    return (
      <div
        className="h-full flex flex-col"
        style={{
          backgroundColor: colors.bg.primary,
          borderLeft: `1px solid ${colors.border}`,
        }}
      >
        <div
          className="flex-shrink-0"
          style={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <div style={{ backgroundColor: colors.bg.secondary }}>
            <div className="flex items-center justify-between px-3 py-2">
              <div
                className="text-xs font-medium"
                style={{ color: colors.text.secondary }}
              >
                Sync commits to Remote PR
              </div>
              <div className="flex items-center gap-1">
                {onPushPR && (
                  <button
                    type="button"
                    onClick={onPushPR}
                    disabled={isPushPRDisabled || isDisabled}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                    style={{ color: colors.accent }}
                    title="Sync committed commits to remote PR"
                  >
                    <GitPullRequest className="w-3 h-3" />
                    Remote PR
                  </button>
                )}
                <button
                  type="button"
                  onClick={refresh}
                  disabled={isDisabled}
                  className="p-1.5 rounded transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}
                    style={{ color: colors.text.muted }}
                  />
                </button>
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}` }} />

          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <button
              type="button"
              onClick={() => setIsCommitsExpanded(!isCommitsExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium transition-all duration-75 px-1.5 py-0.5 -ml-1.5 rounded st-hoverable st-focus-ring"
              style={{ color: colors.text.secondary }}
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isCommitsExpanded ? '' : '-rotate-90'}`}
                style={{ color: colors.text.muted }}
              />
              <span>Commits</span>
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}` }} />

          {isCommitsExpanded && (
            <div className="max-h-48 overflow-y-auto">
              <CommitList
                commits={commits}
                selectedCommitHash={selectedCommitHash}
                isWorkingTreeSelected={isWorkingTreeSelected}
                onCommitSelect={handleCommitSelect}
              />
            </div>
          )}

          <div style={{ borderTop: `1px solid ${colors.border}` }} />

          <div style={{ backgroundColor: colors.bg.secondary }}>
            <div className="flex items-center justify-between px-3 py-2">
              <div
                className="text-xs font-medium"
                style={{ color: colors.text.secondary }}
              >
                Commit staged
              </div>
              <button
                type="button"
                onClick={() => onCommitUncommittedChanges?.()}
                disabled={Boolean(isCommitDisabled) || stagedFileCount === 0}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                style={{ color: colors.accent }}
                title="Commit staged only"
              >
                <GitCommit className="w-3 h-3" />
                AI Commit
              </button>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}` }} />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{
              backgroundColor: colors.bg.secondary,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <button
              type="button"
              onClick={() => setIsChangesExpanded(!isChangesExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium transition-all duration-75 px-1.5 py-0.5 -ml-1.5 rounded st-hoverable st-focus-ring"
              style={{ color: colors.text.secondary }}
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isChangesExpanded ? '' : '-rotate-90'}`}
                style={{ color: colors.text.muted }}
              />
              <span>Changes</span>
              {totalChanges > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono"
                  style={{
                    backgroundColor: colors.bg.hover,
                    color: colors.text.muted,
                  }}
                >
                  {totalChanges}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              {isWorkingTreeSelected && totalChanges > 0 && (
                <div className="flex items-center gap-2">
                  {canStageAll ? (
                    <button
                      type="button"
                      data-testid="right-panel-stage-all"
                      disabled={isDisabled}
                      onClick={() => handleStageAll(true)}
                      className="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                      style={{
                        color: colors.text.primary,
                        backgroundColor: colors.bg.hover,
                        border: `1px solid ${colors.border}`,
                      }}
                      title="Stage all"
                    >
                      Stage All
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="right-panel-unstage-all"
                      disabled={isDisabled || !canUnstageAll}
                      onClick={() => handleStageAll(false)}
                      className="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                      style={{
                        color: colors.text.primary,
                        backgroundColor: colors.bg.hover,
                        border: `1px solid ${colors.border}`,
                      }}
                      title="Unstage all"
                    >
                      Unstage All
                    </button>
                  )}
                </div>
              )}
              {selectedCommit && (
                <span
                  className="text-[10px] font-mono truncate max-w-[100px]"
                  style={{
                    color:
                      selectedCommit.id === 0
                        ? colors.text.modified
                        : colors.accent,
                  }}
                  title={selectedCommit.commit_message}
                >
                  {selectedCommit.id === 0
                    ? ''
                    : selectedCommit.after_commit_hash.substring(0, 7)}
                </span>
              )}
            </div>
          </div>

          <div
            className={`flex-1 overflow-y-auto transition-all origin-top ${isChangesExpanded ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 h-0'}`}
            style={{ transitionDuration: '150ms' }}
          >
            <FileChangeList
              isWorkingTreeSelected={isWorkingTreeSelected}
              isLoading={isLoading}
              error={error}
              workingTree={workingTree}
              commitFiles={commitFiles}
              trackedList={trackedList}
              untrackedList={untrackedList}
              selectedFile={selectedFile}
              selectedFileScope={selectedFileScope}
              isDisabled={isDisabled}
              workingFilesForDiffOverlay={workingFilesForDiffOverlay}
              onRefresh={refresh}
              onStageFile={handleStageFile}
              onWorkingFileClick={handleWorkingFileClick}
              onCommitFileClick={handleCommitFileClick}
              hasSelection={Boolean(selectedTarget)}
            />
          </div>
        </div>

        <div
          className="flex-shrink-0 px-3 py-2"
          style={{
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: colors.bg.secondary,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            {updateAvailable && (
              <div className="flex items-center gap-1.5">
                {!updateDownloaded ? (
                  <button
                    type="button"
                    onClick={handleDownloadUpdate}
                    disabled={updateDownloading}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40"
                    style={{ color: colors.accent }}
                    title={`Download update v${updateVersion}`}
                  >
                    {updateDownloading ? (
                      <RotateCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Update
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleInstallUpdate}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring"
                    style={{ color: colors.accent }}
                    title={`Restart to install v${updateVersion}`}
                  >
                    Restart
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenReleases}
              className="ml-auto text-[10px] font-mono truncate st-hoverable st-focus-ring px-1.5 py-0.5 rounded"
              style={{ color: colors.text.muted }}
              title="Open GitHub Releases"
            >
              {appVersion ? `snowtree v${appVersion}` : 'snowtree'}
            </button>
          </div>

          {updateError && (
            <div className="mt-1 text-[10px] leading-snug" style={{ color: colors.text.muted }}>
              {updateError}
            </div>
          )}
        </div>
      </div>
    );
  }
);

RightPanel.displayName = 'RightPanel';

export default RightPanel;
