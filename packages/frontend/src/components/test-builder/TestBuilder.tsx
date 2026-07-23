import React, { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BlockPalette from './BlockPalette';
import VisualTree from './VisualTree';
import PropertiesPanel from './PropertiesPanel';
import { TestBlock, BlockType, createBlock, BLOCK_REGISTRY, SAMPLER_TYPES, POST_PROCESSOR_TYPES, validateBlock } from '../../lib/test-builder/types';
import { generateScript } from '../../lib/test-builder/generator';
import { parseScriptToBlocks } from '../../lib/test-builder/parser';
import { SCRIPT_TEMPLATES } from '../../lib/test-builder/templates';
const CATEGORY_COLORS: Record<string, string> = {
  'REST API': 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  'GraphQL': 'bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
  'gRPC': 'bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400',
  'WebSocket': 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400',
  'Browser': 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  'Database': 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  'Load Test': 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
  'Monitoring': 'bg-teal-100 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400',
  'Integration': 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'REST API': <Globe className="w-4 h-4" />,
  'GraphQL': <FileJson className="w-4 h-4" />,
  'gRPC': <Radio className="w-4 h-4" />,
  'WebSocket': <Server className="w-4 h-4" />,
  'Browser': <Box className="w-4 h-4" />,
  'Database': <Database className="w-4 h-4" />,
  'Load Test': <Activity className="w-4 h-4" />,
  'Monitoring': <Shield className="w-4 h-4" />,
  'Integration': <Sparkles className="w-4 h-4" />,
};
import { curlToBlocks } from '../../lib/test-builder/import-curl';
import { harToBlocks } from '../../lib/test-builder/import-har';
import { postmanToBlocks } from '../../lib/test-builder/import-postman';
import { parseJmx, jmeterToScript } from '../../lib/test-builder/import-jmeter';
import { Button } from '../ui';
import Modal from '../Modal';
import FuncVarPanel from './FuncVarPanel';
import {
  FileDown, FileUp, Upload, Download, FileCode, Play, Plus,
  FileJson, FileText, Variable, Settings2, Globe, Radio, Server, Box,
  Zap, Activity, Shield, Database, Sparkles, Search, X, Layers,
  Check, Undo2, Redo2, AlertTriangle
} from 'lucide-react';
import { api } from '../../api/client';
import { useToastStore } from '../../stores/toastStore';
import { useEnvironments } from '../../hooks/useEnvironments';

interface TestBuilderProps {
  code: string;
  onCodeChange: (code: string) => void;
  scriptId?: string;
}

export interface TestBuilderHandle {
  flushSync: () => void;
}

export default forwardRef<TestBuilderHandle, TestBuilderProps>(function TestBuilder({ code, onCodeChange, scriptId }: TestBuilderProps, ref) {
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [blocks, setBlocks] = useState<TestBlock[]>([]);
  const codeRef = useRef(code);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const jmeterFileRef = useRef<HTMLInputElement>(null);
  const internalUpdateRef = useRef(false);

  // Sync blocks when code changes (e.g., navigating to a new script)
  useEffect(() => {
    if (codeRef.current === code) return;
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }
    codeRef.current = code;
    const parsed = parseScriptToBlocks(code);
    if (parsed.length > 0) setBlocks(parsed);
  }, [code]);

  // Initial parse on mount
  useEffect(() => {
    if (blocks.length > 0) return;
    const parsed = parseScriptToBlocks(code);
    if (parsed.length > 0) setBlocks(parsed);
  }, []);

  // Load visual blocks from backend on mount when scriptId is present
  useEffect(() => {
    if (!scriptId) return;
    api.getScript(scriptId).then(s => {
      if (s.blocks) {
        try {
          const parsed = JSON.parse(s.blocks);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBlocks(parsed);
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, [scriptId]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const updateSelectedId = useCallback((id: string | null) => {
    selectedIdRef.current = id;
    setSelectedId(id);
  }, []);
  const [showImport, setShowImport] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importType, setImportType] = useState<'curl' | 'har' | 'postman'>('curl');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFunctions, setShowFunctions] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const selectedBlock = blocks.length > 0 ? findBlock(blocks, selectedId) : null;

  const syncTimer = useRef<ReturnType<typeof setTimeout>>();

  const syncToCode = useCallback((newBlocks: TestBlock[], immediate?: boolean) => {
    setBlocks(newBlocks);
    clearTimeout(syncTimer.current);
    const doSync = () => {
      const generated = generateScript(newBlocks);
      internalUpdateRef.current = true;
      onCodeChange(generated);

      // Auto-save visual blocks to backend
      if (scriptId) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          api.saveBlocks(scriptId, JSON.stringify(newBlocks)).catch(() => {});
        }, 2000);
      }
    };
    if (immediate) {
      doSync();
    } else {
      syncTimer.current = setTimeout(doSync, 200);
    }
  }, [onCodeChange]);

  useImperativeHandle(ref, () => ({
    flushSync: () => {
      syncToCode(blocks, true);
    },
  }), [blocks, syncToCode]);

  // Undo/redo
  const MAX_HISTORY = 50;
  const undoStackRef = useRef<TestBlock[][]>([]);
  const redoStackRef = useRef<TestBlock[][]>([]);
  const skipHistoryRef = useRef(false);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_HISTORY - 1)), blocksRef.current];
    redoStackRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current = [...redoStackRef.current, blocksRef.current];
    skipHistoryRef.current = true;
    syncToCode(prev, true);
  }, [syncToCode]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current = [...undoStackRef.current, blocksRef.current];
    skipHistoryRef.current = true;
    syncToCode(next, true);
  }, [syncToCode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const handleChange = useCallback((newBlocks: TestBlock[]) => {
    pushHistory();
    syncToCode(newBlocks);
  }, [syncToCode, pushHistory]);

  const handleAddBlock = useCallback((type: BlockType) => {
    const newBlock = createBlock(type);
    const def = BLOCK_REGISTRY[type];
    const selId = selectedIdRef.current;
    if (selId && !def?.rootOnly) {
      const selected = findBlock(blocksRef.current, selId);
      if (selected && BLOCK_REGISTRY[selected.type]?.canHaveChildren) {
        if (!(SAMPLER_TYPES.has(selected.type) && !POST_PROCESSOR_TYPES.has(type))) {
          const addToContainer = (list: TestBlock[]): TestBlock[] => {
            return list.map(b => {
              if (b.id === selId) {
                return { ...b, children: [...b.children, newBlock] };
              }
              if (b.children.length > 0) return { ...b, children: addToContainer(b.children) };
              return b;
            });
          };
          pushHistory();
          syncToCode(addToContainer(blocksRef.current));
          updateSelectedId(newBlock.id);
          return;
        }
      }
    }
    pushHistory();
    syncToCode([...blocksRef.current, newBlock]);
    updateSelectedId(newBlock.id);
  }, [syncToCode, pushHistory]);

  const handleUpdateBlock = useCallback((updated: TestBlock) => {
    const updateInTree = (list: TestBlock[]): TestBlock[] => {
      return list.map(b => {
        if (b.id === updated.id) return updated;
        if (b.children.length > 0) return { ...b, children: updateInTree(b.children) };
        return b;
      });
    };
    pushHistory();
    syncToCode(updateInTree(blocksRef.current));
  }, [syncToCode, pushHistory]);

  const handleImport = () => {
    if (!importInput.trim()) return;
    let imported: TestBlock[] = [];
    if (importType === 'curl') imported = curlToBlocks(importInput);
    else if (importType === 'har') imported = harToBlocks(importInput);
    else if (importType === 'postman') imported = postmanToBlocks(importInput);

    if (imported.length > 0) {
      pushHistory();
      syncToCode([...blocksRef.current, ...imported]);
      setShowImport(false);
      setImportInput('');
    }
  };

  const handleImportJmeter = () => {
    jmeterFileRef.current?.click();
  };

  const handleJmeterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const imported = parseJmx(content);
      if (imported.length > 0) {
        jmeterToScript(imported);
        pushHistory();
        syncToCode([...blocksRef.current, ...imported]);
        toast.success(`Imported ${imported.length} step(s) from JMeter`);
      } else {
        toast.error('No test steps could be parsed from the JMX file');
      }
    } catch (err: any) {
      toast.error('Failed to import JMeter file', err?.message || 'Unknown error');
    }
    if (jmeterFileRef.current) {
      jmeterFileRef.current.value = '';
    }
  };

  const handleUseTemplate = (templateCode: string, templateBlocks?: TestBlock[]) => {
    if (templateBlocks && templateBlocks.length > 0) {
      syncToCode(templateBlocks, true);
    } else {
      onCodeChange(templateCode);
      const parsed = parseScriptToBlocks(templateCode);
      if (parsed.length > 0) setBlocks(parsed);
    }
    setShowTemplates(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('block-type') as BlockType;
    if (blockType && BLOCK_REGISTRY[blockType]) {
      handleAddBlock(blockType);
    }
  }, [handleAddBlock]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const filteredTemplates = SCRIPT_TEMPLATES.filter(t => {
    if (templateSearch) {
      const q = templateSearch.toLowerCase();
      return t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q));
    }
    if (selectedCategory) return t.category === selectedCategory;
    return true;
  });

  const [running, setRunning] = useState(false);
  const [envId, setEnvId] = useState<string | null>(null);
  const { envs } = useEnvironments(pid);

  const handleQuickRun = useCallback(async () => {
    if (!pid || !scriptId) { toast.error('Project or script ID missing'); return; }
    setRunning(true);
    try {
      syncToCode(blocksRef.current, true);
      const generated = generateScript(blocksRef.current);
      await api.updateScript(scriptId, { content: generated });
      await api.saveBlocks(scriptId, JSON.stringify(blocksRef.current));
      const script = await api.getScript(scriptId);
      // If a configuration already exists for this script, use it directly without clearing options.
      // If no configuration exists, only then create an empty default configuration file.
      const configs = await api.listConfigs(scriptId);
      let config = configs.find((c: any) => !c.name?.startsWith('Quick Run - ')) || configs[0];
      if (!config) {
        config = await api.createConfig(scriptId, {
          name: `Default Configuration (${script.name})`,
          options: {},
        });
      }
      const run = await api.triggerRun(config.id, envId ? { environmentId: envId } : undefined);
      navigate(`/projects/${pid}/runs/${run.id}/live`);
    } catch (err: any) {
      toast.error('Failed to start quick run', err?.message || 'Unknown error');
    } finally {
      setRunning(false);
    }
  }, [pid, scriptId, syncToCode, navigate, toast, envId]);

  return (
    <div className="flex h-full">
      <BlockPalette onAddBlock={handleAddBlock} />
      <div
        className="flex-1 flex flex-col"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Settings2 className="w-3.5 h-3.5" />
            <span>{blocks.length} step{blocks.length !== 1 ? 's' : ''}</span>
            {(() => {
              const allErrors = blocks.flatMap(b => validateBlock(b));
              if (allErrors.length === 0) return null;
              return (
                <span className="flex items-center gap-0.5 ml-1 text-amber-600 dark:text-amber-400" title={allErrors.map(e => e.message).join('\n')}>
                  <AlertTriangle className="w-3 h-3" />
                  <span>{allErrors.length} issue{allErrors.length !== 1 ? 's' : ''}</span>
                </span>
              );
            })()}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleUndo} disabled={undoStackRef.current.length === 0}
              title="Undo (Ctrl+Z)">
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRedo} disabled={redoStackRef.current.length === 0}
              title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
            <Button size="sm" variant="ghost" onClick={() => setShowFunctions(!showFunctions)}>
              <Variable className="w-3.5 h-3.5" /> Functions
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowTemplates(!showTemplates)}>
              <FileCode className="w-3.5 h-3.5" /> Templates
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>
              <Upload className="w-3.5 h-3.5" /> Import
            </Button>
            <Button size="sm" variant="ghost" onClick={handleImportJmeter}>
              <FileCode className="w-3.5 h-3.5" /> Import JMeter
            </Button>
            {envs.length > 0 && (
              <select
                value={envId ?? ''}
                onChange={(e) => setEnvId(e.target.value || null)}
                className="text-xs px-2 py-1 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[150px]"
                title="Environment profile"
              >
                <option value="">Default env</option>
                {envs.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}{e.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            )}
            <Button size="sm" variant="primary" onClick={handleQuickRun} disabled={running || blocks.length === 0}>
              <Play className="w-3.5 h-3.5" /> {running ? 'Running...' : 'Run'}
            </Button>
          </div>
        </div>
        <VisualTree
          blocks={blocks}
          selectedId={selectedId}
          onSelect={updateSelectedId}
          onChange={handleChange}
        />
      </div>
      {showFunctions && (
        <FuncVarPanel
          onInsert={(syntax) => {
            navigator.clipboard.writeText(syntax);
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
            toast.textContent = `Copied: ${syntax}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
          }}
        />
      )}
      <PropertiesPanel
        block={selectedBlock}
        onUpdate={handleUpdateBlock}
        onDelete={() => {
          const deleteFn = (list: TestBlock[]): TestBlock[] => list.filter(b => {
            if (b.id === selectedId) return false;
            if (b.children.length > 0) b.children = deleteFn(b.children);
            return true;
          });
          pushHistory();
          syncToCode(deleteFn(blocksRef.current));
          updateSelectedId(null);
        }}
        onDuplicate={() => {
          if (!selectedBlock) return;
          const dup = { ...selectedBlock, id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2), label: selectedBlock.label + ' (copy)' };
          const insertAfter = (list: TestBlock[]): TestBlock[] => {
            const idx = list.findIndex(b => b.id === selectedId);
            if (idx >= 0) {
              const result = [...list];
              result.splice(idx + 1, 0, dup);
              return result;
            }
            return list.map(b => ({ ...b, children: b.children.length > 0 ? insertAfter(b.children) : b.children }));
          };
          pushHistory();
          syncToCode(insertAfter(blocksRef.current));
          updateSelectedId(dup.id);
        }}
      />

      <input
        type="file"
        ref={jmeterFileRef}
        accept=".jmx"
        onChange={handleJmeterFileChange}
        className="hidden"
      />
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Test Steps">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setImportType('curl')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                importType === 'curl' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            ><FileText className="w-3.5 h-3.5" /> cURL</button>
            <button onClick={() => setImportType('har')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                importType === 'har' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            ><FileJson className="w-3.5 h-3.5" /> HAR</button>
            <button onClick={() => setImportType('postman')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                importType === 'postman' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            ><FileJson className="w-3.5 h-3.5" /> Postman</button>
          </div>
          {importType === 'curl' ? (
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Paste a cURL command here..."
              rows={6}
              className="w-full text-xs px-3 py-2 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
            />
          ) : importType === 'har' ? (
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Paste HAR JSON content here..."
              rows={6}
              className="w-full text-xs px-3 py-2 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
            />
          ) : (
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Paste Postman Collection v2 JSON here..."
              rows={6}
              className="w-full text-xs px-3 py-2 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!importInput.trim()}>
              <Download className="w-3.5 h-3.5" /> Import
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showTemplates} onClose={() => { setShowTemplates(false); setSelectedCategory(null); }} title="Script Templates" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full text-xs pl-8 pr-8 py-2 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {templateSearch && (
                <button onClick={() => setTemplateSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{filteredTemplates.length} templates</span>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(SCRIPT_TEMPLATES.map(t => t.category))).map(cat => {
              const count = SCRIPT_TEMPLATES.filter(t => t.category === cat).length;
              const active = !templateSearch && selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                    active
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="shrink-0">{CATEGORY_ICONS[cat]}</span>
                  {cat}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[cat]}`}>{count}</span>
                </button>
              );
            })}
            {selectedCategory && (
              <button onClick={() => setSelectedCategory(null)} className="text-[11px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-2 gap-3 max-h-[28rem] overflow-y-auto pr-1">
            {filteredTemplates.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-8 text-gray-400">
                <FileCode className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No templates match your search</p>
              </div>
            )}
            {filteredTemplates.map(t => (
              <div
                key={t.id}
                className="relative group rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-all hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700"
              >
                {/* Preview line */}
                {selectedTemplate === t.id ? (
                  <div className="p-3 border-b dark:border-gray-700">
                    <pre className="text-[10px] text-gray-600 dark:text-gray-300 font-mono overflow-x-auto whitespace-pre max-h-32 scrollbar-thin">{t.code.slice(0, 500)}{t.code.length > 500 ? '...' : ''}</pre>
                  </div>
                ) : null}
                {/* Card body */}
                <div className="p-3 cursor-pointer" onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={CATEGORY_COLORS[t.category] + ' p-0.5 rounded'}>
                        {CATEGORY_ICONS[t.category]}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t.category}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 px-3 pb-3">
                  {selectedTemplate === t.id && (
                    <Button size="sm" onClick={() => handleUseTemplate(t.code, t.blocks)} className="flex-1">
                      <Check className="w-3 h-3" /> Use Template
                    </Button>
                  )}
                  <button
                    onClick={() => { navigator.clipboard.writeText(t.code); }}
                    className="text-[10px] px-2 py-1 rounded-md border dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
});

function findBlock(blocks: TestBlock[], id: string | null): TestBlock | null {
  if (!id) return null;
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children.length > 0) {
      const found = findBlock(b.children, id);
      if (found) return found;
    }
  }
  return null;
}
