import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFileContent } from './useFileContent';
import { API } from '../../../utils/api';

vi.mock('../../../utils/api', () => ({
  API: {
    sessions: {
      getFileContent: vi.fn(),
    },
  },
}));

describe('useFileContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state when disabled', () => {
    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        enabled: false,
      })
    );

    expect(result.current.content).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(API.sessions.getFileContent).not.toHaveBeenCalled();
  });

  it('returns initial state when sessionId is missing', () => {
    const { result } = renderHook(() =>
      useFileContent({
        filePath: 'test.md',
        enabled: true,
      })
    );

    expect(result.current.content).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(API.sessions.getFileContent).not.toHaveBeenCalled();
  });

  it('returns initial state when filePath is missing', () => {
    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        enabled: true,
      })
    );

    expect(result.current.content).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(API.sessions.getFileContent).not.toHaveBeenCalled();
  });

  it('loads file content successfully', async () => {
    const mockContent = '# Test Markdown\n\nHello world!';
    vi.mocked(API.sessions.getFileContent).mockResolvedValue({
      success: true,
      data: { content: mockContent },
    });

    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        enabled: true,
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.content).toBe(null);
    expect(result.current.error).toBe(false);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBe(mockContent);
    expect(result.current.error).toBe(false);
    expect(API.sessions.getFileContent).toHaveBeenCalledWith('session-1', {
      filePath: 'test.md',
      ref: 'WORKTREE',
      maxBytes: 1024 * 1024,
    });
  });

  it('handles API error', async () => {
    vi.mocked(API.sessions.getFileContent).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        enabled: true,
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBe(null);
    expect(result.current.error).toBe(true);
  });

  it('handles unsuccessful API response', async () => {
    vi.mocked(API.sessions.getFileContent).mockResolvedValue({
      success: false,
      error: 'File not found',
    });

    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'missing.md',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBe(null);
    expect(result.current.error).toBe(true);
  });

  it('handles response without content', async () => {
    vi.mocked(API.sessions.getFileContent).mockResolvedValue({
      success: true,
      data: {},
    });

    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBe(null);
    expect(result.current.error).toBe(true);
  });

  it('uses custom ref parameter', async () => {
    vi.mocked(API.sessions.getFileContent).mockResolvedValue({
      success: true,
      data: { content: 'content from HEAD' },
    });

    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        ref: 'HEAD',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(API.sessions.getFileContent).toHaveBeenCalledWith('session-1', {
      filePath: 'test.md',
      ref: 'HEAD',
      maxBytes: 1024 * 1024,
    });
  });

  it('uses custom maxBytes parameter', async () => {
    vi.mocked(API.sessions.getFileContent).mockResolvedValue({
      success: true,
      data: { content: 'small content' },
    });

    const { result } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        maxBytes: 512 * 1024,
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(API.sessions.getFileContent).toHaveBeenCalledWith('session-1', {
      filePath: 'test.md',
      ref: 'WORKTREE',
      maxBytes: 512 * 1024,
    });
  });

  it('cancels request when unmounted', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(API.sessions.getFileContent).mockReturnValue(promise as any);

    const { result, unmount } = renderHook(() =>
      useFileContent({
        sessionId: 'session-1',
        filePath: 'test.md',
        enabled: true,
      })
    );

    expect(result.current.loading).toBe(true);

    unmount();

    // Resolve after unmount
    resolvePromise!({
      success: true,
      data: { content: 'should not update' },
    });

    await waitFor(() => {
      // State should not update after unmount
      expect(result.current.loading).toBe(true);
    });
  });

  it('reloads content when parameters change', async () => {
    vi.mocked(API.sessions.getFileContent)
      .mockResolvedValueOnce({
        success: true,
        data: { content: 'content 1' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { content: 'content 2' },
      });

    const { result, rerender } = renderHook(
      ({ filePath }) =>
        useFileContent({
          sessionId: 'session-1',
          filePath,
          enabled: true,
        }),
      { initialProps: { filePath: 'file1.md' } }
    );

    await waitFor(() => {
      expect(result.current.content).toBe('content 1');
    });

    rerender({ filePath: 'file2.md' });

    await waitFor(() => {
      expect(result.current.content).toBe('content 2');
    });

    expect(API.sessions.getFileContent).toHaveBeenCalledTimes(2);
  });

  it('clears content when disabled after loading', async () => {
    vi.mocked(API.sessions.getFileContent).mockResolvedValue({
      success: true,
      data: { content: 'test content' },
    });

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFileContent({
          sessionId: 'session-1',
          filePath: 'test.md',
          enabled,
        }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => {
      expect(result.current.content).toBe('test content');
    });

    rerender({ enabled: false });

    expect(result.current.content).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });
});
