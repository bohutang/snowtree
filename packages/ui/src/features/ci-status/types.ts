/** Conclusion of a single check run */
export type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | null; // null = still running

/** Status of a single check run */
export type CheckStatus = 'queued' | 'in_progress' | 'completed';

/** A single CI check */
export interface CICheck {
  id: number;
  name: string;
  workflow: string | null;
  status: CheckStatus;
  conclusion: CheckConclusion;
  startedAt: string | null;
  completedAt: string | null;
  detailsUrl: string | null;
}

/** Aggregated rollup state */
export type CIRollupState =
  | 'pending' // checks waiting
  | 'in_progress' // checks running
  | 'success' // all passed
  | 'failure' // has failures
  | 'neutral'; // all skipped or neutral

/** CI status summary */
export interface CIStatus {
  rollupState: CIRollupState;
  checks: CICheck[];
  totalCount: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
}
