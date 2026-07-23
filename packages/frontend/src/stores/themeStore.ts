import { create } from 'zustand';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

const getInitial = (): boolean => {
  const stored = localStorage.getItem('darkMode');
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const apply = (dark: boolean) => {
  if (dark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
};

const initial = getInitial();
apply(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  dark: initial,
  toggle: () => set((state) => {
    const next = !state.dark;
    localStorage.setItem('darkMode', String(next));
    apply(next);
    return { dark: next };
  }),
}));
