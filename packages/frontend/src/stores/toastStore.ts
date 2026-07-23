import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (t: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  add: (t) => {
    const id = `toast-${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    const duration = t.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => get().remove(id), duration);
    }
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (title, message) => get().add({ type: 'success', title, message }),
  error: (title, message) => get().add({ type: 'error', title, message }),
  info: (title, message) => get().add({ type: 'info', title, message }),
  warning: (title, message) => get().add({ type: 'warning', title, message }),
}));
