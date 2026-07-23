import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  sparklineData?: number[];
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantClasses = {
  default: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800',
  success: 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  warning: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  danger: 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  info: 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
};

const valueClasses = {
  default: 'text-gray-900 dark:text-gray-100',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-red-700 dark:text-red-300',
  info: 'text-blue-700 dark:text-blue-300',
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 80;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StatCard({ title, value, subtitle, icon, trend, sparklineData, variant = 'default' }: StatCardProps) {
  return (
    <div className={`rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 p-5 ${variantClasses[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${typeof value === 'string' || typeof value === 'number' ? valueClasses[variant] : ''}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-start gap-2">
          {sparklineData && <MiniSparkline data={sparklineData} color={variant === 'success' ? '#10b981' : variant === 'warning' ? '#f59e0b' : variant === 'danger' ? '#ef4444' : '#6366f1'} />}
          {icon && <div className="text-gray-400 shrink-0 mt-0.5">{icon}</div>}
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {trend.positive ? <TrendingUp className="w-3.5 h-3.5" /> : trend.value === 0 ? <Minus className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{trend.value > 0 ? '+' : ''}{trend.value}% vs last period</span>
        </div>
      )}
    </div>
  );
}