import React, { useState, useCallback } from 'react';
import { Check, X, Loader2, Circle, ChevronDown, ExternalLink } from 'lucide-react';
import type { CIStatus, CIRollupState, CICheck } from '../types';

interface SidebarCIStatusProps {
  ciStatus: CIStatus;
}

const getStatusIcon = (state: CIRollupState, size: string = 'w-3 h-3') => {
  switch (state) {
    case 'success':
      return <Check className={size} style={{ color: 'var(--st-success)' }} />;
    case 'failure':
      return <X className={size} style={{ color: 'var(--st-danger)' }} />;
    case 'in_progress':
      return <Loader2 className={`${size} animate-spin`} style={{ color: 'var(--st-accent)' }} />;
    case 'pending':
      return <Circle className={size} style={{ color: 'var(--st-text-faint)' }} />;
    default:
      return <Circle className={size} style={{ color: 'var(--st-text-faint)' }} />;
  }
};

const getCheckIcon = (check: CICheck, size: string = 'w-3 h-3') => {
  if (check.status !== 'completed') {
    if (check.status === 'in_progress') {
      return <Loader2 className={`${size} animate-spin`} style={{ color: 'var(--st-accent)' }} />;
    }
    return <Circle className={size} style={{ color: 'var(--st-text-faint)' }} />;
  }

  switch (check.conclusion) {
    case 'success':
      return <Check className={size} style={{ color: 'var(--st-success)' }} />;
    case 'failure':
    case 'timed_out':
      return <X className={size} style={{ color: 'var(--st-danger)' }} />;
    case 'cancelled':
      return <X className={size} style={{ color: 'var(--st-text-faint)' }} />;
    default:
      return <Circle className={size} style={{ color: 'var(--st-text-faint)' }} />;
  }
};

export const SidebarCIStatus: React.FC<SidebarCIStatusProps> = React.memo(({
  ciStatus
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  const handleOpenLink = useCallback((e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.electronAPI?.invoke?.('shell:openExternal', url);
  }, []);

  const { successCount, totalCount, rollupState } = ciStatus;

  return (
    <div className="flex flex-col">
      {/* Compact badge - clickable */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1 text-[11px] st-hoverable rounded px-1 py-0.5"
        style={{ backgroundColor: 'transparent' }}
        title={expanded ? 'Collapse CI details' : 'Expand CI details'}
      >
        {getStatusIcon(rollupState)}
        <span style={{ color: rollupState === 'failure' ? 'var(--st-danger)' : 'var(--st-text-muted)' }}>
          {successCount}/{totalCount}
        </span>
        <ChevronDown
          className={`w-2.5 h-2.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
          style={{ color: 'var(--st-text-faint)' }}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div
          className="mt-1 ml-1 pl-2 border-l"
          style={{ borderColor: 'var(--st-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {ciStatus.checks.map((check, idx) => (
            <div
              key={check.id || idx}
              className="flex items-center gap-1.5 py-0.5 text-[10px] group"
            >
              {getCheckIcon(check, 'w-2.5 h-2.5')}
              <span
                className="truncate flex-1"
                style={{
                  color: check.conclusion === 'failure' || check.conclusion === 'timed_out'
                    ? 'var(--st-danger)'
                    : 'var(--st-text-muted)',
                  maxWidth: '140px'
                }}
                title={check.name}
              >
                {check.name}
              </span>
              {check.detailsUrl && (
                <button
                  type="button"
                  onClick={(e) => handleOpenLink(e, check.detailsUrl!)}
                  className="opacity-0 group-hover:opacity-100 st-icon-button"
                  style={{ padding: 2 }}
                  title="Open in browser"
                >
                  <ExternalLink className="w-2.5 h-2.5" style={{ color: 'var(--st-text-faint)' }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SidebarCIStatus.displayName = 'SidebarCIStatus';

export default SidebarCIStatus;
