import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Check, X, Loader2, Circle, ChevronDown } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  const handleCheckClick = useCallback((e: React.MouseEvent, check: CICheck) => {
    e.stopPropagation();
    if (check.detailsUrl) {
      window.electronAPI?.invoke?.('shell:openExternal', check.detailsUrl);
      setExpanded(false);
    }
  }, []);

  // Close dropdown when clicking outside - use mousedown for immediate response
  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    // Use mousedown instead of click for immediate response before other handlers
    document.addEventListener('mousedown', handleClickOutside, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [expanded]);

  const { successCount, totalCount, rollupState } = ciStatus;

  return (
    <div className="relative" ref={containerRef}>
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

      {/* Expanded details - positioned absolutely to avoid layout disruption */}
      {expanded && (
        <div
          className="absolute top-full right-0 mt-1 pl-2 pr-2 py-1 border rounded-md shadow-lg z-10"
          style={{
            borderColor: 'var(--st-border)',
            backgroundColor: 'var(--st-surface)',
            minWidth: '160px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {ciStatus.checks.map((check, idx) => (
            <button
              type="button"
              key={check.id || idx}
              onClick={(e) => handleCheckClick(e, check)}
              className="flex items-center gap-1.5 py-1 px-1 text-[10px] w-full rounded st-hoverable"
              style={{
                cursor: check.detailsUrl ? 'pointer' : 'default',
                backgroundColor: 'transparent'
              }}
              title={check.detailsUrl ? `Open ${check.name} in browser` : check.name}
            >
              {getCheckIcon(check, 'w-2.5 h-2.5')}
              <span
                className="truncate flex-1 text-left"
                style={{
                  color: check.conclusion === 'failure' || check.conclusion === 'timed_out'
                    ? 'var(--st-danger)'
                    : 'var(--st-text-muted)',
                  maxWidth: '140px'
                }}
              >
                {check.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

SidebarCIStatus.displayName = 'SidebarCIStatus';

export default SidebarCIStatus;
