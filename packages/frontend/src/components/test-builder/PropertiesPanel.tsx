import React from 'react';
import { TestBlock, BLOCK_REGISTRY, BlockField, validateBlock } from '../../lib/test-builder/types';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Trash2, Copy } from 'lucide-react';
import {
  EditableLabel, StringField, NumberField, BooleanField, SelectField,
  CodeField, HeadersField, JsonField, StagesEditor, DataFilePicker
} from './fields';

interface PropertiesPanelProps {
  block: TestBlock | null;
  onUpdate: (block: TestBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function PropertiesPanel({ block, onUpdate, onDelete, onDuplicate }: PropertiesPanelProps) {
  if (!block) {
    const Icon = Icons.Settings2 as LucideIcon;
    return (
      <div className="w-72 border-l dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
        <Icon className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">Select a block to edit its properties</p>
      </div>
    );
  }

  const def = BLOCK_REGISTRY[block.type];
  const colorClass = def?.color || 'gray';
  const labelColor = `text-${colorClass}-600 dark:text-${colorClass}-400`;
  const blockErrors = block ? validateBlock(block) : [];
  const errorMap = new Map(blockErrors.map(e => [e.field, e.message]));

  const updateProperty = (key: string, value: unknown) => {
    onUpdate({ ...block, properties: { ...block.properties, [key]: value } });
  };

  const renderField = (field: BlockField) => {
    const value = block.properties[field.key] ?? field.defaultValue;
    const fieldError = errorMap.get(field.key);
    switch (field.type) {
      case 'string': return <StringField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'number': return <NumberField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'boolean': return <BooleanField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'select': return <SelectField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'code': return <CodeField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} showFunctionsHelper={true} fieldError={fieldError} />;
      case 'headers': return <HeadersField key={field.key} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'json': return <JsonField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'stages': return <StagesEditor key={field.key} value={value} onChange={(v) => updateProperty(field.key, v)} isRamping={block.type === 'arrivals-scenario'} fieldError={fieldError} />;
      case 'env-var': return <StringField key={field.key} field={field} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      case 'data-file': return <DataFilePicker key={field.key} value={value} onChange={(v) => updateProperty(field.key, v)} fieldError={fieldError} />;
      default: return null;
    }
  };

  return (
    <div className="w-72 border-l dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col h-full">
      <div className="p-3 border-b dark:border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelColor}`}>
            {def?.label || 'Block'}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={onDuplicate} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-black/5 dark:hover:bg-white/5">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <EditableLabel value={block.label} onChange={(v) => onUpdate({ ...block, label: v })} />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(def?.fields || []).filter(f => !f.showIf || block.properties[f.showIf.key] === f.showIf.value).map(renderField)}

        <div className="pt-2 border-t dark:border-gray-700">
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={block.enabled}
              onChange={(e) => onUpdate({ ...block, enabled: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
            />
            Enabled
          </label>
        </div>
      </div>
    </div>
  );
}
