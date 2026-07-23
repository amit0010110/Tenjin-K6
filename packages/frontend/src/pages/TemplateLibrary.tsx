import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTitle } from '../hooks/useTitle';
import { Button, Input, FieldWrapper } from '../components/ui';
import { PageSkeleton } from '../components/Skeleton';
import {
  FileText, Code, Search, X, Sparkles, ChevronRight,
  Globe, Radio, Server, Box, Zap, Activity, ShieldCheck, Layout,
  Check, Download, AlertCircle, Layers, Eye,
  RefreshCw, Plus, Grid, ArrowRight, Clock
} from 'lucide-react';

interface Template {
  id: string; name: string; description: string;
  category: string; content: string; tags?: string[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  'REST API': <Globe className="w-4 h-4" />,
  'WebSocket': <Radio className="w-4 h-4" />,
  'gRPC': <Server className="w-4 h-4" />,
  'GraphQL': <Box className="w-4 h-4" />,
  'Browser': <Zap className="w-4 h-4" />,
  'Load Test': <Activity className="w-4 h-4" />,
  'Monitoring': <ShieldCheck className="w-4 h-4" />,
  'Integration': <Layers className="w-4 h-4" />,
};

const badgeColors: Record<string, string> = {
  'REST API': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'WebSocket': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'gRPC': 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'GraphQL': 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  'Browser': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Load Test': 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'Monitoring': 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  'Integration': 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
};

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export default function TemplateLibrary() {
  useTitle('Script Templates');
  const { pid } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'listview'>('grid');

  useEffect(() => {
    fetch('/api/v1/templates', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  }, [token]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    templates.forEach(t => cats.add(t.category));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeCategory && t.category !== activeCategory) return false;
      return true;
    });
  }, [templates, search, activeCategory]);

  const handleCreate = async () => {
    if (!selected || !name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/templates/use', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected.id, projectId: pid, name }),
      });
      if (!res.ok) { setError('Failed to create script from template'); return; }
      const script = await res.json();
      navigate(`/projects/${pid}/plans/${script.id}`);
    } catch { setError('Failed to create script from template'); } finally { setCreating(false); }
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const total = templates.length;

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/30">
              <FileText className="w-4 h-4 text-brand-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Script Templates</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total} templates across {categories.length} categories &middot; Bootstrap scripts instantly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 flex">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            ><Grid className="w-3.5 h-3.5" /></button>
            <button onClick={() => setViewMode('listview')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'listview' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            ><ListIcon className="w-3.5 h-3.5" /></button>
          </div>
           <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${pid}/plans`)}>
             <ArrowRight className="w-3.5 h-3.5" /> Test Plans
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30"><FileText className="w-5 h-5 text-indigo-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{total}</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Templates</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30"><Layers className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{categories.length}</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Categories</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/30"><Sparkles className="w-5 h-5 text-violet-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">1-click</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Script generation</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30"><Clock className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pre-built</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Best practices</p></div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates by name or description..."
          className="w-full pl-9 pr-8 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
        />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !activeCategory ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >All ({total})</button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeCategory === cat ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {categoryIcons[cat]}{cat}
          </button>
        ))}
      </div>

      {/* Template grid/list */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Search className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search || activeCategory ? 'No templates match your filters' : 'No templates available'}
          </p>
          {(search || activeCategory) && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setSearch(''); setActiveCategory(null); }}>
              <RefreshCw className="w-3.5 h-3.5" /> Clear Filters
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div
              key={t.id}
              onClick={() => { setSelected(t); setName(t.name); }}
              className={`group relative p-5 rounded-xl border cursor-pointer transition-all bg-white dark:bg-gray-900 ${
                selected?.id === t.id
                  ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2.5 rounded-lg shrink-0 ${badgeColors[t.category]?.split(' ').slice(0, 2).join(' ') || 'bg-gray-100 dark:bg-gray-800'}`}>
                  {categoryIcons[t.category] || <FileText className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColors[t.category] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                  {t.category}
                </span>
                {selected?.id === t.id && (
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Selected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {filtered.map(t => (
            <div
              key={t.id}
              onClick={() => { setSelected(t); setName(t.name); }}
              className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all ${
                selected?.id === t.id ? 'bg-brand-50 dark:bg-brand-950/20 border-l-2 border-brand-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30 border-l-2 border-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${badgeColors[t.category]?.split(' ').slice(0, 2).join(' ') || 'bg-gray-100 dark:bg-gray-800'}`}>
                {categoryIcons[t.category] || <FileText className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColors[t.category] || 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
                    {t.category}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>
              </div>
              {selected?.id === t.id ? (
                <Check className="w-4 h-4 text-brand-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-300" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selection panel */}
      {selected && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${badgeColors[selected.category]?.split(' ').slice(0, 2).join(' ') || 'bg-gray-100 dark:bg-gray-800'}`}>
                {categoryIcons[selected.category] || <FileText className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selected.name}</h3>
                <p className="text-xs text-gray-500">{selected.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="w-4 h-4" /> Clear
            </Button>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Create from template</span>
              </div>
              <FieldWrapper label="Script name" hint="Give your new script a meaningful name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. User Auth Flow Load Test" />
              </FieldWrapper>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating || !name} className="flex-1">
                  {creating ? 'Creating...' : `Create "${name || 'Script'}"`}
                </Button>
                <Button variant="secondary" onClick={() => setShowPreview(!showPreview)}>
                  <Eye className="w-4 h-4" /> {showPreview ? 'Hide' : 'Preview'}
                </Button>
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <p className="text-[10px] text-gray-400">
                Script will be created with best-practice defaults. You can edit it after creation.
              </p>
            </div>

            {showPreview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <Code className="w-3 h-3" />
                    <span className="uppercase tracking-wider">Preview</span>
                  </div>
                  <button onClick={() => copyContent(selected.content)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <CopyIcon /> Copy
                  </button>
                </div>
                <pre className="bg-gray-950 text-gray-100 text-xs p-4 rounded-xl overflow-x-auto max-h-72 border border-gray-800 font-mono leading-relaxed">
                  {selected.content.slice(0, 2000)}
                  {selected.content.length > 2000 ? '\n// ... (truncated)' : ''}
                </pre>
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-[10px] text-gray-400">Or use the template directly:</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => copyContent(selected.content)}>
                <CopyIcon /> Copy Code
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                const blob = new Blob([selected.content], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `${selected.name.replace(/\s+/g, '_')}.js`; a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="w-3.5 h-3.5" /> Download .js
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating || !name}>
                {creating ? 'Creating...' : 'Create & Open'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}