import { create } from 'zustand';
import type { GitStatus, Session } from '../types/session';
import { getWorkspaceStage, type WorkspaceStageInput } from '../types/workspace';

export interface TodoItem {
  status: 'pending' | 'in_progress' | 'completed';
  content: string;
  activeForm?: string;
}

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  gitStatusLoading: Set<string>;
  isLoaded: boolean;
  sessionTodos: Record<string, TodoItem[]>; // sessionId -> todos

  loadSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  deleteSession: (session: { id: string }) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateSessionGitStatus: (sessionId: string, gitStatus: GitStatus) => void;
  setGitStatusLoading: (sessionId: string, loading: boolean) => void;
  updateWorkspaceStage: (sessionId: string, data: WorkspaceStageInput) => void;
  updateSessionTodos: (sessionId: string, todos: TodoItem[]) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: (() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('snowtree-active-session-id');
    return stored || null;
  })(),
  gitStatusLoading: new Set(),
  isLoaded: false,
  sessionTodos: {},

  loadSessions: (sessions) => {
    const state = get();
    const activeSessionId = state.activeSessionId && sessions.some((s) => s.id === state.activeSessionId)
      ? state.activeSessionId
      : null;
    
    // Notify backend of restored active session so FileWatcher can start
    if (activeSessionId) {
      void window.electronAPI?.invoke('sessions:set-active-session', activeSessionId);
    }
    
    set({ sessions, isLoaded: true, activeSessionId });
  },

  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions],
    activeSessionId: session.id
  })),

  updateSession: (updated) => set((state) => ({
    sessions: state.sessions.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
  })),

  deleteSession: (deleted) => set((state) => {
    const nextActiveSessionId = state.activeSessionId === deleted.id ? null : state.activeSessionId;
    if (typeof window !== 'undefined' && state.activeSessionId === deleted.id) {
      window.localStorage.removeItem('snowtree-active-session-id');
    }
    return {
      sessions: state.sessions.filter((s) => s.id !== deleted.id),
      activeSessionId: nextActiveSessionId,
    };
  }),

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (typeof window !== 'undefined') {
      if (sessionId) window.localStorage.setItem('snowtree-active-session-id', sessionId);
      else window.localStorage.removeItem('snowtree-active-session-id');
    }
    void window.electronAPI?.invoke('sessions:set-active-session', sessionId);
  },

  updateSessionGitStatus: (sessionId, gitStatus) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, gitStatus } : s))
    })),

  setGitStatusLoading: (sessionId, loading) => {
    const next = new Set(get().gitStatusLoading);
    if (loading) next.add(sessionId);
    else next.delete(sessionId);
    set({ gitStatusLoading: next });
  },

  updateWorkspaceStage: (sessionId, data) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, workspaceStage: getWorkspaceStage(data) } : s
      ),
    })),

  updateSessionTodos: (sessionId, todos) =>
    set((state) => ({
      sessionTodos: { ...state.sessionTodos, [sessionId]: todos },
    })),
}));

// Expose store for E2E testing
if (typeof window !== 'undefined') {
  (window as any).__sessionStore = useSessionStore;
}
