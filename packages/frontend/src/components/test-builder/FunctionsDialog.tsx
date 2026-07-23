import React, { useState } from 'react';
import { K6_FUNCTIONS, CORRELATION_PATTERNS } from '../../lib/test-builder/functions';
import { X, Search, Copy, Check } from 'lucide-react';

interface FunctionsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function FunctionsDialog({ open, onClose }: FunctionsDialogProps) {
  const [tab, setTab] = useState<'functions' | 'correlation'>('functions');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* fallback */ }
  };

  const filteredFunctions = K6_FUNCTIONS.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.description.toLowerCase().includes(search.toLowerCase()) ||
    f.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPatterns = CORRELATION_PATTERNS.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.expression.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filteredFunctions.map(f => f.category))];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Functions Helper</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700 text-xs">
          <button
            className={`px-4 py-2 font-medium transition-colors ${tab === 'functions' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            onClick={() => setTab('functions')}
          >
            k6 Functions
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${tab === 'correlation' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            onClick={() => setTab('correlation')}
          >
            Correlation Patterns
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {tab === 'functions' ? (
            categories.map(cat => (
              <div key={cat}>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1">{cat}</h4>
                <div className="space-y-0.5">
                  {filteredFunctions.filter(f => f.category === cat).map(fn => (
                    <button
                      key={fn.name}
                      onClick={() => handleCopy(fn.syntax)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 group transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400">{fn.syntax}</code>
                          {copied === fn.syntax && <Check className="w-3 h-3 text-green-500" />}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{fn.description}</p>
                      </div>
                      <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-0.5">
              {filteredPatterns.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No patterns match your search</p>
              ) : filteredPatterns.map(p => (
                <button
                  key={p.name}
                  onClick={() => handleCopy(p.expression)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                      {copied === p.expression && <Check className="w-3 h-3 text-green-500" />}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</p>
                    <div className="flex gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono">{p.extractType}</span>
                      {p.appliesTo.map(a => (
                        <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">{a}</span>
                      ))}
                    </div>
                  </div>
                  <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
