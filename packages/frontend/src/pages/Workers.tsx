import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { Server, Plus, Trash2, Activity, Wifi, WifiOff, Cpu, Layers, Play, Square } from 'lucide-react';

export default function Workers() {
  useTitle('Workers');
  const { pid } = useParams();
  const toast = useToastStore();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [launchType, setLaunchType] = useState<'local' | 'kubernetes'>('local');
  const [namespace, setNamespace] = useState('default');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listWorkers(pid!);
      setWorkers(data.map((w: any) => ({
        ...w,
        assignmentCount: w._count?.assignments ?? 0,
      })));
    } catch { toast.error('Failed to load workers'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pid]);

  const handleAdd = async () => {
    if (!name || !url) return;
    try {
      const data: any = { name, url, capacity, launchType };
      if (launchType === 'kubernetes') data.namespace = namespace;
      await api.createWorker(pid!, data);
      toast.success(launchType === 'kubernetes' ? 'Worker added. Click Start to deploy as a K8s pod.' : 'Worker added. Install the worker agent on the target machine to activate.');
      setName(''); setUrl(''); setCapacity(100); setLaunchType('local'); setNamespace('default'); setShowForm(false);
      load();
    } catch { toast.error('Failed to add worker'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this worker?')) return;
    try { await api.deleteWorker(id); toast.success('Worker removed'); load(); }
    catch { toast.error('Failed to remove worker'); }
  };

  const handleCopySetup = (name: string, port: string) => {
    const cmd = `AGENT_NAME=${name} CENTRAL_API_URL=http://your-backend:3001 npx tsx packages/worker-agent/src/index.ts`;
    navigator.clipboard.writeText(cmd);
    toast.success('Start command copied');
  };

  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  const handleStart = async (id: string) => {
    setStarting(id);
    try {
      const token = localStorage.getItem('token') || JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token;
      const res = await fetch(`/api/v1/workers/${id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      const data = await res.json();
      toast.success(data.message);
      load();
    } catch (err: any) { toast.error('Failed to start worker', err.message); }
    setStarting(null);
  };

  const handleStop = async (id: string) => {
    setStopping(id);
    try {
      const token = localStorage.getItem('token') || JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token;
      const res = await fetch(`/api/v1/workers/${id}/stop`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast.success('Worker agent stopped');
      load();
    } catch (err: any) { toast.error('Failed to stop worker', err.message); }
    setStopping(null);
  };

  const online = workers.filter((w) => w.status === 'online').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Workers"
        subtitle={`${online}/${workers.length} online`}
        actions={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> Add Worker
          </Button>
        }
      />

      {showForm && (
        <Card padding="md" className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Worker-1"
                className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://10.0.0.1:6566"
                className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 w-64 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Capacity (VUs)</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} min={1}
                className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 w-24 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Launch Type</label>
              <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden">
                <button type="button" onClick={() => setLaunchType('local')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${launchType === 'local' ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                  Local
                </button>
                <button type="button" onClick={() => setLaunchType('kubernetes')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${launchType === 'kubernetes' ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                  Kubernetes
                </button>
              </div>
            </div>
            {launchType === 'kubernetes' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Namespace</label>
                <input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="default"
                  className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 w-28 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            )}
            <Button type="submit">Add</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} padding="md"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
      ) : workers.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Server className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No workers configured</p>
            <p className="text-xs text-gray-400 mt-1">Add worker nodes for distributed test execution.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {workers.map((w) => (
            <Card key={w.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    w.status === 'online' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Server className={`w-4 h-4 ${w.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{w.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{w.url}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    w.status === 'online'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {w.status === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {w.status}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Cpu className="w-3 h-3" /> {w.capacity} VUs
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Layers className="w-3 h-3" /> {w.assignmentCount} runs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {w.status === 'offline' ? (
                    <>
                      <button onClick={() => handleStart(w.id)} disabled={starting === w.id}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors px-2 py-1 disabled:opacity-50">
                        <Play className="w-3 h-3" /> {starting === w.id ? 'Starting...' : 'Start'}
                      </button>
                      <button onClick={() => handleCopySetup(w.name, '6566')}
                        className="text-xs text-brand-500 hover:text-brand-600 transition-colors px-2 py-1">
                        Copy Setup
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleStop(w.id)} disabled={stopping === w.id}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors px-2 py-1 disabled:opacity-50">
                      <Square className="w-3 h-3" /> {stopping === w.id ? 'Stopping...' : 'Stop'}
                    </button>
                  )}
                  {w.lastHeartbeat && (
                    <span className="text-[10px] text-gray-400">
                      Last: {new Date(w.lastHeartbeat).toLocaleTimeString()}
                    </span>
                  )}
                  <button onClick={() => handleDelete(w.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
