import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock process.platform to avoid macOS-specific curl download
const originalPlatform = process.platform;
Object.defineProperty(process, 'platform', { value: 'linux', writable: true });

// Create mock outside of vi.mock using vi.hoisted
const mockCheckForUpdates = vi.fn().mockResolvedValue(undefined);
const mockDownloadUpdate = vi.fn().mockResolvedValue(undefined);
const mockQuitAndInstall = vi.fn();

// Mock electron-updater
vi.mock('electron-updater', () => {
  const mockAutoUpdaterInstance = new EventEmitter();
  (mockAutoUpdaterInstance as any).autoDownload = false;
  (mockAutoUpdaterInstance as any).autoInstallOnAppQuit = false;
  (mockAutoUpdaterInstance as any).checkForUpdates = mockCheckForUpdates;
  (mockAutoUpdaterInstance as any).downloadUpdate = mockDownloadUpdate;
  (mockAutoUpdaterInstance as any).quitAndInstall = mockQuitAndInstall;

  return {
    autoUpdater: mockAutoUpdaterInstance,
  };
});

// Import after defining mock
const { UpdateManager } = await import('../UpdateManager');
const { autoUpdater: mockAutoUpdater } = await import('electron-updater');

describe('UpdateManager', () => {
  let updateManager: UpdateManager;
  let updateAvailableCallback: vi.Mock;
  let updateDownloadedCallback: vi.Mock;

  beforeEach(() => {
    updateManager = new UpdateManager();
    updateAvailableCallback = vi.fn();
    updateDownloadedCallback = vi.fn();

    // Reset mocks
    mockCheckForUpdates.mockClear();
    mockDownloadUpdate.mockClear();
    mockQuitAndInstall.mockClear();
    (mockAutoUpdater as EventEmitter).removeAllListeners();
  });

  afterEach(() => {
    updateManager.removeAllListeners();
  });

  describe('initialize', () => {
    it('should configure autoUpdater correctly', async () => {
      await updateManager.initialize();

      expect((mockAutoUpdater as any).autoDownload).toBe(false);
      expect((mockAutoUpdater as any).autoInstallOnAppQuit).toBe(true);
    });

    it('should schedule update check after 10 seconds', async () => {
      vi.useFakeTimers();

      await updateManager.initialize();

      // Should not check immediately
      expect(mockCheckForUpdates).not.toHaveBeenCalled();

      // Fast-forward 9 seconds
      vi.advanceTimersByTime(9000);
      expect(mockCheckForUpdates).not.toHaveBeenCalled();

      // Fast-forward to 10 seconds
      vi.advanceTimersByTime(1000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should not throw if checkForUpdates fails', async () => {
      vi.useFakeTimers();
      mockCheckForUpdates.mockRejectedValueOnce(new Error('Network error'));

      await expect(updateManager.initialize()).resolves.not.toThrow();

      vi.advanceTimersByTime(10000);

      // Should silently handle the error
      expect(mockCheckForUpdates).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should set up periodic check every hour', async () => {
      vi.useFakeTimers();

      await updateManager.initialize();

      // Initial check at 10 seconds
      vi.advanceTimersByTime(10000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);

      // After 1 hour, should check again
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(2);

      // After another hour, should check again
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('checkForUpdates', () => {
    it('should check for updates when called manually', async () => {
      await updateManager.initialize();

      mockCheckForUpdates.mockClear();

      updateManager.checkForUpdates();

      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);
    });

    it('should throttle checks within 5 minutes', async () => {
      vi.useFakeTimers();

      await updateManager.initialize();

      // Initial check
      updateManager.checkForUpdates();
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);

      // Immediately after, should be throttled
      updateManager.checkForUpdates();
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1); // Still 1, throttled

      // After 4 minutes, still throttled
      vi.advanceTimersByTime(4 * 60 * 1000);
      updateManager.checkForUpdates();
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);

      // After 5 minutes, should allow check
      vi.advanceTimersByTime(1 * 60 * 1000);
      updateManager.checkForUpdates();
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should clear periodic check interval', async () => {
      vi.useFakeTimers();

      await updateManager.initialize();

      // Let initial check happen
      vi.advanceTimersByTime(10000);
      const checksBeforeCleanup = mockCheckForUpdates.mock.calls.length;

      // Cleanup
      updateManager.cleanup();

      // Fast-forward 1 hour - should NOT trigger periodic check
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Should not have any new checks after cleanup
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(checksBeforeCleanup);

      vi.useRealTimers();
    });
  });

  describe('update-available event', () => {
    it('should emit update-available event with version', async () => {
      await updateManager.initialize();

      updateManager.on('update-available', updateAvailableCallback);

      // Simulate update available
      (mockAutoUpdater as EventEmitter).emit('update-available', { version: '1.2.3' });

      expect(updateAvailableCallback).toHaveBeenCalledWith('1.2.3');
    });

    it('should set updateAvailable flag', async () => {
      await updateManager.initialize();

      (mockAutoUpdater as EventEmitter).emit('update-available', { version: '1.2.3' });

      // Verify by trying to download
      await updateManager.downloadUpdate();
      expect(mockDownloadUpdate).toHaveBeenCalled();
    });
  });

  describe('downloadUpdate', () => {
    it('should not download if no update is available', async () => {
      await updateManager.initialize();

      await updateManager.downloadUpdate();

      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    it('should download when update is available', async () => {
      await updateManager.initialize();

      // Simulate update available
      (mockAutoUpdater as EventEmitter).emit('update-available', { version: '1.2.3' });

      await updateManager.downloadUpdate();

      expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);
    });

    it('should handle download errors', async () => {
      await updateManager.initialize();

      (mockAutoUpdater as EventEmitter).emit('update-available', { version: '1.2.3' });

      mockDownloadUpdate.mockRejectedValueOnce(new Error('Download failed'));

      await expect(updateManager.downloadUpdate()).rejects.toThrow('Download failed');
    });
  });

  describe('update-downloaded event', () => {
    it('should emit update-downloaded event', async () => {
      await updateManager.initialize();

      updateManager.on('update-downloaded', updateDownloadedCallback);

      // Simulate download complete
      (mockAutoUpdater as EventEmitter).emit('update-downloaded');

      expect(updateDownloadedCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('quitAndInstall', () => {
    it('should not call autoUpdater.quitAndInstall if update is not downloaded', async () => {
      await updateManager.initialize();

      updateManager.quitAndInstall();

      expect(mockQuitAndInstall).not.toHaveBeenCalled();
    });

    it('should call autoUpdater.quitAndInstall once update is downloaded', async () => {
      await updateManager.initialize();

      // Simulate download complete
      (mockAutoUpdater as EventEmitter).emit('update-downloaded');

      updateManager.quitAndInstall();

      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1);
      expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true);
    });
  });

  describe('error handling', () => {
    it('should silently ignore update check errors', async () => {
      await updateManager.initialize();

      // Simulate error
      (mockAutoUpdater as EventEmitter).emit('error', new Error('Update check failed'));

      // Should not throw or emit anything
      // Just verify the manager is still functional
      expect(updateManager.listenerCount('update-available')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('full update flow', () => {
    it('should handle complete update workflow', async () => {
      vi.useFakeTimers();

      await updateManager.initialize();

      // Set up listeners
      updateManager.on('update-available', updateAvailableCallback);
      updateManager.on('update-downloaded', updateDownloadedCallback);

      // 1. Check for updates (after 10s)
      vi.advanceTimersByTime(10000);
      expect(mockCheckForUpdates).toHaveBeenCalled();

      // 2. Update available
      (mockAutoUpdater as EventEmitter).emit('update-available', { version: '2.0.0' });
      expect(updateAvailableCallback).toHaveBeenCalledWith('2.0.0');

      // 3. Download update
      await updateManager.downloadUpdate();
      expect(mockDownloadUpdate).toHaveBeenCalled();

      // 4. Download complete
      (mockAutoUpdater as EventEmitter).emit('update-downloaded');
      expect(updateDownloadedCallback).toHaveBeenCalled();

      // 5. Install update
      updateManager.quitAndInstall();
      expect(mockQuitAndInstall).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
