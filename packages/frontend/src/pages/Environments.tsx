import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { Globe, Plus, Trash2, Star, Pencil, X } from 'lucide-react';

export default function Environments() {
  useTitle('Environments');
  const { pid } = useParams();
  const toast = useToastStore();

  const [envs, setEnvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [vars, setVars] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);

  const load = async () => {
    setLoading(true);
    try { setEnvs(await api.listEnvironments(pid!)); } catch { toast.error('Failed to load environments'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pid]);

  const openForm = (env?: any) => {
    if (env) {
      setEditId(env.id);
      setName(env.name);
      setBaseUrl(env.baseUrl || '');
      const entries = Object.entries(env.variables || {}).map(([k, v]) => ({ key: k, value: String(v) }));
      setVars(entries.length > 0 ? entries : [{ key: '', value: '' }]);
    } else {
      setEditId(null);
      setName('');
      setBaseUrl('');
      setVars([{ key: '', value: '' }]);
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name) return;
    const variables: Record<string, string> = {};
    vars.forEach((v) => { if (v.key) variables[v.key] = v.value; });
    try {
      if (editId) { await api.updateEnvironment(editId, { name, baseUrl, variables }); toast.success('Environment updated'); }
      else { await api.createEnvironment(pid!, { name, baseUrl, variables }); toast.success('Environment created'); }
      setShowForm(false); load();
    } catch { toast.error('Failed to save environment'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this environment?')) return;
    try { await api.deleteEnvironment(id); toast.success('Environment deleted'); load(); }
    catch { toast.error('Failed to delete environment'); }
  };

  const handleSetDefault = async (id: string) => {
    try { await api.setDefaultEnvironment(id); toast.success('Default updated'); load(); }
    catch { toast.error('Failed to set default'); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Environments"
        subtitle={`${envs.length} environment${envs.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => openForm()}><Plus className="w-4 h-4" /> Add Environment</Button>
        }
      />

      {showForm && (
        <Card padding="md" className="mb-6">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production"
                  className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com"
                  className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Variables</label>
              <div className="space-y-1.5">
                {vars.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={v.key} onChange={(e) => { const n = [...vars]; n[i].key = e.target.value; setVars(n); }}
                      placeholder="KEY" className="flex-1 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono px-2 py-1.5 focus:ring-2 focus:ring-brand-500 outline-none" />
                    <input value={v.value} onChange={(e) => { const n = [...vars]; n[i].value = e.target.value; setVars(n); }}
                      placeholder="value" className="flex-[2] rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono px-2 py-1.5 focus:ring-2 focus:ring-brand-500 outline-none" />
                    <button onClick={() => setVars(vars.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 p-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setVars([...vars, { key: '', value: '' }])} className="text-xs text-brand-600 hover:text-brand-700">+ Add variable</button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>{editId ? 'Update' : 'Create'} Environment</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} padding="md"><div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
      ) : envs.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Globe className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No environments configured</p>
            <p className="text-xs text-gray-400 mt-1">Manage API base URLs and variables for different deployment targets.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {envs.map((e) => (
            <Card key={e.id} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center">
                    <Globe className={`w-4 h-4 ${e.isDefault ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{e.name}</h3>
                      {e.isDefault && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"><Star className="w-2.5 h-2.5" /> Default</span>}
                    </div>
                    {e.baseUrl && <p className="text-xs text-gray-400 font-mono">{e.baseUrl}</p>}
                    {e.variables && Object.keys(e.variables).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(e.variables).map(([k, v]) => (
                          <span key={k} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono">{k}={String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!e.isDefault && (
                    <button onClick={() => handleSetDefault(e.id)} className="text-gray-400 hover:text-amber-500 p-1.5" title="Set as default">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => openForm(e)} className="text-gray-400 hover:text-brand-500 p-1.5" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!e.isDefault && (
                    <button onClick={() => handleDelete(e.id)} className="text-gray-400 hover:text-red-500 p-1.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
