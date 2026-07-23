import React, { useState } from 'react';
import { K6_FUNCTIONS, CORRELATION_PATTERNS, K6Function } from '../../lib/test-builder/functions';
import { Variable, Search, Lightbulb, Star, Copy, Check, ChevronDown, ChevronRight, Hash, Repeat, Lock, FileCode, Clock, Globe, Wrench } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Execution: <Repeat className="w-3.5 h-3.5" />,
  Data: <DatabaseIcon />,
  Encoding: <Lock className="w-3.5 h-3.5" />,
  Crypto: <Lock className="w-3.5 h-3.5" />,
  Timing: <Clock className="w-3.5 h-3.5" />,
  HTTP: <Globe className="w-3.5 h-3.5" />,
  Utility: <Wrench className="w-3.5 h-3.5" />,
  Random: <Hash className="w-3.5 h-3.5" />,
};

function DatabaseIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

interface FuncVarPanelProps {
  onInsert: (syntax: string) => void;
  onClose?: () => void;
}

export default function FuncVarPanel({ onInsert, onClose }: FuncVarPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCorrelation, setShowCorrelation] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const categories = Array.from(new Set(K6_FUNCTIONS.map(f => f.category)));

  const filtered = K6_FUNCTIONS.filter(f => {
    if (search) {
      const q = search.toLowerCase();
      return f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.syntax.toLowerCase().includes(q);
    }
    if (selectedCategory) return f.category === selectedCategory;
    return true;
  });

  const handleCopy = (syntax: string) => {
    navigator.clipboard.writeText(syntax);
    setCopied(syntax);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleInsert = (syntax: string) => {
    onInsert(syntax);
  };

  return (
    <div className="w-64 border-l dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col h-full">
      <div className="p-3 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Variable className="w-3.5 h-3.5" /> Functions
          </h3>
          <button
            onClick={() => setShowCorrelation(!showCorrelation)}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors ${
              showCorrelation ? 'bg-brand-100 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Lightbulb className="w-3 h-3" /> Patterns
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search functions..."
            className="w-full text-xs pl-6 pr-2 py-1.5 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {showCorrelation ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <h4 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-1">
            <Star className="w-3 h-3 inline mr-1" />Correlation Patterns
          </h4>
          {CORRELATION_PATTERNS.map((pattern, i) => (
            <button
              key={i}
              onClick={() => handleInsert(pattern.expression)}
              className="w-full text-left p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all group"
            >
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{pattern.name}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{pattern.description}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] px-1 py-0.5 rounded bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 font-mono">
                  {pattern.extractType}
                </span>
                <span className="text-[10px] text-gray-400 font-mono truncate">{pattern.expression}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {!search && !selectedCategory && (
            <div className="flex flex-wrap gap-1 p-2 border-b dark:border-gray-700">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-colors flex items-center gap-1"
                >
                  {CATEGORY_ICONS[cat]}
                  {cat}
                </button>
              ))}
              <button onClick={() => setSelectedCategory(null)}
                className="text-[10px] px-1.5 py-0.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                Clear
              </button>
            </div>
          )}

          <div className="p-1 space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No functions match your search</p>
            )}
            {filtered.map((fn, i) => (
              <div key={i}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => handleInsert(fn.syntax)}
              >
                <span className="text-gray-400 shrink-0">{CATEGORY_ICONS[fn.category] || <Variable className="w-3.5 h-3.5" />}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{fn.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{fn.description}</p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleCopy(fn.syntax); }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                    {copied === fn.syntax ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
