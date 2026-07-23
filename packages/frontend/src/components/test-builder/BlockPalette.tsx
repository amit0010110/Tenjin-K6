import React, { useState } from 'react';
import { BLOCK_REGISTRY, BlockType } from '../../lib/test-builder/types';
import * as Icons from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const CATEGORIES = [
  { label: 'Scenarios', types: ['scenario', 'stages-scenario', 'arrivals-scenario'] as BlockType[] },
  { label: 'Requests (HTTP / gRPC)', types: ['http-request', 'http-batch', 'grpc-call', 'websocket', 'dummy-sampler', 'header-manager', 'cookie-manager', 'cache-manager', 'auth-manager', 'http-defaults'] as BlockType[] },
  { label: 'Protocol Extensions (xk6)', types: ['ibmmq', 'iso8583', 'iso20022', 'ftp', 'kafka', 'redis', 'mqtt', 'sql-query'] as BlockType[] },
  { label: 'Browser', types: ['browser-page'] as BlockType[] },
  { label: 'Flow Control', types: ['group', 'loop', 'condition', 'transaction', 'throughput', 'interleave', 'random-controller', 'switch', 'for-each', 'once-only', 'runtime', 'synchronizing-timer'] as BlockType[] },
  { label: 'Validation', types: ['check', 'assertion', 'json-assertion', 'extract-variable'] as BlockType[] },
  { label: 'Timing', types: ['sleep', 'wait'] as BlockType[] },
  { label: 'Data', types: ['data-file', 'set-variable', 'counter', 'random-var'] as BlockType[] },
  { label: 'Metrics & Debug', types: ['custom-metric', 'log', 'script'] as BlockType[] },
  { label: 'Processors', types: ['pre-processor', 'post-processor'] as BlockType[] },
];

const COLLAPSED_BY_DEFAULT = new Set(['Browser', 'Metrics & Debug', 'Processors']);

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  indigo: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
  purple: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
  cyan: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300',
  emerald: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
  green: 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300',
  amber: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
  gray: 'border-gray-500 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  slate: 'border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  orange: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300',
  rose: 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300',
  violet: 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300',
  teal: 'border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300',
  red: 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
  stone: 'border-stone-500 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300',
  zinc: 'border-zinc-500 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
};

export default function BlockPalette({ onAddBlock }: { onAddBlock: (type: BlockType) => void }) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    CATEGORIES.forEach(c => { if (!COLLAPSED_BY_DEFAULT.has(c.label)) initial.add(c.label); });
    return initial;
  });

  const filtered = CATEGORIES.map(cat => ({
    ...cat,
    types: cat.types.filter(t => {
      if (!search) return true;
      const def = BLOCK_REGISTRY[t];
      return def.label.toLowerCase().includes(search.toLowerCase()) ||
             def.description.toLowerCase().includes(search.toLowerCase());
    }),
  })).filter(cat => cat.types.length > 0);

  const getLucideIcon = (iconName: string): LucideIcon => {
    return (Icons as any)[iconName] || Icons.Box;
  };

  return (
    <div className="w-56 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col h-full">
      <div className="p-3 border-b dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Blocks</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="w-full text-xs px-2 py-1.5 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {filtered.map(cat => {
          const isExpanded = expandedCategories.has(cat.label);
          return (
            <div key={cat.label}>
              <button
                onClick={() => {
                  setExpandedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(cat.label)) next.delete(cat.label); else next.add(cat.label);
                    return next;
                  });
                }}
                className="w-full flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                {cat.label}
              </button>
              {isExpanded && (
                <div className="space-y-0.5">
                  {cat.types.map(type => {
                    const def = BLOCK_REGISTRY[type];
                    const Icon = getLucideIcon(def.icon);
                    return (
                      <button
                        key={type}
                        onClick={() => onAddBlock(type)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('block-type', type);
                        }}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border-l-2 transition-all hover:shadow-sm ${COLOR_MAP[def.color] || ''}`}
                        title={def.description}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{def.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
