import { useMemo } from 'react';
import { getWorkspaceStage, type WorkspaceStage, type WorkspaceStageInput } from '../types/workspace';

/**
 * Hook to compute workspace stage from PR and sync status data.
 * Returns null if no data is available.
 */
export function useWorkspaceStage(data: WorkspaceStageInput | null): WorkspaceStage | null {
  return useMemo(() => {
    if (!data) return null;
    return getWorkspaceStage(data);
  }, [data]);
}
