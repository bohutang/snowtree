/**
 * UpdateManager - Handles application auto-update with electron-updater
 *
 * Features:
 * - Checks for updates on startup (after 10 second delay)
 * - Checks for updates every hour
 * - Checks for updates when window gains focus (throttled)
 * - Downloads updates on user request
 * - Installs updates on app restart
 * - macOS: Uses DMG download + replace to bypass signature validation
 */

import { autoUpdater } from 'electron-updater';
import { EventEmitter } from 'events';
import { app } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class UpdateManager extends EventEmitter {
  private updateAvailable = false;
  private updateDownloaded = false;
  private installingUpdate = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime = 0;
  private latestVersion = '';
  private readonly CHECK_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes throttle
  private readonly PERIODIC_CHECK_MS = 60 * 60 * 1000; // Check every hour

  /**
   * Initialize the update manager
   * Sets up event listeners and schedules update checks
   */
  async initialize(): Promise<void> {
    // Configure auto-updater behavior
    autoUpdater.autoDownload = false; // Don't auto-download, wait for user action
    autoUpdater.autoInstallOnAppQuit = true; // Install automatically on next quit

    // Listen for update availability
    autoUpdater.on('update-available', (info) => {
      this.updateAvailable = true;
      this.updateDownloaded = false;
      this.latestVersion = info.version;
      this.emit('update-available', info.version);
    });

    // Listen for download completion
    autoUpdater.on('update-downloaded', () => {
      this.updateDownloaded = true;
      this.emit('update-downloaded');
    });

    // Listen for errors (silent failure)
    autoUpdater.on('error', () => {
      // Silently ignore errors - don't bother users with update check failures
    });

    // Initial check after 10 seconds to avoid blocking startup
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000);

    // Periodic check every hour
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.PERIODIC_CHECK_MS);
  }

  /**
   * Check for updates (throttled to avoid excessive requests)
   * Can be called manually, e.g., when window gains focus
   */
  checkForUpdates(): void {
    const now = Date.now();

    // Throttle: Don't check if we checked recently
    if (now - this.lastCheckTime < this.CHECK_THROTTLE_MS) {
      return;
    }

    this.lastCheckTime = now;

    autoUpdater.checkForUpdates().catch(() => {
      // Silently ignore check failures
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Download the available update
   * On macOS: Downloads DMG directly to bypass Squirrel signature validation
   * On other platforms: Uses electron-updater
   */
  async downloadUpdate(): Promise<void> {
    if (!this.updateAvailable) {
      return;
    }

    if (process.platform === 'darwin') {
      await this.downloadMacOSUpdate();
    } else {
      await autoUpdater.downloadUpdate();
    }
  }

  /**
   * macOS-specific: Download DMG directly
   */
  private async downloadMacOSUpdate(): Promise<void> {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const version = this.latestVersion;
    const dmgName = `snowtree-${version}-macOS-${arch}.dmg`;
    const downloadUrl = `https://github.com/databendlabs/snowtree/releases/download/v${version}/${dmgName}`;
    const tmpDir = os.tmpdir();
    const dmgPath = path.join(tmpDir, dmgName);

    // Download DMG using curl
    await new Promise<void>((resolve, reject) => {
      const curl = spawn('curl', ['-fsSL', '-o', dmgPath, downloadUrl]);
      curl.on('close', (code) => {
        if (code === 0) {
          this.updateDownloaded = true;
          this.emit('update-downloaded');
          resolve();
        } else {
          reject(new Error(`Failed to download update (exit code ${code})`));
        }
      });
      curl.on('error', reject);
    });
  }

  isInstallingUpdate(): boolean {
    return this.installingUpdate;
  }

  /**
   * Quit the application and install the downloaded update
   * On macOS: Uses DMG mount + copy to bypass Squirrel signature validation
   * On other platforms: Uses electron-updater quitAndInstall
   */
  quitAndInstall(): void {
    if (!this.updateDownloaded) return;
    this.installingUpdate = true;

    if (process.platform === 'darwin') {
      this.installMacOSUpdate();
    } else {
      // Force restart after install so the user sees the new version immediately.
      autoUpdater.quitAndInstall(false, true);
    }
  }

  /**
   * macOS-specific: Install update by mounting DMG and copying app
   * This bypasses Squirrel's signature validation
   */
  private installMacOSUpdate(): void {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const version = this.latestVersion;
    const dmgName = `snowtree-${version}-macOS-${arch}.dmg`;
    const tmpDir = os.tmpdir();
    const dmgPath = path.join(tmpDir, dmgName);

    if (!fs.existsSync(dmgPath)) {
      this.installingUpdate = false;
      this.emit('error', new Error('Downloaded DMG not found'));
      return;
    }

    // Create install script
    const installScript = `
      #!/bin/bash
      set -e
      DMG_PATH="${dmgPath}"
      MOUNT_POINT="/Volumes/snowtree-update-$$"

      # Unmount if already mounted
      hdiutil detach "$MOUNT_POINT" 2>/dev/null || true

      # Mount DMG
      hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet

      # Copy app (replace existing)
      rm -rf /Applications/snowtree.app
      cp -R "$MOUNT_POINT/snowtree.app" /Applications/

      # Unmount DMG
      hdiutil detach "$MOUNT_POINT" -quiet

      # Clean up downloaded DMG
      rm -f "$DMG_PATH"

      # Relaunch app
      sleep 1
      open /Applications/snowtree.app
    `;

    const scriptPath = path.join(tmpDir, 'snowtree-update.sh');
    fs.writeFileSync(scriptPath, installScript, { mode: 0o755 });

    // Run install script and quit
    spawn('bash', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    // Quit current app
    app.quit();
  }
}
