import { create } from 'zustand';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;

  // Remove old theme classes
  document.documentElement.classList.remove('light', 'dark');
  document.body.classList.remove('light', 'dark');

  // Add new theme classes and attribute
  document.documentElement.classList.add(theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.add(theme);

  window.localStorage.setItem(STORAGE_KEY, theme);
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: getInitialTheme(),

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));

// Initialize theme on load
export function initializeTheme() {
  const theme = getInitialTheme();
  applyTheme(theme);
}
