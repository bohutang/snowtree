import React, { useState, useCallback, useMemo } from 'react';
import { RefreshCw, ChevronDown, GitCommit, Copy, GitPullRequest } from 'lucide-react';
import { useRightPanelData, type Commit, type WorkingTree } from './useRightPanelData';
import type { FileChange, RightPanelProps } from './types';
import type { DiffTarget } from '../../types/diff';

type ColorScheme = {
  bg: { primary: string; secondary: string; hover: string; selected: string };
  text: { primary: string; secondary: string; muted: string; added: string; deleted: string; modified: string; renamed: string };
  accent: string;
  border: string;
};

const colors: ColorScheme = {
  bg: {
    primary: 'var(--st-bg)',
    secondary: 'var(--st-surface)',
    hover: 'var(--st-hover)',
    selected: 'var(--st-selected)',
  },
  text: {
    primary: 'var(--st-text)',
    secondary: 'var(--st-text-muted)',
    muted: 'var(--st-text-faint)',
    added: 'var(--st-success)',
    deleted: 'var(--st-danger)',
    modified: 'var(--st-warning)',
    renamed: 'var(--st-accent)',
  },
  accent: 'var(--st-accent)',
  border: 'var(--st-border-variant)',
};

const stack = {
  line: 'color-mix(in srgb, var(--st-text-faint) 55%, transparent)',
  arrow: 'color-mix(in srgb, var(--st-text-faint) 82%, transparent)',
};

const StackConnector: React.FC<{ accent?: boolean }> = React.memo(({ accent }) => {
  const line = accent ? 'color-mix(in srgb, var(--st-accent) 55%, transparent)' : stack.line;
  const arrow = accent ? 'color-mix(in srgb, var(--st-accent) 82%, transparent)' : stack.arrow;
  const gradId = useMemo(() => `st-stack-grad-${Math.random().toString(16).slice(2)}`, []);

  return (
    <div className="relative flex-1 w-4 st-stack-connector">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 16 28" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={line} stopOpacity="0" />
            <stop offset="0.2" stopColor={line} stopOpacity="0.9" />
            <stop offset="0.8" stopColor={line} stopOpacity="0.9" />
            <stop offset="1" stopColor={line} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M8 0V28" stroke={`url(#${gradId})`} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M6.25 13.75 L8 15.5 L9.75 13.75" fill="none" stroke={arrow} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
});
StackConnector.displayName = 'StackConnector';

const compareGitPaths = (a: string, b: string) => (a === b ? 0 : a < b ? -1 : 1);

type TriState = 'checked' | 'indeterminate' | 'unchecked';

const TriStateCheckbox: React.FC<{
  state: TriState;
  disabled?: boolean;
  onToggle: () => void;
  testId?: string;
  title?: string;
}> = React.memo(({ state, disabled, onToggle, testId, title }) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === 'indeterminate';
  }, [state]);

  return (
    <input
      ref={inputRef}
      data-testid={testId}
      type="checkbox"
      checked={state === 'checked'}
      disabled={disabled}
      title={title}
      onClick={(e) => e.stopPropagation()}
      onChange={() => onToggle()}
      className="st-focus-ring"
      style={{ width: 14, height: 14, accentColor: 'var(--st-accent)', cursor: disabled ? 'not-allowed' : 'pointer' }}
    />
  );
});
TriStateCheckbox.displayName = 'TriStateCheckbox';

const getTypeInfo = (type: FileChange['type']) => {
  switch (type) {
    case 'added': return { label: 'A', color: colors.text.added, bg: 'rgba(180, 250, 114, 0.15)' };
    case 'deleted': return { label: 'D', color: colors.text.deleted, bg: 'rgba(255, 130, 114, 0.15)' };
    case 'renamed': return { label: 'R', color: colors.text.renamed, bg: 'rgba(0, 194, 255, 0.15)' };
    default: return { label: 'M', color: colors.text.modified, bg: 'rgba(254, 253, 194, 0.15)' };
  }
};

