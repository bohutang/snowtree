import React, { useCallback } from 'react';
import { Check, X, Loader2, Clock, Circle, ExternalLink } from 'lucide-react';
import type { CICheck, CheckStatus, CheckConclusion } from '../types';

interface CIStatusDetailsProps {
  checks: CICheck[];
  onCheckClick?: (check: CICheck) => void;
}

function getCheckIcon(
  status: CheckStatus,
  conclusion: CheckConclusion
): { icon: React.ElementType; color: string; animate?: boolean } {
  if (status === 'in_progress') {
    return { icon: Loader2, color: 'var(--st-accent)', animate: true };
  }
  if (status === 'queued') {
    return { icon: Clock, color: 'var(--st-text-muted)' };
  }

  // Completed - check conclusion
  switch (conclusion) {
    case 'success':
      return { icon: Check, color: 'var(--st-success)' };
    case 'failure':
    case 'timed_out':
    case 'cancelled':
      return { icon: X, color: 'var(--st-danger)' };
    case 'skipped':
    case 'neutral':
    default:
      return { icon: Circle, color: 'var(--st-text-muted)' };
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function getStatusLabel(status: CheckStatus, conclusion: CheckConclusion): string {
  if (status === 'in_progress') return 'running';
  if (status === 'queued') return 'pending';
  return conclusion || 'completed';
}

export const CIStatusDetails: React.FC<CIStatusDetailsProps> = ({
  checks,
  onCheckClick,
}) => {
  const handleClick = useCallback(
    (check: CICheck) => {
      if (onCheckClick && check.detailsUrl) {
        onCheckClick(check);
      }
    },
    [onCheckClick]
  );

  if (checks.length === 0) {
    return (
      <div
        className="text-[10px] px-2 py-1.5"
        style={{ color: 'var(--st-text-muted)' }}
      >
        No checks
      </div>
    );
  }

  return (
    <div
      className="rounded overflow-hidden"
      style={{
        backgroundColor: 'var(--st-hover)',
        border: '1px solid var(--st-border-variant)',
      }}
    >
      {checks.map((check) => {
        const { icon: Icon, color, animate } = getCheckIcon(
          check.status,
          check.conclusion
        );
        const hasLink = Boolean(check.detailsUrl);
        const timeStr = formatRelativeTime(check.completedAt || check.startedAt);
        const statusLabel = getStatusLabel(check.status, check.conclusion);

        return (
          <button
            key={check.id}
            type="button"
            onClick={() => handleClick(check)}
            disabled={!hasLink}
            className={`w-full flex items-center justify-between px-2 py-1.5 text-[10px] transition-all duration-75 ${
              hasLink ? 'st-hoverable cursor-pointer' : 'cursor-default'
            }`}
            style={{
              borderBottom: '1px solid var(--st-border-variant)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon
                className={`w-3 h-3 flex-shrink-0 ${animate ? 'animate-spin' : ''}`}
                style={{ color }}
                strokeWidth={2.5}
              />
              <span
                className="truncate"
                style={{ color: 'var(--st-text)' }}
                title={check.workflow ? `${check.workflow} / ${check.name}` : check.name}
              >
                {check.workflow ? `${check.workflow} / ${check.name}` : check.name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span style={{ color: 'var(--st-text-muted)' }}>{statusLabel}</span>
              {timeStr && (
                <span style={{ color: 'var(--st-text-faint)' }}>{timeStr}</span>
              )}
              {hasLink && (
                <ExternalLink
                  className="w-3 h-3"
                  style={{ color: 'var(--st-text-faint)' }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
