import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import StatCard from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import { Activity, Play, Filter, X, Search, Calendar, CheckCircle, XCircle, Clock, StickyNote, GitCompare, StopCircle, Download, Trash2, Layers } from 'lucide-react';
import { Button, Input, Select } from '../components/ui';

const STATUS_OPTIONS = ['all', 'pending', 'running', 'completed', 'failed', 'aborted'] as const;

export default function RunHistory() {
  useTitle('Test Runs');
  const { pid } = useParams();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scriptFilter, setScriptFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchRuns = useCallback(() => {
    const params: any = { projectId: pid };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (scriptFilter) params.scriptId = scriptFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return api.listRuns(params);
  }, [pid, statusFilter, scriptFilter, dateFrom, dateTo]);

  useEffect(() => {
    api.listScripts(pid!).then(setScripts).catch(() => {});
  }, [pid]);

  useEffect(() => {
    setLoading(true);
    fetchRuns()
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fetchRuns]);

  useEffect(() => {
    const hasActive = runs.some((r) => r.status === 'running' || r.status === 'pending');
    setAutoRefresh(hasActive);
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchRuns().then(setRuns).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  const stats = useMemo(() => {
    const total = runs.length;
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const running = runs.filter((r) => r.status === 'running' || r.status === 'pending').length;
    return { total, completed, failed, running, passRate: total > 0 ? (completed / total) * 100 : 0 };
  }, [runs]);

  const clearFilters = () => {
    setStatusFilter('all');
    setScriptFilter('');
    setDateFrom('');
    setDateTo('');
  };

    const hasFilters = statusFilter !== 'all' || scriptFilter || dateFrom || dateTo;

  const handleBatchAbort = async () => {
    const toAbort = Array.from(selectedRuns).filter((id) => {
      const run = runs.find((r) => r.id === id);
      return run && (run.status === 'running' || run.status === 'pending');
    });
    if (toAbort.length === 0) return;
    if (!confirm(`Abort ${toAbort.length} run${toAbort.length > 1 ? 's' : ''}?`)) return;
    for (const id of toAbort) {
      try { await api.abortRun(id); } catch { /* ignore */ }
    }
    setRuns((prev) => prev.map((r) => toAbort.includes(r.id) ? { ...r, status: 'aborted', finishedAt: new Date().toISOString() } : r));
    setSelectedRuns(new Set());
    setCompareMode(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Test Runs"
        subtitle={runs.length > 0 ? `${runs.length} run${runs.length !== 1 ? 's' : ''}` : undefined}
        actions={
          <div className="flex gap-2 items-center">
            {autoRefresh && (
              <span className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                Live
              </span>
            )}
            {compareMode && selectedRuns.size > 0 && (
              <>
                {selectedRuns.size === 2 && (
                  <Button size="sm" onClick={() => {
                    const [a, b] = Array.from(selectedRuns);
                    navigate(`/projects/${pid}/runs/${a}/compare?runB=${b}`);
                  }}>
                    <GitCompare className="w-4 h-4" /> Compare Selected
                  </Button>
                )}
                {Array.from(selectedRuns).some((id) => {
                  const r = runs.find((x) => x.id === id);
                  return r && (r.status === 'running' || r.status === 'pending');
                }) && (
                  <Button size="sm" variant="secondary" onClick={handleBatchAbort}>
                    <StopCircle className="w-4 h-4" /> Abort Selected
                  </Button>
                )}
                {Array.from(selectedRuns).some((id) => {
                  const r = runs.find((x) => x.id === id);
                  return r && (r.status === 'completed' || r.status === 'failed' || r.status === 'aborted');
                }) && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const toDelete = Array.from(selectedRuns);
                    if (!confirm(`Delete ${toDelete.length} run${toDelete.length > 1 ? 's' : ''}?`)) return;
                    for (const id of toDelete) { try { await api.deleteRun(id); } catch { /* ignore */ } }
                    setRuns((prev) => prev.filter((r) => !toDelete.includes(r.id)));
                    setSelectedRuns(new Set());
                    setCompareMode(false);
                  }}>
                    <Trash2 className="w-4 h-4" /> Delete Selected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setCompareMode(false); setSelectedRuns(new Set()); }}>
                  <X className="w-4 h-4" /> Cancel
                </Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={() => setCompareMode(!compareMode)}>
              <GitCompare className="w-4 h-4" /> {compareMode ? 'Exit Compare' : 'Compare'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => {
              const json = JSON.stringify(runs, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `runs-${new Date().toISOString().slice(0, 10)}.json`;
              a.click(); URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/projects/${pid}/plans`)}>
              <Play className="w-4 h-4" /> New Run
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total" value={stats.total} icon={<Activity className="w-5 h-5" />} />
        <StatCard title="Passed" value={stats.completed} variant="success" icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="Failed" value={stats.failed} variant={stats.failed > 0 ? 'danger' : 'default'} icon={<XCircle className="w-5 h-5" />} />
        <StatCard
          title="Pass Rate"
          value={stats.total > 0 ? `${stats.passRate.toFixed(1)}%` : '—'}
          variant={stats.passRate > 80 ? 'success' : stats.passRate > 50 ? 'warning' : 'danger'}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4 w-fit">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              statusFilter === s
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showFilters || hasFilters
              ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasFilters && <span className="ml-1 w-2 h-2 rounded-full bg-brand-500" />}
        </button>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <X className="w-3 h-3" />Clear
          </button>
        )}

        <div className="flex-1" />

        {scripts.length > 0 && (
          <Select
            value={scriptFilter}
            onChange={(v) => setScriptFilter(v)}
            placeholder="All plans"
            options={[
              { label: 'All plans', value: '' },
              ...scripts.map((s: any) => ({ label: s.name, value: s.id })),
            ]}
          />
        )}

        {showFilters && (
          <>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-2 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-2 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </>
        )}
      </div>

      {loading ? (
        <Card padding="lg">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      ) : runs.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {hasFilters ? 'No runs match your filters' : 'No test runs yet'}
            </p>
            {!hasFilters && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a plan and trigger your first run.</p>}
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <DataTable
            columns={[
              ...(compareMode ? [{ key: 'select' as string, label: '', render: (r: any) => (
                <input
                  type="checkbox"
                  checked={selectedRuns.has(r.id)}
                  onChange={() => {
                    const next = new Set(selectedRuns);
                    if (next.has(r.id)) next.delete(r.id);
                    else { if (next.size >= 2) return; next.add(r.id); }
                    setSelectedRuns(next);
                  }}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  onClick={(e) => e.stopPropagation()}
                />
              ), className: 'w-8' }] : []),
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'suite', label: 'Suite', render: (r) => r.suiteRunId ? (
                <span
                  onClick={(e) => { e.stopPropagation(); navigate(`/projects/${pid}/suite-runs/${r.suiteRunId}`); }}
                  className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  <Layers className="w-3 h-3" />
                  Suite
                </span>
              ) : '—', className: 'text-gray-500' },
              { key: 'script', label: 'Plan', render: (r) => r.script?.name ?? '—', className: 'font-medium' },
              { key: 'config', label: 'Config', render: (r) => r.config?.name ?? '—' },
              { key: 'triggerType', label: 'Trigger' },
              { key: 'notes', label: '', render: (r) => r.notes ? <StickyNote className="w-3.5 h-3.5 text-gray-400" /> : null, className: 'w-6' },
              { key: 'startedAt', label: 'Started', render: (r) => r.startedAt ? new Date(r.startedAt).toLocaleDateString() : '—', className: 'text-gray-500' },
              { key: 'duration', label: 'Duration', render: (r) => {
                if (!r.finishedAt || !r.startedAt) return '—';
                const s = (new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000;
                return `${s.toFixed(1)}s`;
              }, className: 'text-gray-500', sortable: false },
            ]}
            data={runs}
            keyExtractor={(r) => r.id}
            onRowClick={(r) => compareMode ? null : navigate(`/projects/${pid}/runs/${r.id}`)}
            searchable
            searchPlaceholder="Search runs by status, plan, or trigger..."
          />
        </Card>
      )}
    </div>
  );
}
