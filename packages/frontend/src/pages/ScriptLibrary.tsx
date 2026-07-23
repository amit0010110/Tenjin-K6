import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { CardSkeleton } from '../components/Skeleton';
import { Button, Input } from '../components/ui';
import { useTitle } from '../hooks/useTitle';
import { useToastStore } from '../stores/toastStore';
import { getTagColor } from '../lib/tag-colors';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  FileText, Plus, ChevronDown, Search, X, Tag, Play, Download,
  Upload, Copy, Link, Trash2, Activity, TrendingUp, Sparkles, Layout,
  Box, Clock, Layers, Loader2, CheckSquare, Code
} from 'lucide-react';

export default function ScriptLibrary() {
  useTitle('Test Plans');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateCreating, setTemplateCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    api.listScripts(pid!)
      .then(setScripts)
      .catch((err) => { setError('Failed to load plans'); console.error(err); })
      .finally(() => setLoading(false));
  }, [pid]);
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    scripts.forEach((s) => {
      if (s.tags) Object.keys(s.tags).forEach((k) => tagSet.add(k));
    });
    return Array.from(tagSet).sort();
  }, [scripts]);

  const filtered = useMemo(() => {
    setPage(0);
    return scripts.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedTag && (!s.tags || !s.tags[selectedTag])) return false;
      return true;
    });
  }, [scripts, search, selectedTag]);

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const passedRuns = useMemo(() => scripts.reduce((s, p) => s + (p._count?.testRuns || 0), 0), [scripts]);
  const passedConfigs = useMemo(() => scripts.reduce((s, p) => s + (p._count?.configs || 0), 0), [scripts]);

  const createNew = async (name?: string) => {
    const planName = name?.trim() || 'Untitled Plan';
    setCreating(true);
    setError(null);
    try {
      const script = await api.createScript(pid!, {
        name: planName,
        content: `import http from 'k6/http';\nimport { sleep } from 'k6';\n\nexport default function () {\n  http.get('https://test.k6.io');\n  sleep(1);\n}\n`,
      });
      navigate(`/projects/${pid}/plans/${script.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create test plan');
    } finally {
      setCreating(false);
    }
  };

  const quickRun = async (scriptId: string, scriptName: string) => {
    setRunningId(scriptId);
    try {
      // If a configuration already exists for this script, use it directly without clearing options.
      // If no configuration exists, only then create an empty default configuration file.
      const configs = await api.listConfigs(scriptId);
      let config = configs.find((c: any) => !c.name?.startsWith('Quick Run - ')) || configs[0];
      if (!config) {
        config = await api.createConfig(scriptId, {
          name: `Default Configuration (${scriptName})`,
          options: {},
        });
      }
      const run = await api.triggerRun(config.id);
      navigate(`/projects/${pid}/runs/${run.id}/live`);
    } catch {
      toast.error('Failed to start quick run');
    } finally {
      setRunningId(null);
    }
  };

  const handleDuplicate = async (scriptId: string, scriptName: string) => {
    try {
      const s = await api.getScript(scriptId);
      const script = await api.createScript(pid!, {
        name: `${scriptName} (copy)`,
        content: s.content,
        envVars: s.envVars,
        tags: s.tags,
      });
      toast.success('Plan duplicated');
      setScripts((prev) => [...prev, script]);
    } catch {
      toast.error('Failed to duplicate plan');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    for (const id of selected) { try { await api.deleteScript(id); } catch { /* ignore */ } }
    setScripts((prev) => prev.filter((s) => !selected.has(s.id)));
    setSelected(new Set());
    setSelectMode(false);
    toast.success('Plans deleted');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.deleteScript(deleteTarget); setScripts((prev) => prev.filter((s) => s.id !== deleteTarget)); toast.success('Plan deleted'); } catch { toast.error('Failed to delete plan'); }
    setDeleteTarget(null);
  };

  const handleExport = async (scriptId: string, scriptName: string) => {
    try {
      const s = await api.getScript(scriptId);
      const blob = new Blob([s.content], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scriptName.replace(/\s+/g, '_')}.js`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export plan');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const content = await file.text();
      const name = file.name.replace(/\.js$/i, '') || 'Imported Plan';
      const script = await api.createScript(pid!, { name, content });
      toast.success('Plan imported');
      setScripts((prev) => [...prev, script]);
    } catch {
      toast.error('Failed to import plan');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openTemplates = async () => {
    setDropdownOpen(false);
    setShowTemplates(true);
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/v1/templates', { headers: { Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.token : ''}` } });
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { setTemplates([]); }
    setTemplatesLoading(false);
  };

  const createFromTemplate = async () => {
    if (!selectedTemplate || !templateName) return;
    setTemplateCreating(true);
    try {
      const res = await fetch('/api/v1/templates/use', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.token : ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, projectId: pid, name: templateName }),
      });
      if (!res.ok) { toast.error('Failed to create from template'); return; }
      const script = await res.json();
      setShowTemplates(false);
      setSelectedTemplate(null);
      setTemplateName('');
      setScripts((prev) => [script, ...prev]);
      navigate(`/projects/${pid}/plans/${script.id}`);
    } catch { toast.error('Failed to create from template'); }
    setTemplateCreating(false);
  };

  const renderTags = (tags: Record<string, string> | null) => {
    if (!tags || Object.keys(tags).length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(tags).filter(([,v]) => v).map(([k, v]) => (
          <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getTagColor(k)}`}>
            {k}{v ? `: ${v}` : ''}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Test Plans"
        subtitle={`${filtered.length} of ${scripts.length} plan${scripts.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".js" onChange={handleImport} className="hidden" />
            {selectMode ? (
              <>
                <Button variant="secondary" onClick={handleBulkDelete} disabled={selected.size === 0}>
                  <Trash2 className="w-4 h-4" /> Delete ({selected.size})
                </Button>
                <Button variant="ghost" onClick={() => { setSelectMode(false); setSelected(new Set()); }}>
                  <X className="w-4 h-4" /> Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setSelectMode(true)}>
                  <CheckSquare className="w-4 h-4" /> Select
                </Button>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                  <Upload className="w-4 h-4" />{importing ? 'Importing...' : 'Import'}
                </Button>
              </>
            )}
            <div className="relative" ref={dropdownRef}>
              <div className="flex">
                <Button onClick={() => { setNewPlanName(''); setShowCreateModal(true); }} disabled={creating} className="rounded-r-none border-r-0">
                  <Plus className="w-4 h-4" />
                  {creating ? 'Creating...' : 'New Plan'}
                </Button>
                <Button
                  variant="primary"
                  className="rounded-l-none px-1.5 border-l border-brand-600"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </div>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1 overflow-hidden">
                  <button
                    onClick={() => { setDropdownOpen(false); setNewPlanName(''); setShowCreateModal(true); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-gray-400" />
                    Blank Plan
                  </button>
                  <button
                    onClick={openTemplates}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <Layout className="w-4 h-4 text-gray-400" />
                    From Template
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); navigate(`/projects/${pid}/ai-generator`); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <Sparkles className="w-4 h-4 text-gray-400" />
                    AI Generator
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 mb-4">{error}</div>}

      {/* Stats row */}
      {!loading && scripts.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" />{scripts.length} plans</span>
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" />{passedConfigs} configs</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{passedRuns} runs</span>
        </div>
      )}

      {/* Search + Tag filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-4 h-4 text-gray-400" />
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTag === tag
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTag && (
              <button onClick={() => setSelectedTag(null)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><CardSkeleton key={i}/>)}</div>
      ) : scripts.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No test plans yet"
          description="Create your first performance test plan to get started."
          action={{ label: '+ New Plan', onClick: createNew }}
        />
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Search className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No plans match your filters</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginated.map((s) => (
            <Card key={s.id} padding="md">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => selectMode ? null : navigate(`/projects/${pid}/plans/${s.id}`)}
                >
                  {selectMode && (
                    <input type="checkbox" checked={selected.has(s.id)}
                      onChange={(e) => { e.stopPropagation(); const next = new Set(selected); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); setSelected(next); }}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  )}
                  <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 font-mono">v{s.version}</span>
                      {s._count && (
                        <>
                          <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
                          <span className="text-[10px] text-gray-400">{s._count.configs || 0} configs</span>
                          <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
                          <span className="text-[10px] text-gray-400">{s._count.testRuns || 0} runs</span>
                        </>
                      )}
                    </div>
                    {renderTags(s.tags)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button size="sm" variant="ghost"
                    onClick={(e) => { e.stopPropagation(); navigate(`/projects/${pid}/plans/${s.id}/anomalies`); }}
                    title="Anomaly Detection"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(s.id, s.name); }}
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleExport(s.id, s.name); }}
                    title="Export .js"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={(e) => { e.stopPropagation(); quickRun(s.id, s.name); }}
                    disabled={runningId === s.id}
                    className="min-w-[90px]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {runningId === s.id ? 'Running...' : 'Run'}
                  </Button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400">{filtered.length} total plans</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-2.5 py-1 text-xs rounded-md border dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >Previous</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-7 h-7 text-xs rounded-md transition-colors ${
                  page === i
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >{i + 1}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-2.5 py-1 text-xs rounded-md border dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >Next</button>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Plan" message="This will permanently delete this test plan and all its versions." confirmLabel="Delete" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {/* Create Plan Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Test Plan" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Plan Name</label>
            <Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="e.g., Login Flow Test" autoFocus onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && newPlanName.trim()) { setShowCreateModal(false); createNew(newPlanName); } }} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { setShowCreateModal(false); createNew(newPlanName); }} disabled={!newPlanName.trim()}>
              <Plus className="w-3.5 h-3.5" /> Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Template Picker Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowTemplates(false); setSelectedTemplate(null); setTemplateName(''); }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Choose a Template</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select a template to create a new plan</p>
              </div>
              <button onClick={() => { setShowTemplates(false); setSelectedTemplate(null); setTemplateName(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {templatesLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <Layout className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No templates available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(['http', 'smoke', 'stress'] as const).map((cat) => (
                    templates.filter((t) => t.category === cat).map((t) => (
                      <div
                        key={t.id}
                        onClick={() => { setSelectedTemplate(t); setTemplateName(t.name); }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          selectedTemplate?.id === t.id
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 ring-2 ring-brand-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:bg-gray-800/50 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Code className="w-4 h-4 text-brand-500 shrink-0" />
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{t.name}</span>
                          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{cat}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{t.description}</p>
                      </div>
                    ))
                  ))}
                </div>
              )}
            </div>

            {selectedTemplate && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Plan name</label>
                    <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="My Load Test" className="w-full" />
                  </div>
                  <Button onClick={createFromTemplate} disabled={templateCreating || !templateName} className="mt-5">
                    {templateCreating ? 'Creating...' : `Create "${selectedTemplate.name}"`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}