import React, { useState, useRef, useEffect } from 'react';
import { BlockField } from '../../../lib/test-builder/types';
import { ChevronDown, Check, FunctionSquare, Trash2, Plus } from 'lucide-react';
import FunctionsDialog from '../FunctionsDialog';

export function EditableLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-500 outline-none text-gray-900 dark:text-gray-100 px-0 py-0.5"
    />
  );
}

export function StringField({ field, value, onChange, fieldError }: { field: BlockField; value: unknown; onChange: (v: string) => void; fieldError?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
      {fieldError && <p className="text-[10px] text-red-500 mb-0.5">{fieldError}</p>}
      <input
        type="text"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`w-full text-xs px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 ${fieldError ? 'border-red-400 dark:border-red-500' : 'dark:border-gray-600'}`}
      />
    </div>
  );
}

export function NumberField({ field, value, onChange, fieldError }: { field: BlockField; value: unknown; onChange: (v: string) => void; fieldError?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
      {fieldError && <p className="text-[10px] text-red-500 mb-0.5">{fieldError}</p>}
      <input
        type="number"
        value={(value as number | string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`w-full text-xs px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 ${fieldError ? 'border-red-400 dark:border-red-500' : 'dark:border-gray-600'}`}
      />
    </div>
  );
}

export function BooleanField({ field, value, onChange, fieldError }: { field: BlockField; value: unknown; onChange: (v: boolean) => void; fieldError?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
      />
      {field.label}
    </label>
  );
}

export function SelectField({ field, value, onChange, fieldError }: { field: BlockField; value: unknown; onChange: (v: string) => void; fieldError?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = (field.options || []).find(o => o.value === value) || null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{field.label}</label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-brand-400 dark:hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
        >
          <span className={selected ? '' : 'text-gray-400'}>{selected ? selected.label : 'Select...'}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg dark:shadow-black/30 overflow-hidden animate-fade-in">
            {(field.options || []).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 text-xs px-3 py-2 text-left transition-colors ${
                  value === opt.value
                    ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check className="w-3 h-3 text-brand-500" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CodeField({ field, value, onChange, showFunctionsHelper, fieldError }: { field: BlockField; value: unknown; onChange: (v: string) => void; showFunctionsHelper?: boolean; fieldError?: string }) {
  const [showHelper, setShowHelper] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{field.label}</label>
        {fieldError && <span className="text-[10px] text-red-500">{fieldError}</span>}
        {showFunctionsHelper && (
          <button
            onClick={() => setShowHelper(true)}
            className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
            title="Functions Helper"
          >
            <FunctionSquare className="w-3 h-3" /> Fn
          </button>
        )}
      </div>
      <textarea
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={`w-full text-xs px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y ${fieldError ? 'border-red-400 dark:border-red-500' : 'dark:border-gray-600'}`}
      />
      <FunctionsDialog open={showHelper} onClose={() => setShowHelper(false)} />
    </div>
  );
}

export function HeadersField({ value, onChange, fieldError }: { value: unknown; onChange: (v: unknown) => void; fieldError?: string }) {
  const headers = Array.isArray(value) ? value as { key: string; value: string }[] : [];

  const update = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange(updated);
  };

  const add = () => onChange([...headers, { key: '', value: '' }]);
  const remove = (idx: number) => onChange(headers.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Headers</label>
      <div className="space-y-1">
        {headers.map((h, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={h.key} onChange={(e) => update(i, 'key', e.target.value)}
              placeholder="Key" className="flex-1 text-xs px-1.5 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input type="text" value={h.value} onChange={(e) => update(i, 'value', e.target.value)}
              placeholder="Value" className="flex-1 text-xs px-1.5 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
        <button onClick={add} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Add header</button>
      </div>
    </div>
  );
}

export function JsonField({ field, value, onChange, fieldError }: { field: BlockField; value: unknown; onChange: (v: string) => void; fieldError?: string }) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
      <textarea
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={5}
        className={`w-full text-xs px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y ${fieldError ? 'border-red-400 dark:border-red-500' : 'dark:border-gray-600'}`}
      />
    </div>
  );
}

export function StagesEditor({ value, onChange, isRamping, fieldError }: { value: unknown; onChange: (v: unknown) => void; isRamping?: boolean; fieldError?: string }) {
  const stages = Array.isArray(value) ? value as { duration: string; target: number }[] : [];

  const update = (idx: number, field: 'duration' | 'target', val: string) => {
    const updated = stages.map((s, i) => i === idx ? { ...s, [field]: field === 'target' ? parseInt(val) || 0 : val } : s);
    onChange(updated);
  };

  const add = () => onChange([...stages, { duration: '30s', target: 5 }]);
  const remove = (idx: number) => onChange(stages.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        {isRamping ? 'Ramping Stages' : 'Stages'}
      </label>
      <div className="space-y-1.5">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-600 p-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                <span>Duration</span>
                <span className="text-gray-300">|</span>
                <span>Target VUs</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={s.duration}
                  onChange={(e) => update(i, 'duration', e.target.value)}
                  placeholder="30s"
                  className="w-full text-xs px-1.5 py-1 rounded border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="number"
                  value={s.target}
                  onChange={(e) => update(i, 'target', e.target.value)}
                  placeholder="10"
                  min="0"
                  className="w-full text-xs px-1.5 py-1 rounded border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={add}
          className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline w-full justify-center py-1 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:border-brand-400"
        >
          <Plus className="w-3 h-3" /> Add Stage
        </button>
      </div>
    </div>
  );
}
