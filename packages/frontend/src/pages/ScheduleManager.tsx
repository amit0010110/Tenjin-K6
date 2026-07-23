import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Select } from '../components/ui';
import { useTitle } from '../hooks/useTitle';
import { Clock, Play, Pause, Trash2, Plus, RefreshCw, X, CheckCircle, XCircle, Ban, Loader } from 'lucide-react';

const PRESETS: Record<string, string> = {
  'Every 5 minutes': '*/5 * * * *',
  'Every 15 minutes': '*/15 * * * *',
  'Every 30 minutes': '*/30 * * * *',
  'Every hour': '0 * * * *',
  'Every 2 hours': '0 */2 * * *',
  'Every 6 hours': '0 */6 * * *',
  'Every day at midnight': '0 0 * * *',
  'Every day at 8 AM': '0 8 * * *',
  'Every Monday at 8 AM': '0 8 * * 1',
  'Every weekday at 9 AM': '0 9 * * 1-5',
  'First day of month at 2 AM': '0 2 1 * *',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [m, h, dom, mon, dow] = parts;

  if (dow === '*' && dom === '*' && mon === '*') {
    if (m.startsWith('*/')) return `Every ${m.slice(2)} minute(s)`;
    if (h.startsWith('*/')) return `Every ${h.slice(2)} hour(s)`;
    if (m === '0' && h === '0') return 'At midnight, daily';
    if (m === '0' && h !== '*') return `At ${parseInt(h) % 12 || 12}:00 ${parseInt(h) < 12 ? 'AM' : 'PM'}, daily`;
    if (m !== '*' && h === '*') return `At minute ${m} past every hour`;
    if (m === '0' && h === '*') return 'Every hour on the hour';
  }
  if (dow !== '*' && dom === '*' && mon === '*') {
    const days = dow.split(',').map(Number).sort().map(d => WEEKDAYS[d] || `day ${d}`).join(', ');
    if (m === '0' && h !== '*') return `At ${parseInt(h) % 12 || 12}:00 ${parseInt(h) < 12 ? 'AM' : 'PM'}, ${days}`;
    return `At minute ${m} past hour ${h}, ${days}`;
  }
  return expr;
}

function getNextRuns(cronExpr: string, count = 5): Date[] {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minuteStr, hourStr, domStr, monStr, dowStr] = parts;

  const now = new Date();
  const results: Date[] = [];
  const current = new Date(now);
  if (current.getSeconds() > 0) { current.setSeconds(0); current.setMinutes(current.getMinutes() + 1); }

  function matches(val: number, pattern: string): boolean {
    if (pattern === '*') return true;
    for (const seg of pattern.split(',')) {
      if (seg.includes('/')) {
        const [, step] = seg.split('/');
        if (val % parseInt(step) === 0) return true;
        continue;
      }
      if (seg.includes('-')) {
        const [lo, hi] = seg.split('-').map(Number);
        if (val >= lo && val <= hi) return true;
        continue;
      }
      if (val === parseInt(seg)) return true;
    }
    return false;
  }

  let attempts = 0;
  while (results.length < count && attempts < 5000) {
    attempts++;
    const y = current.getFullYear();
    const mo = current.getMonth() + 1;
    const d = current.getDate();
    const hh = current.getHours();
    const mm = current.getMinutes();
    const wd = current.getDay();

    if (matches(mo, monStr) && matches(d, domStr) && matches(wd, dowStr) && matches(hh, hourStr) && matches(mm, minuteStr)) {
      results.push(new Date(current));
      current.setMinutes(current.getMinutes() + 1);
      continue;
    }

    // Advance by 1 minute
    current.setMinutes(current.getMinutes() + 1);
  }

  return results;
}

