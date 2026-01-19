import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CIStatusBadge } from './CIStatusBadge';
import type { CIStatus } from '../types';

describe('CIStatusBadge', () => {
  const createMockStatus = (overrides: Partial<CIStatus> = {}): CIStatus => ({
    rollupState: 'success',
    checks: [],
    totalCount: 3,
    successCount: 3,
    failureCount: 0,
    pendingCount: 0,
    ...overrides,
  });

  it('renders success state correctly', () => {
    const status = createMockStatus({ rollupState: 'success' });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByTitle('CI: 3/3 checks passed')).toBeInTheDocument();
  });

  it('renders failure state with count', () => {
    const status = createMockStatus({
      rollupState: 'failure',
      successCount: 2,
      failureCount: 1,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument(); // Shows failure count
  });

  it('renders in_progress state', () => {
    const status = createMockStatus({
      rollupState: 'in_progress',
      successCount: 1,
      pendingCount: 2,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument(); // Shows success count when in progress
  });

  it('renders pending state', () => {
    const status = createMockStatus({
      rollupState: 'pending',
      successCount: 0,
      pendingCount: 3,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
  });

  it('renders neutral state', () => {
    const status = createMockStatus({
      rollupState: 'neutral',
      successCount: 0,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
  });

  it('does not show count for single success check', () => {
    const status = createMockStatus({
      rollupState: 'success',
      totalCount: 1,
      successCount: 1,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    render(<CIStatusBadge status={status} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows expand indicator when onClick is provided', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    const { container } = render(<CIStatusBadge status={status} onClick={onClick} />);

    // Check for ChevronRight icon (collapsed state)
    const chevron = container.querySelector('svg.lucide-chevron-right');
    expect(chevron).toBeInTheDocument();
  });

  it('does not show expand indicator when onClick is not provided', () => {
    const status = createMockStatus();
    const { container } = render(<CIStatusBadge status={status} />);

    // No chevron icons should be present
    const chevronRight = container.querySelector('svg.lucide-chevron-right');
    const chevronDown = container.querySelector('svg.lucide-chevron-down');
    expect(chevronRight).not.toBeInTheDocument();
    expect(chevronDown).not.toBeInTheDocument();
  });

  it('shows ChevronDown when expanded', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    const { container } = render(<CIStatusBadge status={status} onClick={onClick} expanded={true} />);

    // Check for ChevronDown icon (expanded state)
    const chevron = container.querySelector('svg.lucide-chevron-down');
    expect(chevron).toBeInTheDocument();
  });

  it('shows ChevronRight when not expanded', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    const { container } = render(<CIStatusBadge status={status} onClick={onClick} expanded={false} />);

    // Check for ChevronRight icon (collapsed state)
    const chevron = container.querySelector('svg.lucide-chevron-right');
    expect(chevron).toBeInTheDocument();
  });
});