const FileItem: React.FC<{
  file: FileChange;
  onClick: () => void;
  isSelected: boolean;
  testId?: string;
}> = React.memo(({ file, onClick, isSelected, testId }) => {
  const [isHovered, setIsHovered] = useState(false);
  const typeInfo = getTypeInfo(file.type);
  const bg = isSelected ? colors.bg.selected : isHovered ? colors.bg.hover : 'transparent';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors duration-75"
      style={{ backgroundColor: bg, borderLeft: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent' }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-[10px] font-semibold px-1 rounded" style={{ color: typeInfo.color, backgroundColor: typeInfo.bg }}>{typeInfo.label}</span>
        <span className="truncate" style={{ color: isSelected || isHovered ? colors.text.primary : colors.text.secondary }}>{file.path}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0 ml-2 font-mono">
        {file.additions > 0 && <span style={{ color: colors.text.added }}>+{file.additions}</span>}
        {file.deletions > 0 && <span style={{ color: colors.text.deleted }}>-{file.deletions}</span>}
      </div>
    </button>
  );
});
FileItem.displayName = 'FileItem';

const WorkingFileRow: React.FC<{
  file: FileChange;
  stageState: TriState;
  onToggleStage: () => void;
  onClick: () => void;
  isSelected: boolean;
  disabled?: boolean;
  testId?: string;
}> = React.memo(({ file, stageState, onToggleStage, onClick, isSelected, disabled, testId }) => {
  const [isHovered, setIsHovered] = useState(false);
  const typeInfo = getTypeInfo(file.type);
  const bg = isSelected ? colors.bg.selected : isHovered ? colors.bg.hover : 'transparent';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-75"
      style={{ backgroundColor: bg, borderLeft: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent' }}
    >
      <TriStateCheckbox
        state={stageState}
        disabled={disabled}
        onToggle={onToggleStage}
        testId={testId ? `${testId}-checkbox` : undefined}
        title={stageState === 'checked' ? 'Unstage file' : 'Stage file'}
      />
      <span className="font-mono text-[10px] font-semibold px-1 rounded" style={{ color: typeInfo.color, backgroundColor: typeInfo.bg }}>{typeInfo.label}</span>
      <span className="truncate min-w-0 flex-1" style={{ color: isSelected || isHovered ? colors.text.primary : colors.text.secondary }}>{file.path}</span>
      <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0 ml-2 font-mono">
        {file.additions > 0 && <span style={{ color: colors.text.added }}>+{file.additions}</span>}
        {file.deletions > 0 && <span style={{ color: colors.text.deleted }}>-{file.deletions}</span>}
      </div>
    </button>
  );
});
WorkingFileRow.displayName = 'WorkingFileRow';

const CommitItem: React.FC<{
  commit: Commit;
  isSelected: boolean;
  badge?: string;
  onClick: () => void;
}> = React.memo(({ commit, isSelected, badge, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isUncommitted = commit.id === 0;
  const shortHash = isUncommitted ? '' : commit.after_commit_hash.substring(0, 7);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
    }
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };

  const handleCopyHash = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (commit.after_commit_hash) {
      try { await navigator.clipboard.writeText(commit.after_commit_hash); } catch {}
    }
  }, [commit.after_commit_hash]);

  const bg = isSelected ? colors.bg.selected : isHovered ? colors.bg.hover : 'transparent';

  return (
    <div
      className="w-full flex items-stretch gap-2 px-3 py-2 text-xs text-left transition-colors duration-75 select-none"
      style={{ backgroundColor: bg, borderLeft: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 flex items-start gap-2 outline-none focus:ring-1 focus:ring-blue-500/40 rounded"
        aria-label={`Select commit ${isUncommitted ? 'uncommitted changes' : shortHash}`}
      >
        <div className="mt-0.5" style={{ color: isUncommitted ? colors.text.modified : colors.text.muted }}>
          <GitCommit className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="flex-1 min-w-0 truncate font-medium" style={{ color: isUncommitted ? colors.text.modified : (isSelected || isHovered ? colors.text.primary : colors.text.secondary) }}>
              {isUncommitted ? '' : commit.commit_message}
            </span>
            {badge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded lowercase" style={{ backgroundColor: colors.bg.hover, color: colors.text.muted }} title={badge}>
                {badge.toLowerCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: colors.text.muted }}>
            {shortHash && <span className="font-mono">{shortHash}</span>}
            <span className="font-mono">{formatTime(commit.timestamp)}</span>
            <span style={{ color: colors.text.added }}>+{commit.stats_additions}</span>
            <span style={{ color: colors.text.deleted }}>-{commit.stats_deletions}</span>
          </div>
        </div>
      </button>
      {shortHash && (
        <button type="button" onClick={handleCopyHash} className="flex-shrink-0 self-start p-1.5 rounded transition-all duration-75 st-hoverable st-focus-ring" title="Copy commit hash">
          <Copy className="w-3.5 h-3.5" style={{ color: colors.text.muted }} />
        </button>
      )}
    </div>
  );
});
CommitItem.displayName = 'CommitItem';

type WorkingTreeScope = 'all' | 'staged' | 'unstaged' | 'untracked';

function computeTrackedFiles(workingTree: WorkingTree | null): Array<{ file: FileChange; stageState: TriState }> {
  if (!workingTree) return [];
  const map = new Map<string, { staged?: FileChange; unstaged?: FileChange }>();
  for (const f of workingTree.staged) map.set(f.path, { ...(map.get(f.path) || {}), staged: f });
  for (const f of workingTree.unstaged) map.set(f.path, { ...(map.get(f.path) || {}), unstaged: f });

  const merged: Array<{ file: FileChange; stageState: TriState }> = [];
  for (const [path, entry] of map.entries()) {
    const staged = entry.staged;
    const unstaged = entry.unstaged;
    const type = unstaged?.type ?? staged?.type ?? 'modified';
    const additions = (staged?.additions || 0) + (unstaged?.additions || 0);
    const deletions = (staged?.deletions || 0) + (unstaged?.deletions || 0);
    const stageState: TriState = staged && unstaged ? 'indeterminate' : staged ? 'checked' : 'unchecked';
    const isNew = Boolean(staged?.isNew);
    merged.push({ file: { path, type, additions, deletions, isNew }, stageState });
  }
  merged.sort((a, b) => compareGitPaths(a.file.path, b.file.path));
  return merged;
}

function computeUntrackedFiles(workingTree: WorkingTree | null, trackedFiles: Array<{ file: FileChange; stageState: TriState }>): Array<{ file: FileChange; stageState: TriState }> {
  if (!workingTree) return [];
  const fromMap = trackedFiles.filter((x) => x.file.isNew);
  const fromStatus = workingTree.untracked.map((f) => ({ file: f, stageState: 'unchecked' as TriState }));
  const byPath = new Map<string, { file: FileChange; stageState: TriState }>();
  for (const x of [...fromStatus, ...fromMap]) byPath.set(x.file.path, x);
  return Array.from(byPath.values()).sort((a, b) => compareGitPaths(a.file.path, b.file.path));
}

export const RightPanel: React.FC<RightPanelProps> = React.memo(({
  session,
  onFileClick,
  onCommitUncommittedChanges,
  isCommitDisabled,
  onCommitClick,
  onPushPR,
  isPushPRDisabled
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileScope, setSelectedFileScope] = useState<WorkingTreeScope | 'commit' | null>(null);
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

  const isWorkingTreeSelected = selection?.kind === 'working';
  const selectedCommitHash = selection?.kind === 'commit' ? selection.hash : null;

  const trackedFiles = useMemo(() => computeTrackedFiles(workingTree), [workingTree]);
  const trackedList = useMemo(() => trackedFiles.filter((x) => !x.file.isNew), [trackedFiles]);
  const untrackedList = useMemo(() => computeUntrackedFiles(workingTree, trackedFiles), [workingTree, trackedFiles]);

  const workingFilesForDiffOverlay = useMemo(() => {
    const tracked = trackedList.map((x) => x.file);
    const untracked = untrackedList.map((x) => x.file);
    return [...tracked, ...untracked];
  }, [trackedList, untrackedList]);

  const totalCommits = commits.length;
  const totalChanges = isWorkingTreeSelected
    ? (workingTree?.staged.length || 0) + (workingTree?.unstaged.length || 0) + (workingTree?.untracked.length || 0)
    : commitFiles.length;

  const uncommitted = commits.find((c) => c.id === 0) || null;
  const baseCommit = commits.find((c) => c.id === -1) || null;
  const sessionCommits = commits.filter((c) => c.id > 0);
  const headHash = sessionCommits[0]?.after_commit_hash || null;

  const selectedCommit = isWorkingTreeSelected
    ? commits.find((c) => c.id === 0)
    : selectedCommitHash
      ? commits.find((c) => c.id !== 0 && c.after_commit_hash === selectedCommitHash)
      : null;

  const stagedFileCount = workingTree?.staged.length || 0;
  const canStageAll = Boolean((workingTree?.unstaged.length || 0) + (workingTree?.untracked.length || 0));
  const canUnstageAll = Boolean(workingTree?.staged.length || 0);

  const handleCommitSelect = useCallback((commit: Commit) => {
    setSelectedFile(null);
    setSelectedFileScope(null);
    if (commit.id === 0) {
      selectWorkingTree();
      onCommitClick?.({ kind: 'working', scope: 'all' }, []);
    } else {
      selectCommit(commit.after_commit_hash);
      onCommitClick?.({ kind: 'commit', hash: commit.after_commit_hash }, []);
    }
  }, [selectWorkingTree, selectCommit, onCommitClick]);

  const handleCommitFileClick = useCallback((file: FileChange) => {
    setSelectedFile(file.path);
    setSelectedFileScope('commit');
    if (selectedCommitHash) {
      onFileClick(file.path, { kind: 'commit', hash: selectedCommitHash }, commitFiles);
    }
  }, [onFileClick, selectedCommitHash, commitFiles]);

  const handleWorkingFileClick = useCallback((scope: WorkingTreeScope, file: FileChange, groupFiles: FileChange[]) => {
    setSelectedFile(file.path);
    setSelectedFileScope(scope);
    onFileClick(file.path, { kind: 'working', scope }, groupFiles);
  }, [onFileClick]);

  const handleStageAll = useCallback((stage: boolean) => {
    void stageAll(stage);
  }, [stageAll]);

  const handleStageFile = useCallback((filePath: string, stage: boolean) => {
    void stageFile(filePath, stage);
  }, [stageFile]);

  const selectedTarget: DiffTarget | null = isWorkingTreeSelected
    ? { kind: 'working', scope: 'all' }
    : selectedCommitHash
      ? { kind: 'commit', hash: selectedCommitHash }
      : null;

  const isDisabled = isLoading || isMutating;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: colors.bg.primary, borderLeft: `1px solid ${colors.border}` }}>
      {/* Commits section */}
      <div className="flex-shrink-0" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ backgroundColor: colors.bg.secondary }}>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-xs font-medium" style={{ color: colors.text.secondary }}>Sync commits to Remote PR</div>
            <div className="flex items-center gap-1">
              {onPushPR && (
                <button type="button" onClick={onPushPR} disabled={isPushPRDisabled || isDisabled} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40" style={{ color: colors.accent }} title="Sync committed commits to remote PR">
                  <GitPullRequest className="w-3 h-3" />
                  Remote PR
                </button>
              )}
              <button type="button" onClick={refresh} disabled={isDisabled} className="p-1.5 rounded transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40" title="Refresh">
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} style={{ color: colors.text.muted }} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${colors.border}` }} />

        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: colors.bg.secondary }}>
          <button type="button" onClick={() => setIsCommitsExpanded(!isCommitsExpanded)} className="flex items-center gap-1.5 text-xs font-medium transition-all duration-75 px-1.5 py-0.5 -ml-1.5 rounded st-hoverable st-focus-ring" style={{ color: colors.text.secondary }}>
            <ChevronDown className={`w-3 h-3 transition-transform ${isCommitsExpanded ? '' : '-rotate-90'}`} style={{ color: colors.text.muted }} />
            <span>Commits</span>
          </button>
        </div>

        <div style={{ borderTop: `1px solid ${colors.border}` }} />

        {isCommitsExpanded && (
          <div className="max-h-48 overflow-y-auto">
            {totalCommits === 0 ? (
              <div className="flex items-center justify-center py-6 text-xs" style={{ color: colors.text.muted }}>No commits</div>
            ) : (
              <div>
                {uncommitted && (
                  <div className="flex">
                    <div className="w-5 flex flex-col items-center pt-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isWorkingTreeSelected ? colors.accent : colors.text.modified, boxShadow: isWorkingTreeSelected ? `0 0 0 3px color-mix(in srgb, ${colors.accent} 18%, transparent)` : 'none' }} />
                      {(sessionCommits.length > 0 || baseCommit) && <StackConnector accent={isWorkingTreeSelected} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CommitItem commit={uncommitted} isSelected={isWorkingTreeSelected} onClick={() => handleCommitSelect(uncommitted)} />
                    </div>
                  </div>
                )}

                {sessionCommits.map((commit, idx) => {
                  const isSelected = selectedCommitHash === commit.after_commit_hash;
                  const isLastSession = idx === sessionCommits.length - 1;
                  const isHead = headHash === commit.after_commit_hash;
                  return (
                    <div key={commit.after_commit_hash} className="flex">
                      <div className="w-5 flex flex-col items-center pt-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isSelected ? colors.accent : colors.text.muted, boxShadow: isSelected ? `0 0 0 3px color-mix(in srgb, ${colors.accent} 18%, transparent)` : 'none' }} />
                        {(!isLastSession || baseCommit) && <StackConnector accent={isSelected} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CommitItem commit={commit} isSelected={isSelected} badge={isHead ? 'HEAD' : undefined} onClick={() => handleCommitSelect(commit)} />
                      </div>
                    </div>
                  );
                })}

                {baseCommit && (
                  <div className="flex">
                    <div className="w-5 flex flex-col items-center pt-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'transparent', border: `1px solid ${colors.border}` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CommitItem commit={baseCommit} isSelected={selectedCommitHash === baseCommit.after_commit_hash} badge="BASE" onClick={() => handleCommitSelect(baseCommit)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: `1px solid ${colors.border}` }} />

        <div style={{ backgroundColor: colors.bg.secondary }}>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-xs font-medium" style={{ color: colors.text.secondary }}>Commit staged</div>
            <button type="button" onClick={() => onCommitUncommittedChanges?.()} disabled={Boolean(isCommitDisabled) || stagedFileCount === 0} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40" style={{ color: colors.accent }} title="Commit staged only">
              <GitCommit className="w-3 h-3" />
              AI Commit
            </button>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${colors.border}` }} />
      </div>

      {/* Changes section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: colors.bg.secondary, borderBottom: `1px solid ${colors.border}` }}>
          <button type="button" onClick={() => setIsChangesExpanded(!isChangesExpanded)} className="flex items-center gap-1.5 text-xs font-medium transition-all duration-75 px-1.5 py-0.5 -ml-1.5 rounded st-hoverable st-focus-ring" style={{ color: colors.text.secondary }}>
            <ChevronDown className={`w-3 h-3 transition-transform ${isChangesExpanded ? '' : '-rotate-90'}`} style={{ color: colors.text.muted }} />
            <span>Changes</span>
            {totalChanges > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono" style={{ backgroundColor: colors.bg.hover, color: colors.text.muted }}>{totalChanges}</span>
            )}
          </button>
          <div className="flex items-center gap-2">
            {isWorkingTreeSelected && totalChanges > 0 && (
              <div className="flex items-center gap-2">
                {canStageAll ? (
                  <button type="button" data-testid="right-panel-stage-all" disabled={isDisabled} onClick={() => handleStageAll(true)} className="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40" style={{ color: colors.text.primary, backgroundColor: colors.bg.hover, border: `1px solid ${colors.border}` }} title="Stage all">
                    Stage All
                  </button>
                ) : (
                  <button type="button" data-testid="right-panel-unstage-all" disabled={isDisabled || !canUnstageAll} onClick={() => handleStageAll(false)} className="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-75 st-hoverable st-focus-ring disabled:opacity-40" style={{ color: colors.text.primary, backgroundColor: colors.bg.hover, border: `1px solid ${colors.border}` }} title="Unstage all">
                    Unstage All
                  </button>
                )}
              </div>
            )}
            {selectedCommit && (
              <span className="text-[10px] font-mono truncate max-w-[100px]" style={{ color: selectedCommit.id === 0 ? colors.text.modified : colors.accent }} title={selectedCommit.commit_message}>
                {selectedCommit.id === 0 ? '' : selectedCommit.after_commit_hash.substring(0, 7)}
              </span>
            )}
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto transition-all origin-top ${isChangesExpanded ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 h-0'}`} style={{ transitionDuration: '150ms' }}>
          {isLoading && (isWorkingTreeSelected ? !workingTree : commitFiles.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: colors.text.muted }}>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <span className="text-xs" style={{ color: colors.text.deleted }}>{error}</span>
              <button type="button" onClick={refresh} className="text-xs px-3 py-1 rounded transition-all duration-75 st-hoverable st-focus-ring" style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>
                Retry
              </button>
            </div>
          ) : isWorkingTreeSelected ? (
            (!workingTree || (workingTree.staged.length + workingTree.unstaged.length + workingTree.untracked.length) === 0) ? (
              <div className="flex items-center justify-center py-8 text-xs" style={{ color: colors.text.muted }}>
                {!selectedTarget ? 'Select a commit' : 'Working tree clean'}
              </div>
            ) : (
              <div className="py-2">
                {trackedList.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase" style={{ color: colors.text.muted }}>Tracked</div>
                    <div>
                      {trackedList.map(({ file, stageState }) => (
                        <WorkingFileRow
                          key={`tracked:${file.path}`}
                          file={file}
                          stageState={stageState}
                          disabled={isDisabled}
                          onToggleStage={() => handleStageFile(file.path, stageState !== 'checked')}
                          onClick={() => handleWorkingFileClick('all', file, workingFilesForDiffOverlay)}
                          isSelected={selectedFile === file.path && selectedFileScope === 'all'}
                          testId={`right-panel-file-tracked-${file.path}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {untrackedList.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase" style={{ color: colors.text.muted }}>Untracked</div>
                    <div>
                      {untrackedList.map(({ file, stageState }) => (
                        <WorkingFileRow
                          key={`untracked:${file.path}`}
                          file={file}
                          stageState={stageState}
                          disabled={isDisabled}
                          onToggleStage={() => handleStageFile(file.path, stageState !== 'checked')}
                          onClick={() => handleWorkingFileClick('untracked', file, workingFilesForDiffOverlay)}
                          isSelected={selectedFile === file.path && selectedFileScope === 'untracked'}
                          testId={`right-panel-file-untracked-${file.path}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : commitFiles.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs" style={{ color: colors.text.muted }}>
              {!selectedTarget ? 'Select a commit' : 'No changes'}
            </div>
          ) : (
            <div className="py-1">
              {commitFiles.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  onClick={() => handleCommitFileClick(file)}
                  isSelected={selectedFile === file.path && selectedFileScope === 'commit'}
                  testId={`right-panel-file-commit-${file.path}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

RightPanel.displayName = 'RightPanel';

export default RightPanel;
