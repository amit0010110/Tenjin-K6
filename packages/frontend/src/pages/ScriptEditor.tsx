import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { api } from '../api/client';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { getTagColor } from '../lib/tag-colors';
import ConfirmDialog from '../components/ConfirmDialog';
import TestBuilder, { type TestBuilderHandle } from '../components/test-builder/TestBuilder';
import Modal from '../components/Modal';
import { parseScriptToBlocks } from '../lib/test-builder/parser';
import { Save, GitBranch, Play, Settings, History, ChevronRight, Plus, RotateCcw, Code, Layout, Tag, X, Copy, Trash2, Server, Layers, Download } from 'lucide-react';

export default function ScriptEditor() {
  const { pid, sid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [script, setScript] = useState<any>(null);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [mode, setMode] = useState<'visual' | 'code'>('code');
  const [tags, setTags] = useState<Record<string, string>>({});
  const [tagKey, setTagKey] = useState('');
  const [tagVal, setTagVal] = useState('');
  const [diffVersion, setDiffVersion] = useState<any>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [showSavePlan, setShowSavePlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const testBuilderRef = useRef<TestBuilderHandle>(null);

  useEffect(() => {
    if (!sid) return;
    api.getScript(sid).then((s) => { setScript(s); setContent(s.content); setName(s.name); setTags(s.tags ?? {}); });
    api.listConfigs(sid).then(setConfigs).catch(() => {});
    fetch(`/api/v1/scripts/${sid}/versions`).then(r => r.json()).then(setVersions).catch(() => {});
  }, [sid]);

  const handleDiff = async (versionId: string) => {
    try {
      const res = await fetch(`/api/v1/scripts/${sid}/versions/${versionId}`);
      const v = await res.json();
      setDiffVersion(v);
      setDiffContent(v.content);
    } catch {
      toast.error('Failed to load version');
    }
  };

  const handleRestore = async (versionId?: string) => {
    const target = versionId || restoreTarget;
    if (!sid || !target) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/scripts/${sid}/versions/${target}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error('Failed to restore version'); return; }
      const updated = await res.json();
      setScript(updated); setContent(updated.content);
      const v = await fetch(`/api/v1/scripts/${sid}/versions`).then(r => r.json());
      setVersions(v); toast.success('Version restored');
    } catch { toast.error('Failed to restore version'); } finally { setRestoreTarget(null); }
  };

  const handleSave = useCallback(async () => {
    if (!sid) return;
    setSaving(true);
    try {
      const updated = await api.updateScript(sid, { name, content, tags });
      setScript(updated); toast.success('Script saved');
    } catch (err: any) { toast.error('Failed to save', err.message); } finally { setSaving(false); }
  }, [sid, name, content, tags, toast]);

  const triggerRun = async (configId: string) => {
    try {
      const run = await api.triggerRun(configId);
      navigate(`/projects/${pid}/runs/${run.id}/live`);
    } catch { toast.error('Failed to trigger run'); }
  };

  const distributeRun = async (configId: string) => {
    try {
      const result = await api.distributeRun(pid!, configId);
      const accepted = result.dispatchResults?.filter((d: any) => d.accepted).length || 0;
      const total = result.dispatchResults?.length || 0;
      if (accepted > 0) {
        toast.success(`Distributed to ${accepted}/${total} workers`);
        navigate(`/projects/${pid}/runs/${result.run.id}/live`);
      } else {
        toast.error('Distribution failed — no workers accepted');
      }
    } catch (err: any) {
      toast.error('Failed to distribute run', err.message);
    }
  };

  const deleteConfig = async (configId: string, configName: string) => {
    if (!confirm(`Delete config "${configName}"? This cannot be undone.`)) return;
    try {
      await api.deleteConfig(configId);
      const updated = await api.listConfigs(sid!);
      setConfigs(updated);
      toast.success('Config deleted');
    } catch { toast.error('Failed to delete config'); }
  };

  const duplicateConfig = async (configId: string, configName: string) => {
    try {
      const configs = await api.listConfigs(sid!);
      const orig = configs.find((c: any) => c.id === configId);
      if (!orig) { toast.error('Config not found'); return; }
      await api.createConfig(sid!, {
        name: `${configName} (copy)`,
        options: safeJson(orig.options),
      });
      const updated = await api.listConfigs(sid!);
      setConfigs(updated);
      toast.success('Config duplicated');
    } catch { toast.error('Failed to duplicate config'); }
  };

  function safeJson(val: any): any {
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
    return val ?? {};
  }

  const handleGitSync = async () => {
    testBuilderRef.current?.flushSync();
    await handleSave();
    try {
      const res = await fetch(`/api/v1/scripts/${sid}/git-push`, { method: 'POST' });
      const data = await res.json(); toast.success(data.message || 'Synced to Git');
    } catch { toast.error('Git sync failed'); }
  };

  if (!script && sid) return <div className="p-6 lg:p-8 max-w-7xl mx-auto text-gray-500 animate-fade-in">Loading...</div>;

  const handleSavePlan = async () => {
    if (!pid || !planName.trim() || !sid) return;
    try {
      const blocks = parseScriptToBlocks(content);
      await api.createPlan(pid, { name: planName.trim(), blocks: JSON.stringify(blocks) });
      toast.success('Test plan version saved');
      setShowSavePlan(false);
      setPlanName('');
    } catch { toast.error('Failed to save plan version'); }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="font-semibold text-lg bg-transparent border-none outline-none flex-1 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            placeholder="Plan name"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">v{script?.version ?? 1}</span>

          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => setMode('visual')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'visual' ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            ><Layout className="w-3.5 h-3.5" /> Visual</button>
            <button onClick={() => setMode('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'code' ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            ><Code className="w-3.5 h-3.5" /> Code</button>
          </div>

          {mode === 'visual' && (
            <Button onClick={() => setShowSavePlan(true)} variant="secondary" size="sm">
              <Layers className="w-4 h-4" /> Save Version
            </Button>
          )}

          <Button onClick={handleSave} disabled={saving} size="sm"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}</Button>
          <Button onClick={() => {
            const blob = new Blob([content], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'script'}.js`;
            a.click(); URL.revokeObjectURL(url);
            toast.success('Script downloaded');
          }} variant="secondary" size="sm"><Download className="w-4 h-4" />Export Plan</Button>
          <Button onClick={handleGitSync} variant="secondary" size="sm"><GitBranch className="w-4 h-4" />Sync to Git</Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {diffVersion ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-3 px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">Comparing: current vs v{diffVersion.version}</span>
                <span className="text-xs text-gray-400">({new Date(diffVersion.createdAt).toLocaleString()})</span>
                <div className="flex-1" />
                <Button size="sm" variant="secondary" onClick={async () => { handleRestore(diffVersion.id); setDiffVersion(null); setDiffContent(null); }}>
                  <RotateCcw className="w-4 h-4" /> Restore
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setDiffVersion(null); setDiffContent(null); }}>
                  <X className="w-4 h-4" />Close Diff
                </Button>
              </div>
              <div className="flex-1">
                <DiffEditor
                  height="100%"
                  language="javascript"
                  theme="vs-dark"
                  original={diffContent ?? undefined}
                  modified={content}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    renderSideBySide: true,
                  }}
                />
              </div>
            </div>
          ) : mode === 'visual' ? (
            <TestBuilder
              ref={testBuilderRef}
              code={content}
              onCodeChange={setContent}
              scriptId={sid}
            />
          ) : (
            <Editor height="100%" defaultLanguage="javascript" theme="vs-dark" value={content}
              onChange={(val) => setContent(val ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false }}
            />
          )}
        </div>
      </div>

      <aside className="w-80 border-l dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-auto flex flex-col gap-5 shrink-0">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-brand-500" />Configurations
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium font-mono">
              {configs.length}
            </span>
          </div>
          {configs.length === 0 ? (
            <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No configurations yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {configs.map((c) => (
                <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate flex-1" title={c.name}>{c.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => duplicateConfig(c.id, c.name)} className="text-gray-400 hover:text-brand-500 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="Duplicate config">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteConfig(c.id, c.name)} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40" title="Delete config">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700/70">
                    <Button size="sm" variant="primary" className="w-full justify-center text-xs py-1.5 px-1.5 font-medium flex items-center" onClick={() => triggerRun(c.id)}>
                      <Play className="w-3 h-3 mr-1 shrink-0 fill-current" />Run
                    </Button>
                    <Button size="sm" variant="secondary" className="w-full justify-center text-xs py-1.5 px-1.5 font-medium flex items-center" onClick={() => distributeRun(c.id)} title="Distribute run across workers">
                      <Server className="w-3 h-3 mr-1 shrink-0" />Dist
                    </Button>
                    <Button size="sm" variant="ghost" className="w-full justify-center text-xs py-1.5 px-1.5 font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center" onClick={() => navigate(`/projects/${pid}/plans/${sid}/configs/${c.id}`)}>
                      <Settings className="w-3 h-3 mr-1 shrink-0" />Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" className="mt-3 w-full justify-center border border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-500 hover:text-brand-600 dark:hover:border-brand-400 dark:hover:text-brand-400 transition-all font-medium py-2 rounded-xl" onClick={() => navigate(`/projects/${pid}/plans/${sid}/configs/new`)}>
            <Plus className="w-4 h-4 mr-1.5" />New Configuration
          </Button>
        </div>

        <div>
          <button onClick={() => setShowVersions(!showVersions)}
            className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1.5"
          >
            <History className="w-4 h-4" />
            Version History ({versions.length})
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showVersions ? 'rotate-90' : ''}`} />
          </button>
          {showVersions && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {versions.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No saved versions</p>}
              {versions.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <span className="text-gray-600 dark:text-gray-400 truncate">v{v.version} — {new Date(v.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleDiff(v.id)} className="text-gray-500 hover:text-brand-600 flex items-center gap-0.5">
                        <Code className="w-3 h-3" />Diff
                      </button>
                      <button onClick={() => setRestoreTarget(v.id)} className="text-brand-600 hover:underline flex items-center gap-0.5">
                        <RotateCcw className="w-3 h-3" />Restore
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>

          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-3 mt-4">
              <Tag className="w-4 h-4 text-brand-500" />Tags
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(tags).length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No tags</p>}
              {Object.entries(tags).filter(([,v]) => v).map(([k, v]) => (
                <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(k)}`}>
                  {k}{v ? `: ${v}` : ''}
                  <button
                    onClick={() => {
                      const next = { ...tags };
                      delete next[k];
                      setTags(next);
                    }}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={tagKey}
                onChange={(e) => setTagKey(e.target.value)}
                placeholder="key"
                className="flex-1 min-w-0 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-brand-500 outline-none placeholder-gray-400"
              />
              <input
                value={tagVal}
                onChange={(e) => setTagVal(e.target.value)}
                placeholder="val"
                className="w-16 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-brand-500 outline-none placeholder-gray-400"
              />
              <button
                onClick={() => {
                  if (!tagKey.trim()) return;
                  setTags({ ...tags, [tagKey.trim()]: tagVal.trim() });
                  setTagKey('');
                  setTagVal('');
                }}
                className="p-1 rounded-md bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
      </aside>

      <ConfirmDialog open={!!restoreTarget} title="Restore Version"
        message="Current version will be saved as a snapshot. Are you sure?" confirmLabel="Restore" variant="warning"
        onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)}
      />

      <Modal open={showSavePlan} onClose={() => setShowSavePlan(false)} title="Save as Test Plan">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Save the current visual test structure as a reusable test plan.</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Name</label>
            <input value={planName} onChange={(e) => setPlanName(e.target.value)}
              placeholder="My Load Test Plan"
              className="w-full px-3 py-2 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSavePlan(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSavePlan} disabled={!planName.trim()}>Save Plan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
