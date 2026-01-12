/**
 * Workspace stage represents the current phase in the development workflow.
 */
export type WorkspaceStage =
  | { stage: 'working' }
  | { stage: 'review'; prNumber: number; ahead: number; behind: number }
  | { stage: 'merged' };

/**
 * Input data for computing workspace stage.
 */
export interface WorkspaceStageInput {
  remotePullRequest: {
    number: number;
    url: string;
    merged: boolean;
  } | null;
  prSyncStatus: {
    localAhead: number;
    remoteAhead: number;
    branch: string | null;
  } | null;
}

/**
 * Compute the workspace stage based on PR and sync status.
 */
export function getWorkspaceStage(data: WorkspaceStageInput): WorkspaceStage {
  const { remotePullRequest, prSyncStatus } = data;

  // Stage 3: Merged
  if (remotePullRequest?.merged) {
    return { stage: 'merged' };
  }

  // Stage 2: In Review
  if (remotePullRequest) {
    return {
      stage: 'review',
      prNumber: remotePullRequest.number,
      ahead: prSyncStatus?.localAhead ?? 0,
      behind: prSyncStatus?.remoteAhead ?? 0,
    };
  }

  // Stage 1: Working (default)
  return { stage: 'working' };
}
