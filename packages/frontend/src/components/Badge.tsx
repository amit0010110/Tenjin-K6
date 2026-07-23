import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  neutral: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    completed: { variant: 'success', label: 'Completed' },
    running: { variant: 'info', label: 'Running' },
    pending: { variant: 'neutral', label: 'Pending' },
    failed: { variant: 'danger', label: 'Failed' },
  };
  const { variant, label } = map[status] || { variant: 'neutral' as BadgeVariant, label: status };
  return (
    <Badge variant={variant}>
      <span className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-emerald-500' : variant === 'danger' ? 'bg-red-500' : variant === 'info' ? 'bg-blue-500' : 'bg-gray-400'}`} />
      {label}
    </Badge>
  );
}

export function Dot({ color = 'bg-gray-400' }: { color?: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}
