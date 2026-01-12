import React from 'react';
import { Check, ArrowUp, ArrowDown } from 'lucide-react';
import type { WorkspaceStage } from '../../types/workspace';

interface StageBadgeProps {
  stage: WorkspaceStage;
  className?: string;
}

const STAGE_STYLES = {
  working: {
    bg: 'color-mix(in srgb, var(--st-warning) 20%, transparent)',
    color: 'var(--st-warning)',
  },
  review: {
    bg: 'color-mix(in srgb, var(--st-accent) 20%, transparent)',
    color: 'var(--st-accent)',
  },
  reviewAhead: {
    bg: 'color-mix(in srgb, var(--st-accent) 20%, transparent)',
    color: 'var(--st-accent)',
  },
  reviewBehind: {
    bg: 'color-mix(in srgb, var(--st-warning) 20%, transparent)',
    color: 'var(--st-warning)',
  },
  merged: {
    bg: 'color-mix(in srgb, var(--st-success) 20%, transparent)',
    color: 'var(--st-success)',
  },
} as const;

export const StageBadge: React.FC<StageBadgeProps> = React.memo(({ stage, className = '' }) => {
  const baseClasses = 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap';

  if (stage.stage === 'merged') {
    return (
      <span
        className={`${baseClasses} ${className}`}
        style={{
          backgroundColor: STAGE_STYLES.merged.bg,
          color: STAGE_STYLES.merged.color,
        }}
      >
        <Check className="w-2.5 h-2.5" />
        merged
      </span>
    );
  }

  if (stage.stage === 'review') {
    const { prNumber, ahead, behind } = stage;

    // PR with local commits to push
    if (ahead > 0) {
      return (
        <span
          className={`${baseClasses} ${className}`}
          style={{
            backgroundColor: STAGE_STYLES.reviewAhead.bg,
            color: STAGE_STYLES.reviewAhead.color,
          }}
        >
          PR #{prNumber}
          <ArrowUp className="w-2.5 h-2.5 ml-0.5" />
          {ahead}
        </span>
      );
    }

    // PR with remote commits to pull
    if (behind > 0) {
      return (
        <span
          className={`${baseClasses} ${className}`}
          style={{
            backgroundColor: STAGE_STYLES.reviewBehind.bg,
            color: STAGE_STYLES.reviewBehind.color,
          }}
        >
          PR #{prNumber}
          <ArrowDown className="w-2.5 h-2.5 ml-0.5" />
          {behind}
        </span>
      );
    }

    // PR synced
    return (
      <span
        className={`${baseClasses} ${className}`}
        style={{
          backgroundColor: STAGE_STYLES.review.bg,
          color: STAGE_STYLES.review.color,
        }}
      >
        PR #{prNumber}
        <Check className="w-2.5 h-2.5 ml-0.5" />
      </span>
    );
  }

  // Working stage
  return (
    <span
      className={`${baseClasses} ${className}`}
      style={{
        backgroundColor: STAGE_STYLES.working.bg,
        color: STAGE_STYLES.working.color,
      }}
    >
      working
    </span>
  );
});

StageBadge.displayName = 'StageBadge';

export default StageBadge;