function NextRunCountdown({ nextRunAt }: { nextRunAt: string }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    function tick() {
      const diff = new Date(nextRunAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('now'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [nextRunAt]);
  return <span>{remaining}</span>;
}

export default function ScheduleManager() {
  const { pid } = useParams();
  const token = useAuthStore((s) => s.token);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [configId, setConfigId] = useState('');
  const [cronExpr, setCronExpr] = useState('0 * * * *');
  const [preset, setPreset] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Visual cron builder
  const [minute, setMinute] = useState('0');
  const [hour, setHour] = useState('*');
  const [dayOfMonth, setDayOfMonth] = useState('*');
  const [month, setMonth] = useState('*');
  const [dayOfWeek, setDayOfWeek] = useState<string[]>([]);

  const buildCron = useCallback(() => {
    const dow = dayOfWeek.length > 0 ? dayOfWeek.join(',') : '*';
    setCronExpr(`${minute} ${hour} ${dayOfMonth} ${month} ${dow}`);
  }, [minute, hour, dayOfMonth, month, dayOfWeek]);

  useEffect(() => { buildCron(); }, [buildCron]);

  const loadSchedules = () => {
    fetch(`/api/v1/projects/${pid}/schedules`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setSchedules)
      .catch(() => setError('Failed to load schedules'));
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/v1/projects/${pid}/schedules`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setSchedules),
      fetch(`/api/v1/projects/${pid}/configs`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setConfigs),
    ]).catch(() => setError('Failed to load data')).finally(() => setLoading(false));
  }, [pid, token]);

  const handleApplyPreset = (p: string) => {
    setPreset(p);
    setCronExpr(PRESETS[p]);
    setDayOfWeek([]);
    setMinute('0');
    setHour('*');
    setDayOfMonth('*');
    setMonth('*');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/schedules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, configId, cronExpression: cronExpr, enabled }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setError(err.message || 'Failed to create schedule'); return; }
      setShowForm(false);
      setName('');
      setConfigId('');
      setEnabled(true);
      loadSchedules();
    } catch { setError('Failed to create schedule'); }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/v1/schedules/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !current }),
      });
      loadSchedules();
    } catch { setError('Failed to update schedule'); }
  };

  const handleDelete = async (id: string) => {
    try {
      const toast = useToastStore.getState();
      await fetch(`/api/v1/schedules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      loadSchedules();
      toast.success('Schedule deleted');
    } catch { setError('Failed to delete schedule'); }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      const res = await fetch(`/api/v1/schedules/${id}/run`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setError(err.message || 'Failed to trigger run'); }
    } catch { setError('Failed to trigger run'); }
    finally { setRunningId(null); }
  };

  const previewRuns = cronExpr ? getNextRuns(cronExpr, 5) : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Schedules"
        subtitle={`${schedules.length} schedule${schedules.length !== 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Schedule'}
          </Button>
        }
      />

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">{error}</div>}

      {showForm && (
        <Card padding="lg" className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
          <h2 className="font-semibold">Create Schedule</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Config</label>
            <Select value={configId} onChange={(v) => setConfigId(v)}
              placeholder="Select config..."
              options={configs.map((c: any) => ({ label: c.name, value: c.id }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Cron Expression</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {Object.keys(PRESETS).map((p) => (
                <button type="button" key={p} onClick={() => handleApplyPreset(p)} className={`px-2 py-1 text-xs rounded ${preset === p ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}>{p}</button>
              ))}
            </div>
            <div className="flex gap-2 items-center mb-2">
              <input type="text" value={cronExpr} onChange={(e) => { setCronExpr(e.target.value); setPreset(''); }} className="border rounded-lg px-3 py-2 text-sm font-mono flex-1" placeholder="*/5 * * * *" />
              <span className="text-xs text-gray-400">or build visually:</span>
            </div>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div>
                <label className="block font-medium mb-1">Minute</label>
                <input type="text" value={minute} onChange={(e) => setMinute(e.target.value || '*')} className="w-full border rounded px-2 py-1 font-mono" />
              </div>
              <div>
                <label className="block font-medium mb-1">Hour</label>
                <input type="text" value={hour} onChange={(e) => setHour(e.target.value || '*')} className="w-full border rounded px-2 py-1 font-mono" />
              </div>
              <div>
                <label className="block font-medium mb-1">Day (month)</label>
                <input type="text" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value || '*')} className="w-full border rounded px-2 py-1 font-mono" />
              </div>
              <div>
                <label className="block font-medium mb-1">Month</label>
                <input type="text" value={month} onChange={(e) => setMonth(e.target.value || '*')} className="w-full border rounded px-2 py-1 font-mono" />
              </div>
              <div>
                <label className="block font-medium mb-1">Day (week)</label>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((d, i) => (
                    <button type="button" key={d} onClick={() => setDayOfWeek((prev) => prev.includes(String(i)) ? prev.filter((x) => x !== String(i)) : [...prev, String(i)])} className={`w-7 h-7 rounded text-xs ${dayOfWeek.includes(String(i)) ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Cron: <code className="bg-gray-100 px-1 rounded font-mono">{cronExpr}</code>
              &nbsp;→ <span className="font-medium text-gray-600">{describeCron(cronExpr)}</span>
            </p>
            {previewRuns.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">Next 5 scheduled runs:</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewRuns.map((d, i) => (
                    <span key={i} className="text-[10px] bg-gray-50 border rounded px-1.5 py-0.5 font-mono">{d.toLocaleString()}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <label htmlFor="enabled" className="text-sm">Enabled on creation</label>
          </div>
          <Button type="submit" variant="primary">Create Schedule</Button>
        </form>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} padding="md"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500">No schedules yet</p>
            <p className="text-xs text-gray-400 mt-1">Schedule recurring test runs with cron expressions.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s: any) => {
            const upcoming = getNextRuns(s.cronExpr, 3);
            return (
              <Card key={s.id} padding="md" className={s.enabled ? '' : 'opacity-60'}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{s.name || 'Unnamed'}</h3>
                      <p className="text-xs text-gray-400">via {s.config?.name || 'unknown config'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {s.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => handleRunNow(s.id)} disabled={runningId === s.id}>
                      {runningId === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {runningId === s.id ? 'Running...' : 'Run Now'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(s.id, s.enabled)}>
                      {s.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {s.enabled ? 'Pause' : 'Resume'}
                    </Button>
                    <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span><span className="font-medium">Cron:</span> <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{s.cronExpr}</code></span>
                  <span className="hidden sm:inline text-gray-400">→ {describeCron(s.cronExpr)}</span>
                  {s.nextRunAt && <span><span className="font-medium">Next:</span> <NextRunCountdown nextRunAt={s.nextRunAt} /></span>}
                  {s.lastRun && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-medium">Last:</span>
                      {s.lastRun.status === 'completed' ? <CheckCircle className="w-3 h-3 text-emerald-500" />
                        : s.lastRun.status === 'failed' ? <XCircle className="w-3 h-3 text-red-500" />
                        : s.lastRun.status === 'aborted' ? <Ban className="w-3 h-3 text-gray-400" />
                        : <Loader className="w-3 h-3 text-amber-500 animate-spin" />}
                      <span className="text-gray-500">{new Date(s.lastRun.createdAt).toLocaleString()}</span>
                    </span>
                  )}
                </div>
                {upcoming.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {upcoming.map((d, i) => (
                      <span key={i} className="text-[10px] bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded px-1.5 py-0.5 font-mono">{d.toLocaleString()}</span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
