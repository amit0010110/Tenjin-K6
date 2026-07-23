import React, { useState, useMemo } from 'react';
import { OUTPUT_TYPES } from '@tenjint6/shared';
import type { OutputConfig } from '@tenjint6/shared';

interface Props {
  outputs: OutputConfig[];
  onChange: (outputs: OutputConfig[]) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Cloud: '☁️', APM: '🔧', Database: '🗄️', Streaming: '📨',
  File: '📄', Observability: '📊',
};

const CATEGORY_ORDER = ['Cloud', 'Observability', 'APM', 'Database', 'Streaming', 'File'];

export default function OutputsManager({ outputs, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const types = Object.entries(OUTPUT_TYPES);

  const grouped = useMemo(() => {
    const filtered = search
      ? types.filter(([, info]) => info.label.toLowerCase().includes(search.toLowerCase()))
      : types;
    const groups: Record<string, typeof types> = {};
    for (const entry of filtered) {
      const [, info] = entry;
      if (!groups[info.category]) groups[info.category] = [];
      groups[info.category].push(entry);
    }
    return groups;
  }, [search, types]);

  const add = (type: string) => {
    const info = OUTPUT_TYPES[type];
    const config: Record<string, string> = {};
    for (const f of info.fields) config[f.key] = '';
    onChange([...outputs, { type, enabled: true, config }]);
    setShowPicker(false);
    setSearch('');
  };

  const remove = (idx: number) => {
    onChange(outputs.filter((_, i) => i !== idx));
  };

  const toggle = (idx: number) => {
    const next = [...outputs];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    onChange(next);
  };

  const updateConfig = (idx: number, key: string, value: string) => {
    const next = [...outputs];
    next[idx] = { ...next[idx], config: { ...next[idx].config, [key]: value } };
    onChange(next);
  };

  const enabledCount = outputs.filter((o) => o.enabled).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Real-Time Outputs</label>
          {outputs.length > 0 && (
            <span className="text-xs text-gray-400">({enabledCount}/{outputs.length} active)</span>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <span>+</span> Add Output
          </button>

          {showPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-xl w-72 max-h-96 overflow-hidden">
                <div className="p-2 border-b dark:border-gray-700">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search integrations..."
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-80 p-1">
                  {CATEGORY_ORDER.map((cat) => {
                    const items = grouped[cat];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <span>{CATEGORY_ICONS[cat]}</span>
                          <span>{cat}</span>
                        </div>
                        {items.map(([key, info]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => add(key)}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <span className="text-base">{info.icon}</span>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{info.label}</div>
                              <div className="text-xs text-gray-400 truncate">{info.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {Object.keys(grouped).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No integrations match "{search}"</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Stream metrics to external services during a test run. Results are always streamed via WebSocket to the live monitor.
      </p>

      {outputs.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-8 text-center">
          <p className="text-sm text-gray-400">No outputs configured</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Output" to stream metrics to an external service.</p>
        </div>
      )}

      <div className="space-y-2">
        {outputs.map((out, i) => {
          const info = OUTPUT_TYPES[out.type];
          if (!info) return null;
          return (
            <div
              key={i}
              className={`rounded-xl border transition-all ${
                out.enabled
                  ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm'
                  : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      out.enabled
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {out.enabled && <span className="text-xs leading-none">✓</span>}
                  </button>
                  <span className="text-base">{info.icon}</span>
                  <div>
                    <span className="text-sm font-medium">{info.label}</span>
                    <p className="text-xs text-gray-400">{info.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Remove output"
                >
                  ✕
                </button>
              </div>

              {info.fields.length > 0 && (
                <div className="px-3 pb-3 space-y-1.5 ml-9 border-t dark:border-gray-700 pt-2 mt-0">
                  {info.fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{f.label}</label>
                      <div className="flex gap-1.5">
                        <input
                          type={f.secret ? 'password' : 'text'}
                          value={out.config[f.key] || ''}
                          onChange={(e) => updateConfig(i, f.key, e.target.value)}
                          className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder={f.placeholder}
                        />
                        {f.secret && out.config[f.key] && (
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`output-secret-${i}-${f.key}`) as HTMLInputElement;
                              if (input) input.type = input.type === 'password' ? 'text' : 'password';
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-1"
                            title="Toggle visibility"
                          >
                            👁️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
