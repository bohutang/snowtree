import { EventEmitter } from 'events';
import { watch, FSWatcher, existsSync, readFileSync, statSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import type { Logger } from '../../infrastructure/logging/logger';

interface WatchedSession {
  sessionId: string;
  worktreePath: string;
  watcher?: FSWatcher;
  gitWatchers?: FSWatcher[];
  lastModified: number;
  pendingRefresh: boolean;
}

export function resolveGitDir(worktreePath: string): string | null {
  const dotGit = join(worktreePath, '.git');
  if (!existsSync(dotGit)) return null;

  try {
    const stat = statSync(dotGit);
    if (stat.isDirectory()) return dotGit;
  } catch {
    // ignore
  }

  // In a linked worktree, `.git` is a file containing `gitdir: <path>`
  try {
    const content = readFileSync(dotGit, 'utf8').trim();
    const m = content.match(/^gitdir:\s*(.+)\s*$/i);
    if (!m) return null;
    const raw = m[1].trim();
    if (!raw) return null;
    const base = dirname(dotGit);
    return isAbsolute(raw) ? raw : resolve(base, raw);
  } catch {
    return null;
  }
}

/**
 * Smart file watcher that detects when git status actually needs refreshing
 * 
 * Key optimizations:
 * 1. Uses native fs.watch for efficient file monitoring
 * 2. Filters out events that don't affect git status
 * 3. Batches rapid file changes
 */
export class GitFileWatcher extends EventEmitter {
  private watchedSessions: Map<string, WatchedSession> = new Map();
  private refreshDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly WORKTREE_DEBOUNCE_MS = 200; // fast for UI responsiveness
  private readonly GIT_DEBOUNCE_MS = 50; // index/HEAD updates should feel instant
  private readonly IGNORE_PATTERNS = [
    '.git/',
    'node_modules/',
    '.DS_Store',
    'thumbs.db',
    '*.swp',
    '*.swo',
    '*~',
    '.#*',
    '#*#'
  ];

  constructor(private logger?: Logger) {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Start watching a session's worktree for changes
   */
  startWatching(sessionId: string, worktreePath: string): void {
    // Stop existing watcher if any
    this.stopWatching(sessionId);

    this.logger?.info(`[GitFileWatcher] Starting watch for session ${sessionId} at ${worktreePath}`);

    try {
      let watcher: FSWatcher | undefined;
      try {
        // Prefer recursive watch when available (macOS/Windows).
        watcher = watch(worktreePath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            this.handleFileChange(sessionId, filename, eventType);
          } else {
            // Some platforms do not provide filename; still refresh.
            this.handleWorktreeUnknownChange(sessionId, eventType);
          }
        });
      } catch {
        // Fallback: non-recursive watch for top-level changes.
        watcher = watch(worktreePath, { recursive: false }, (eventType, filename) => {
          if (filename) {
            this.handleFileChange(sessionId, filename, eventType);
          } else {
            this.handleWorktreeUnknownChange(sessionId, eventType);
          }
        });
      }

      const gitWatchers = this.startGitMetadataWatch(sessionId, worktreePath);

      this.watchedSessions.set(sessionId, {
        sessionId,
        worktreePath,
        watcher,
        gitWatchers,
        lastModified: Date.now(),
        pendingRefresh: false
      });
    } catch (error) {
      this.logger?.error(`[GitFileWatcher] Failed to start watching session ${sessionId}:`, error as Error);
    }
  }

  /**
   * Stop watching a session's worktree
   */
  stopWatching(sessionId: string): void {
    const session = this.watchedSessions.get(sessionId);
    if (session) {
      session.watcher?.close();
      session.gitWatchers?.forEach((w) => {
        try { w.close(); } catch { /* ignore */ }
      });
      this.watchedSessions.delete(sessionId);
      
      // Clear any pending refresh timer
      const timer = this.refreshDebounceTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.refreshDebounceTimers.delete(sessionId);
      }
      
      this.logger?.info(`[GitFileWatcher] Stopped watching session ${sessionId}`);
    }
  }

  /**
   * Stop all watchers
   */
  stopAll(): void {
    for (const sessionId of this.watchedSessions.keys()) {
      this.stopWatching(sessionId);
    }
  }

  /**
   * Handle a file change event
   */
  private handleFileChange(sessionId: string, filename: string, eventType: string): void {
    // Ignore changes to files that don't affect git status
    if (this.shouldIgnoreFile(filename)) {
      return;
    }

    const session = this.watchedSessions.get(sessionId);
    if (!session) return;

    // Update last modified time
    session.lastModified = Date.now();
    session.pendingRefresh = true;

    // Debounce the refresh to batch rapid changes
    this.scheduleRefreshCheck(sessionId, this.WORKTREE_DEBOUNCE_MS);
  }

  private handleWorktreeUnknownChange(sessionId: string, eventType: string): void {
    const session = this.watchedSessions.get(sessionId);
    if (!session) return;
    session.lastModified = Date.now();
    session.pendingRefresh = true;
    this.scheduleRefreshCheck(sessionId, this.WORKTREE_DEBOUNCE_MS);
  }

  private handleGitMetadataChange(sessionId: string, filename: string, eventType: string): void {
    this.logger?.info(`[GitFileWatcher] Git metadata change: ${eventType} ${filename} for session ${sessionId}`);
    const session = this.watchedSessions.get(sessionId);
    if (!session) return;
    session.lastModified = Date.now();
    session.pendingRefresh = true;
    this.scheduleRefreshCheck(sessionId, this.GIT_DEBOUNCE_MS);
  }

  /**
   * Check if a file should be ignored
   */
  private shouldIgnoreFile(filename: string): boolean {
    // Check against ignore patterns
    for (const pattern of this.IGNORE_PATTERNS) {
      if (pattern.endsWith('/')) {
        // Directory pattern
        if (filename.startsWith(pattern) || filename.includes('/' + pattern)) {
          return true;
        }
      } else if (pattern.startsWith('*.')) {
        // Extension pattern
        const ext = pattern.slice(1);
        if (filename.endsWith(ext)) {
          return true;
        }
      } else if (pattern.startsWith('.#') || pattern.startsWith('#')) {
        // Editor temp file patterns
        const basename = filename.split('/').pop() || '';
        if (basename.startsWith('.#') || (basename.startsWith('#') && basename.endsWith('#'))) {
          return true;
        }
      } else if (pattern.endsWith('~')) {
        // Backup file pattern
        if (filename.endsWith('~')) {
          return true;
        }
      } else {
        // Exact match
        if (filename === pattern || filename.endsWith('/' + pattern)) {
          return true;
        }
      }
    }
    return false;
  }

  private startGitMetadataWatch(sessionId: string, worktreePath: string): FSWatcher[] {
    const gitdir = resolveGitDir(worktreePath);
    this.logger?.info(`[GitFileWatcher] Starting git metadata watch for session ${sessionId}, gitdir: ${gitdir}`);
    if (!gitdir) {
      this.logger?.warn(`[GitFileWatcher] Could not resolve gitdir for ${worktreePath}`);
      return [];
    }

    // Zed-style: watch git metadata files that reflect status changes instantly.
    const paths = [
      join(gitdir, 'index'),
      join(gitdir, 'HEAD'),
      join(gitdir, 'logs', 'HEAD'),
      join(gitdir, 'packed-refs'),
    ];
    this.logger?.info(`[GitFileWatcher] Watching paths: ${paths.join(', ')}`);

    const watchers: FSWatcher[] = [];

    for (const p of paths) {
      try {
        const w = watch(p, { persistent: true }, (eventType) => {
          this.handleGitMetadataChange(sessionId, p, eventType);
        });
        watchers.push(w);
      } catch {
        // ignore missing files / unsupported watch
      }
    }

    // Also watch the gitdir itself (best-effort). On some platforms Git updates files
    // via atomic replace, which can invalidate per-file watches; watching the directory
    // makes staging/commit changes reliably detectable (Zed-style).
    try {
      const w = watch(gitdir, { persistent: true }, (eventType, filename) => {
        const name = filename ? String(filename) : '';
        // Always treat gitdir changes as refresh-worthy; debounce will batch them.
        this.handleGitMetadataChange(sessionId, name ? join(gitdir, name) : gitdir, eventType);
      });
      watchers.push(w);
    } catch {
      // ignore
    }

    return watchers;
  }

  /**
   * Schedule a refresh check for a session
   */
  private scheduleRefreshCheck(sessionId: string, debounceMs: number): void {
    // Clear existing timer
    const existingTimer = this.refreshDebounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.refreshDebounceTimers.delete(sessionId);
      this.performRefreshCheck(sessionId);
    }, debounceMs);

    this.refreshDebounceTimers.set(sessionId, timer);
  }

  /**
   * Perform the actual refresh check using git plumbing commands
   */
  private performRefreshCheck(sessionId: string): void {
    const session = this.watchedSessions.get(sessionId);
    if (!session || !session.pendingRefresh) {
      return;
    }

    session.pendingRefresh = false;

    try {
      // Keep GitFileWatcher strictly about file events: any actual git checks happen in GitExecutor
      // so the timeline remains the single source of truth.
      this.logger?.info(`[GitFileWatcher] Session ${sessionId} needs refresh`);
      this.emit('needs-refresh', sessionId);
    } catch (error) {
      this.logger?.error(`[GitFileWatcher] Error checking session ${sessionId}:`, error as Error);
      // On error, emit refresh to be safe
      this.emit('needs-refresh', sessionId);
    }
  }

  /**
   * Get statistics about watched sessions
   */
  getStats(): { totalWatched: number; sessionsNeedingRefresh: number } {
    let sessionsNeedingRefresh = 0;
    for (const session of this.watchedSessions.values()) {
      if (session.pendingRefresh) {
        sessionsNeedingRefresh++;
      }
    }
    
    return {
      totalWatched: this.watchedSessions.size,
      sessionsNeedingRefresh
    };
  }
}
