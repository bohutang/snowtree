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
  reviewDraft: {
    bg: 'color-mix(in srgb, var(--st-text-muted) 20%, transparent)',
    color: 'var(--st-text-muted)',
  },
  reviewAhead: {
    bg: 'color-mix(in srgb, var(--st-accent) 20%, transparent)',
    color: 'var(--st-accent)',
  },
  reviewAheadDraft: {
    bg: 'color-mix(in srgb, var(--st-text-muted) 20%, transparent)',
    color: 'var(--st-text-muted)',
  },
  reviewBehind: {
    bg: 'color-mix(in srgb, var(--st-warning) 20%, transparent)',
    color: 'var(--st-warning)',
  },
  reviewBehindDraft: {
    bg: 'color-mix(in srgb, var(--st-text-muted) 20%, transparent)',
    color: 'var(--st-text-muted)',
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
    const { prNumber, ahead, behind, isDraft } = stage;

    // PR with local commits to push
    if (ahead > 0) {
      const style = isDraft ? STAGE_STYLES.reviewAheadDraft : STAGE_STYLES.reviewAhead;
      return (
        <span
          className={`${baseClasses} ${className}`}
          style={{
            backgroundColor: style.bg,
            color: style.color,
          }}
        >
          PR #{prNumber}
          {isDraft && <span className="ml-0.5">(draft)</span>}
          <ArrowUp className="w-2.5 h-2.5 ml-0.5" />
          {ahead}
        </span>
      );
    }

    // PR with remote commits to pull
    if (behind > 0) {
      const style = isDraft ? STAGE_STYLES.reviewBehindDraft : STAGE_STYLES.reviewBehind;
      return (
        <span
          className={`${baseClasses} ${className}`}
          style={{
            backgroundColor: style.bg,
            color: style.color,
          }}
        >
          PR #{prNumber}
          {isDraft && <span className="ml-0.5">(draft)</span>}
          <ArrowDown className="w-2.5 h-2.5 ml-0.5" />
          {behind}
        </span>
      );
    }

    // PR synced
    const style = isDraft ? STAGE_STYLES.reviewDraft : STAGE_STYLES.review;
    return (
      <span
        className={`${baseClasses} ${className}`}
        style={{
          backgroundColor: style.bg,
          color: style.color,
        }}
      >
        PR #{prNumber}
        {isDraft && <span className="ml-0.5">(draft)</span>}
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
