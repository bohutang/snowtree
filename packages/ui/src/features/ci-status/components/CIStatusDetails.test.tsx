import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CIStatusDetails } from './CIStatusDetails';
import type { CICheck } from '../types';

describe('CIStatusDetails', () => {
  const createMockCheck = (overrides: Partial<CICheck> = {}): CICheck => ({
    id: 1,
    name: 'test-check',
    workflow: null,
    status: 'completed',
    conclusion: 'success',
    startedAt: '2026-01-14T05:25:00Z',
    completedAt: '2026-01-14T05:30:00Z',
    detailsUrl: 'https://github.com/test/repo/actions/runs/123',
    ...overrides,
  });

  it('renders empty state when no checks', () => {
    render(<CIStatusDetails checks={[]} />);
    expect(screen.getByText('No checks')).toBeInTheDocument();
  });

  it('renders check names', () => {
    const checks = [
      createMockCheck({ id: 1, name: 'build' }),
      createMockCheck({ id: 2, name: 'test' }),
      createMockCheck({ id: 3, name: 'lint' }),
    ];
    render(<CIStatusDetails checks={checks} />);

    // Success checks are collapsed by default, need to expand them
    const successHeader = screen.getByText(/Success \(3\)/);
    fireEvent.click(successHeader);

    expect(screen.getByText('build')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('lint')).toBeInTheDocument();
  });

  it('renders success status label', () => {
    const checks = [createMockCheck({ conclusion: 'success' })];
    render(<CIStatusDetails checks={checks} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    expect(screen.getByText('success')).toBeInTheDocument();
  });

  it('renders failure status label', () => {
    const checks = [createMockCheck({ conclusion: 'failure' })];
    render(<CIStatusDetails checks={checks} />);

    // Failure checks are always expanded
    expect(screen.getByText('failure')).toBeInTheDocument();
  });

  it('renders running status for in_progress checks', () => {
    const checks = [
      createMockCheck({
        status: 'in_progress',
        conclusion: null,
        completedAt: null,
      }),
    ];
    render(<CIStatusDetails checks={checks} />);

    // In-progress checks are in pending section, always expanded
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('renders pending status for queued checks', () => {
    const checks = [
      createMockCheck({
        status: 'queued',
        conclusion: null,
        completedAt: null,
      }),
    ];
    render(<CIStatusDetails checks={checks} />);

    // Queued checks are in pending section, always expanded
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders skipped status', () => {
    const checks = [createMockCheck({ conclusion: 'skipped' })];
    render(<CIStatusDetails checks={checks} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    expect(screen.getByText('skipped')).toBeInTheDocument();
  });

  it('renders cancelled status', () => {
    const checks = [createMockCheck({ conclusion: 'cancelled' })];
    render(<CIStatusDetails checks={checks} />);

    // Cancelled checks are in failed section, always expanded
    expect(screen.getByText('cancelled')).toBeInTheDocument();
  });

  it('calls onCheckClick when check with URL is clicked', () => {
    const onCheckClick = vi.fn();
    const check = createMockCheck({ detailsUrl: 'https://github.com/test' });
    render(<CIStatusDetails checks={[check]} onCheckClick={onCheckClick} />);

    // Expand success section to access the check button
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    // Now click the check button (skip the group header button)
    const buttons = screen.getAllByRole('button');
    const checkButton = buttons[1]; // First is group header, second is check
    fireEvent.click(checkButton);
    expect(onCheckClick).toHaveBeenCalledWith(check);
  });

  it('does not call onCheckClick when check without URL is clicked', () => {
    const onCheckClick = vi.fn();
    const check = createMockCheck({ detailsUrl: null });
    render(<CIStatusDetails checks={[check]} onCheckClick={onCheckClick} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    // Click the check button (not the group header)
    const buttons = screen.getAllByRole('button');
    const checkButton = buttons[1];
    fireEvent.click(checkButton);
    expect(onCheckClick).not.toHaveBeenCalled();
  });

  it('disables button when check has no URL', () => {
    const check = createMockCheck({ detailsUrl: null });
    render(<CIStatusDetails checks={[check]} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    const buttons = screen.getAllByRole('button');
    const checkButton = buttons[1];
    expect(checkButton).toBeDisabled();
  });

  it('enables button when check has URL', () => {
    const check = createMockCheck({ detailsUrl: 'https://github.com/test' });
    render(<CIStatusDetails checks={[check]} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    const buttons = screen.getAllByRole('button');
    const checkButton = buttons[1];
    expect(checkButton).not.toBeDisabled();
  });

  it('renders multiple checks in order', () => {
    const checks = [
      createMockCheck({ id: 1, name: 'first' }),
      createMockCheck({ id: 2, name: 'second' }),
      createMockCheck({ id: 3, name: 'third' }),
    ];
    render(<CIStatusDetails checks={checks} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(3\)/);
    fireEvent.click(successHeader);

    // Now we have 1 group header + 3 check buttons = 4 buttons total
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  it('renders check with neutral conclusion', () => {
    const checks = [createMockCheck({ conclusion: 'neutral' })];
    render(<CIStatusDetails checks={checks} />);

    // Expand success section
    const successHeader = screen.getByText(/Success \(1\)/);
    fireEvent.click(successHeader);

    expect(screen.getByText('neutral')).toBeInTheDocument();
  });

  it('renders check with timed_out conclusion', () => {
    const checks = [createMockCheck({ conclusion: 'timed_out' })];
    render(<CIStatusDetails checks={checks} />);

    // Timed out checks are in failed section, always expanded
    expect(screen.getByText('timed_out')).toBeInTheDocument();
  });
});
