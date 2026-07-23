import React from 'react';
import { Button, Input, FieldWrapper } from './ui';
import { Plus, X } from 'lucide-react';

export interface TestOptions {
  vus?: number;
  duration?: string;
  iterations?: string;
  thresholds?: Record<string, string[]>;
  env?: Record<string, string>;
  tags?: Record<string, string>;
}

interface OptionsPanelProps {
  options: TestOptions;
  onChange: (options: TestOptions) => void;
}

export default function OptionsPanel({ options, onChange }: OptionsPanelProps) {
  const thresholds = options.thresholds || {};
  const env = options.env || {};
  const tags = options.tags || {};

  const update = (patch: Partial<TestOptions>) => onChange({ ...options, ...patch });

  const addThreshold = () => {
    const key = `metric_${Object.keys(thresholds).length + 1}`;
    update({ thresholds: { ...thresholds, [key]: ['rate>0.99'] } });
  };

  const addKeyValue = (obj: Record<string, string>, setter: (v: Record<string, string>) => void) => {
    const key = `key_${Object.keys(obj).length + 1}`;
    setter({ ...obj, [key]: '' });
  };

  return (
    <div className="w-72 border-l dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto p-3 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Test Options</h3>

      <div className="space-y-2">
        <FieldWrapper label="Virtual Users">
          <Input type="number" value={String(options.vus || 1)} onChange={e => update({ vus: parseInt(e.target.value) || 1 })} />
        </FieldWrapper>
        <FieldWrapper label="Duration">
          <Input value={options.duration || '30s'} onChange={e => update({ duration: e.target.value })} placeholder="30s" />
        </FieldWrapper>
        <FieldWrapper label="Iterations (optional)">
          <Input type="number" value={options.iterations || ''} onChange={e => update({ iterations: e.target.value ? String(parseInt(e.target.value)) : '' })} placeholder="e.g. 100" />
        </FieldWrapper>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Thresholds</span>
          <Button size="sm" variant="ghost" onClick={addThreshold}><Plus className="w-3 h-3" /></Button>
        </div>
        {Object.entries(thresholds).map(([key, conds]) => (
          <div key={key} className="flex items-start gap-1">
            <div className="flex-1 space-y-1">
              <input className="w-full text-xs px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={key} onChange={e => {
                const next = { ...thresholds };
                next[e.target.value] = conds;
                if (e.target.value !== key) delete next[key];
                update({ thresholds: next });
              }} placeholder="metric_name" />
              <input className="w-full text-xs px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={conds[0] || ''} onChange={e => {
                update({ thresholds: { ...thresholds, [key]: [e.target.value] } });
              }} placeholder="rate>0.99" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => {
              const next = { ...thresholds };
              delete next[key];
              update({ thresholds: next });
            }}><X className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Environment Vars</span>
          <Button size="sm" variant="ghost" onClick={() => addKeyValue(env, (v) => update({ env: v }))}><Plus className="w-3 h-3" /></Button>
        </div>
        {Object.entries(env).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <input size={8} className="flex-1 text-xs px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={key} onChange={e => {
                const next = { ...env };
                next[e.target.value] = val;
                if (e.target.value !== key) delete next[key];
                update({ env: next });
              }} />
            <input className="flex-1 text-xs px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={val} onChange={e => update({ env: { ...env, [key]: e.target.value } })} />
            <Button size="sm" variant="ghost" onClick={() => {
              const next = { ...env };
              delete next[key];
              update({ env: next });
            }}><X className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tags</span>
          <Button size="sm" variant="ghost" onClick={() => addKeyValue(tags, (v) => update({ tags: v }))}><Plus className="w-3 h-3" /></Button>
        </div>
        {Object.entries(tags).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <input className="flex-1 text-xs px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={key} onChange={e => {
                const next = { ...tags };
                next[e.target.value] = val;
                if (e.target.value !== key) delete next[key];
                update({ tags: next });
              }} />
            <input className="flex-1 text-xs px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={val} onChange={e => update({ tags: { ...tags, [key]: e.target.value } })} />
            <Button size="sm" variant="ghost" onClick={() => {
              const next = { ...tags };
              delete next[key];
              update({ tags: next });
            }}><X className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}