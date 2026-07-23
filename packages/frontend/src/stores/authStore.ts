import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; name: string; role: string } | null;
  login: (token: string, user: AuthState['user']) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })(),
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
  isAuthenticated: () => !!get().token,
}));
