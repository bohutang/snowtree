import type { FileChange } from '../types';

export type TriState = 'checked' | 'indeterminate' | 'unchecked';

export type WorkingTreeScope = 'all' | 'staged' | 'unstaged' | 'untracked';

export interface TriStateCheckboxProps {
  state: TriState;
  disabled?: boolean;
  onToggle: () => void;
  testId?: string;
  title?: string;
}

export interface FileItemProps {
  file: FileChange;
  onClick: () => void;
  isSelected: boolean;
  hideStats?: boolean;
  testId?: string;
}

export interface WorkingFileRowProps {
  file: FileChange;
  stageState: TriState;
  onToggleStage: () => void;
  onClick: () => void;
  isSelected: boolean;
  disabled?: boolean;
  testId?: string;
}

export interface CommitData {
  id: number;
  commit_message: string;
  timestamp: string;
  stats_additions: number;
  stats_deletions: number;
  stats_files_changed: number;
  after_commit_hash: string;
  parent_commit_hash?: string | null;
  author?: string;
}

export interface CommitItemProps {
  commit: CommitData;
  isSelected: boolean;
  badge?: string;
  onClick: () => void;
}

export interface StackConnectorProps {
  accent?: boolean;
}

export interface TrackedFileEntry {
  file: FileChange;
  stageState: TriState;
}

export { FileChange };
