import React from 'react';
import { useToastStore } from '../stores/toastStore';

const iconMap: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const colorMap: Record<string, string> = {
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-300',
};

const iconBgMap: Record<string, string> = {
  success: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
  error: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
  info: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 animate-slide-in ${colorMap[t.type]}`}
          role="alert"
        >
          <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${iconBgMap[t.type]}`}>
            {iconMap[t.type]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{t.title}</p>
            {t.message && <p className="text-xs mt-0.5 opacity-80">{t.message}</p>}
          </div>
          <button
            onClick={() => remove(t.id)}
            className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
