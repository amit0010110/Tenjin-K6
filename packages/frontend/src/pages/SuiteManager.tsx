import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, FieldWrapper } from '../components/ui';
import { StatusBadge } from '../components/Badge';
import { Layers, Play, Plus, Trash2, Pencil, X, GripVertical, ChevronDown, ChevronRight, History, Clock, CheckCircle, XCircle } from 'lucide-react';

interface SuiteScript {
  id: string; scriptId: string; order: number; script: { id: string; name: string };
}

interface Suite {
  id: string; name: string; createdAt: string;
  scripts: SuiteScript[];
  _lastRun?: { status: string; suiteRunId: string; createdAt: string } | null;
  _runHistory?: RunGroup[];
}

interface RunGroup {
  suiteRunId: string; createdAt: string; runs: any[];
}

export default function SuiteManager() {
  useTitle('Test Suites');
  const { pid } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const toast = useToastStore();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [suiteData, scriptData] = await Promise.all([
        fetch(`/api/v1/projects/${pid}/suites`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        api.listScripts(pid!),
      ]);
      setScripts(scriptData);

      const enriched = await Promise.all(
        suiteData.map(async (s: any) => {
          const runs = await api.getSuiteRuns(s.id).catch(() => []);
          const groups: Record<string, RunGroup> = {};
          for (const run of runs) {
            if (!groups[run.suiteRunId]) {
              groups[run.suiteRunId] = { suiteRunId: run.suiteRunId, createdAt: run.createdAt, runs: [] };
            }
            groups[run.suiteRunId].runs.push(run);
          }
          const history = Object.values(groups).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const lastRun = history.length > 0 ? history[0].runs[0] : null;
          return { ...s, _lastRun: lastRun ? { status: lastRun.status, suiteRunId: lastRun.suiteRunId, createdAt: lastRun.createdAt } : null, _runHistory: history };
        })
      );
      setSuites(enriched);
    } catch {
      setError('Failed to load suites');
    } finally {
      setLoading(false);
    }
  }, [pid, token]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setName(''); setSelectedScriptIds([]); setShowForm(true); };
  const openEdit = (s: Suite) => {
    setEditId(s.id);
    setName(s.name);
    setSelectedScriptIds(s.scripts.map((ss) => ss.scriptId));
    setShowForm(true);
  };

  const handleSave = async () => {
    setError(null);
    try {
      const url = editId ? `/api/v1/suites/${editId}` : `/api/v1/projects/${pid}/suites`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scriptIds: selectedScriptIds }),
      });
      if (!res.ok) { setError('Failed to save suite'); return; }
      setShowForm(false);
      toast.success(editId ? 'Suite updated' : 'Suite created');
      load();
    } catch { setError('Failed to save suite'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this suite? This cannot be undone.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/suites/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError('Failed to delete suite'); return; }
      setSuites((prev) => prev.filter((s) => s.id !== id));
      toast.success('Suite deleted');
    } catch { toast.error('Failed to delete suite'); }
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/suites/${id}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError('Failed to start suite run'); return; }
      const data = await res.json();
      toast.success('Suite run started');
      navigate(`/projects/${pid}/suite-runs/${data.suiteRunId}`);
    } catch { setError('Failed to start suite run'); } finally { setRunning(null); }
  };

  const availableScripts = scripts.filter((s: any) => !selectedScriptIds.includes(s.id));

  const addScript = (scriptId: string) => {
    setSelectedScriptIds((prev) => [...prev, scriptId]);
  };

  const removeScript = (idx: number) => {
    setSelectedScriptIds((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveScript = (from: number, to: number) => {
    if (to < 0 || to >= selectedScriptIds.length) return;
    const ids = [...selectedScriptIds];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setSelectedScriptIds(ids);
  };

  const toggleExpanded = (id: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Test Suites" subtitle={`${suites.length} suite${suites.length !== 1 ? 's' : ''}`}
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" />New Suite</Button>}
      />

      {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}

      {showForm && (
        <Card padding="lg" className="border-brand-400">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editId ? 'Edit Suite' : 'New Suite'}</h3>
          <div className="space-y-4">
            <FieldWrapper label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Regression Suite" required />
            </FieldWrapper>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Execution Order</label>
              <p className="text-xs text-gray-400 mb-2">Drag to reorder. Plans run sequentially in this order.</p>

              {selectedScriptIds.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-400">No plans selected. Add plans from the list below.</p>
                </div>
              ) : (
                <div className="border dark:border-gray-700 rounded-xl divide-y dark:divide-gray-700">
                  {selectedScriptIds.map((scriptId, idx) => {
                    const s = scripts.find((s: any) => s.id === scriptId);
                    return (
                      <div
                        key={scriptId}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={() => { if (dragIdx !== null) moveScript(dragIdx, idx); setDragIdx(null); }}
                        className={`flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${dragIdx === idx ? 'opacity-50' : ''}`}
                      >
                        <span className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4" /></span>
                        <span className="text-gray-400 font-mono text-xs w-5">{idx + 1}.</span>
                        <span className="flex-1 text-gray-900 dark:text-gray-100">{s?.name || scriptId}</span>
                        <button onClick={() => removeScript(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {availableScripts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Plans</label>
                <div className="border dark:border-gray-700 rounded-xl max-h-36 overflow-y-auto divide-y dark:divide-gray-700">
                  {availableScripts.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addScript(s.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!name || selectedScriptIds.length === 0}>Save</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}><X className="w-4 h-4" />Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <Card key={i} padding="md"><div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}
        </div>
      ) : suites.length === 0 && !showForm ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Layers className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No test suites yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a suite to run multiple plans sequentially.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {suites.map((s) => (
            <Card key={s.id} padding="md">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Layers className="w-5 h-5 text-brand-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</h3>
                      {s._lastRun && (
                        <StatusBadge status={s._lastRun.status} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {s.scripts.length} plan{s.scripts.length !== 1 ? 's' : ''}
                      {s._lastRun && ` · Last run ${new Date(s._lastRun.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => handleRun(s.id)} disabled={running === s.id}>
                    <Play className="w-3.5 h-3.5" />{running === s.id ? 'Starting...' : 'Run'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Plan order list */}
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 ml-8 mb-2">
                {s.scripts.map((ss, i) => (
                  <div key={ss.id} className="flex items-center gap-2">
                    <span className="text-gray-300 dark:text-gray-600 font-mono w-4">{i + 1}.</span>
                    <span>{ss.script?.name || 'Unknown'}</span>
                  </div>
                ))}
              </div>

              {/* Run history toggle */}
              {s._runHistory && s._runHistory.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-2 mt-2">
                  <button
                    onClick={() => toggleExpanded(s.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    {expandedSuites.has(s.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <History className="w-3.5 h-3.5" />
                    Run History ({s._runHistory.length})
                  </button>

                  {expandedSuites.has(s.id) && (
                    <div className="mt-2 space-y-2">
                      {s._runHistory.slice(0, 10).map((group) => (
                        <div
                          key={group.suiteRunId}
                          onClick={() => navigate(`/projects/${pid}/suite-runs/${group.suiteRunId}`)}
                          className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(group.createdAt).toLocaleString()}
                            </div>
                            <span className="text-xs text-gray-400">{group.runs.length} run{group.runs.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="space-y-1">
                            {group.runs.map((run) => (
                              <div
                                key={run.id}
                                onClick={(e) => { e.stopPropagation(); navigate(`/projects/${pid}/runs/${run.id}`); }}
                                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition-colors"
                              >
                                <StatusBadge status={run.status} />
                                <span className="text-gray-600 dark:text-gray-400 flex-1">{run.script?.name || 'Plan'}</span>
                                <span className="text-gray-400">{run.triggerType || 'suite'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
