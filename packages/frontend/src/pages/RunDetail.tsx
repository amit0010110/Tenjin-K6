import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, AreaChart, Area, PieChart, Pie } from 'recharts';
import { useToastStore } from '../stores/toastStore';
import ResultsTreePanel from '../components/ResultsTreePanel';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import DataTable from '../components/DataTable';
import { Button } from '../components/ui';
import { StopCircle, GitCompare, Eye, Download, Cloud, RefreshCw, CheckCircle, XCircle, StickyNote, RotateCcw, Copy, Activity, Clock, ShieldCheck, Database, Users, Layers, Zap, Server } from 'lucide-react';

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

export default function RunDetail() {
  useTitle('Run Details');
  const { pid, rid } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloudRunId, setCloudRunId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [autoRefreshing, setAutoRefreshing] = useState(false);

  const loadRun = useCallback(async () => {
    try {
      const [runData, results, thresholds, assignments] = await Promise.all([
        api.getRun(rid!),
        api.getRunResults(rid!),
        api.getRunThresholds(rid!),
        api.getAssignments(rid!).catch(() => []),
      ]);
      setRun({ ...runData, results, thresholds, assignments });
      setNotes((prev) => prev || runData.notes || '');
      if (runData.cloudRunId) setCloudRunId(runData.cloudRunId);
    } catch (err: any) {
      setError(err.message);
    }
  }, [rid]);

  useEffect(() => {
    setLoading(true);
    loadRun().finally(() => setLoading(false));
  }, [loadRun]);

  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'pending' && run.status !== 'distributing')) {
      setAutoRefreshing(false);
      return;
    }
    setAutoRefreshing(true);
    const interval = setInterval(() => { loadRun().catch(() => {}); }, 5000);
    return () => clearInterval(interval);
  }, [run?.status, loadRun]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updateRunNotes(rid!, notes);
      useToastStore.getState().success('Notes saved');
    } catch {
      useToastStore.getState().error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleReRun = async () => {
    if (!run?.testConfigId) { useToastStore.getState().error('No config associated with this run'); return; }
    try {
      const newRun = await api.triggerRun(run.testConfigId);
      navigate(`/projects/${pid}/runs/${newRun.id}/live`);
    } catch {
      useToastStore.getState().error('Failed to re-run');
    }
  };

  const handleCloudSync = async () => {
    if (!cloudRunId.trim()) return;
    setSyncing(true);
    try {
      const result = await api.syncCloudRun(rid!, { cloudRunId: cloudRunId.trim() });
      setRun((prev: any) => ({ ...prev, ...result }));
      const results = await api.getRunResults(rid!);
      setRun((prev: any) => ({ ...prev, results }));
    } catch (e: any) {
      useToastStore.getState().error('Cloud sync failed', e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <PageHeader title="Run Details" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!run) return <div className="p-8 text-gray-500">Run not found</div>;

  const duration = run.finishedAt && run.startedAt
    ? ((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)
    : null;

  const httpDuration = run.results?.find((r: any) => r.metricName === 'http_req_duration');
  const percentiles = ['avg', 'min', 'max', 'med', 'p90', 'p95', 'p99']
    .filter((k) => httpDuration?.[k] != null)
    .map((k) => ({ name: k.toUpperCase(), value: Math.round((httpDuration[k] + Number.EPSILON) * 100) / 100 }));

  const timingMetricsMap = {
    http_req_waiting: 'Waiting (TTFB)',
    http_req_connecting: 'Connecting',
    http_req_tls_handshaking: 'TLS Handshake',
    http_req_sending: 'Sending',
    http_req_receiving: 'Receiving',
  };
  const networkTimings = Object.entries(timingMetricsMap)
    .map(([key, label]) => {
      const found = run.results?.find((r: any) => r.metricName === key);
      return found && found.avg != null ? { name: label, avg: Math.round(found.avg * 100) / 100, p95: Math.round((found.p95 || found.avg) * 100) / 100 } : null;
    })
    .filter((x): x is { name: string; avg: number; p95: number } => x !== null);

  const volumeMetricsMap = {
    http_reqs: 'HTTP Requests',
    iterations: 'Iterations',
    http_req_failed: 'Failed Reqs',
    checks: 'Checks Executed',
  };
  const volumeStats = Object.entries(volumeMetricsMap)
    .map(([key, label]) => {
      const found = run.results?.find((r: any) => r.metricName === key);
      return found && found.count != null ? { name: label, count: found.count } : null;
    })
    .filter((x): x is { name: string; count: number } => x !== null);

  const dataTransfer = [
    { name: 'Data Sent', kb: Math.round(((run.results?.find((r: any) => r.metricName === 'data_sent')?.count || 0) / 1024) * 100) / 100 },
    { name: 'Data Received', kb: Math.round(((run.results?.find((r: any) => r.metricName === 'data_received')?.count || 0) / 1024) * 100) / 100 },
  ].filter(d => d.kb > 0);

  const coreMetricNames = [
    'http_req_duration', 'http_reqs', 'http_req_failed', 'http_req_waiting', 'http_req_connecting',
    'http_req_tls_handshaking', 'http_req_sending', 'http_req_receiving', 'iterations', 'checks',
    'data_sent', 'data_received', 'vus', 'vus_max', 'http_req_blocked'
  ];
  const customMetrics = (run.results || [])
    .filter((r: any) => !coreMetricNames.includes(r.metricName) && r.avg != null)
    .map((r: any) => ({ name: r.metricName, avg: Math.round(r.avg * 100) / 100, p95: Math.round((r.p95 || r.avg) * 100) / 100 }));

  const vuMetrics = [
    { name: 'Avg VUs', value: Math.round(run.results?.find((r: any) => r.metricName === 'vus')?.avg || 0) },
    { name: 'Max VUs', value: Math.round(run.results?.find((r: any) => r.metricName === 'vus_max')?.max || run.results?.find((r: any) => r.metricName === 'vus_max')?.avg || 0) },
  ].filter(v => v.value > 0);

  const checksObj = run.results?.find((r: any) => r.metricName === 'checks');
  const checkRate = checksObj?.rate ?? checksObj?.avg ?? null;
  const checkPassRate = checkRate != null ? Math.round(checkRate * 1000) / 10 : null;
  const checksData = checkPassRate != null ? [
    { name: 'Checks Passed', value: checkPassRate, color: '#10b981' },
    { name: 'Checks Failed', value: Math.round((100 - checkPassRate) * 10) / 10, color: '#ef4444' }
  ] : [];

  const lifecyclePhases = [
    { name: 'Blocked / Queue', avg: Math.round((run.results?.find((r: any) => r.metricName === 'http_req_blocked')?.avg || 0) * 100) / 100 },
    { name: 'Connecting', avg: Math.round((run.results?.find((r: any) => r.metricName === 'http_req_connecting')?.avg || 0) * 100) / 100 },
    { name: 'TLS Handshake', avg: Math.round((run.results?.find((r: any) => r.metricName === 'http_req_tls_handshaking')?.avg || 0) * 100) / 100 },
    { name: 'Server Processing (TTFB)', avg: Math.round((run.results?.find((r: any) => r.metricName === 'http_req_waiting')?.avg || 0) * 100) / 100 },
    { name: 'Receiving Response', avg: Math.round((run.results?.find((r: any) => r.metricName === 'http_req_receiving')?.avg || 0) * 100) / 100 },
  ].filter(p => p.avg > 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Run Details"
        subtitle={`ID: ${run.id}`}
        actions={
          <div className="flex gap-2 items-center">
            {autoRefreshing && (
              <span className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                Live
              </span>
            )}
            {run.status === 'running' && (
              <Button variant="danger" size="sm" onClick={async () => { await api.abortRun(rid!); setRun({ ...run, status: 'aborted' }); }}>
                <StopCircle className="w-4 h-4" /> Abort
              </Button>
            )}
            {run.testConfigId && (
              <Button variant="secondary" size="sm" onClick={handleReRun}>
                <RotateCcw className="w-4 h-4" /> Re-run
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${pid}/runs/${rid}/compare`)}>
              <GitCompare className="w-4 h-4" /> Compare
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${pid}/runs/${rid}/live`)}>
              <Eye className="w-4 h-4" /> Live
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(rid!); useToastStore.getState().success('Run ID copied'); }}>
              <Copy className="w-4 h-4" /> Copy ID
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`/api/v1/runs/${rid}/export/json`, '_blank')}>
              <Download className="w-4 h-4" /> JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`/api/v1/runs/${rid}/export/csv`, '_blank')}>
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`/api/v1/runs/${rid}/export/html`, '_blank')}>
              <Download className="w-4 h-4" /> Report
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`/api/v1/runs/${rid}/export/pdf`, '_blank')}>
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        }
      />

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Status" value={<StatusBadge status={run.status} />} />
        <StatCard title="Duration" value={duration ? `${duration}s` : '—'} />
        <StatCard title="k6 Exit Code" value={run.k6ExitCode ?? '—'} />
        <StatCard title="Trigger" value={run.triggerType ? run.triggerType.charAt(0).toUpperCase() + run.triggerType.slice(1) : '—'} />
      </div>

      {/* Distributed Load Execution Plan */}
      {run.assignments && run.assignments.length > 0 && (
        <Card padding="md" className="mb-6 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Distributed Load Execution Plan ({run.assignments.length} Workers)
              </h3>
            </div>
            <span className="text-xs font-mono bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-full font-medium">
              Segmented k6 Execution
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="pb-2 font-semibold">Worker Node</th>
                  <th className="pb-2 font-semibold">Endpoint URL</th>
                  <th className="pb-2 font-semibold">Assigned VUs</th>
                  <th className="pb-2 font-semibold">Load Share</th>
                  <th className="pb-2 font-semibold">Execution Segment</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {run.assignments.map((a: any, i: number) => (
                  <tr key={a.id || i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="py-2.5 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {a.worker?.name || a.workerId}
                    </td>
                    <td className="py-2.5 font-mono text-gray-600 dark:text-gray-400">{a.worker?.url || '—'}</td>
                    <td className="py-2.5 font-mono font-semibold text-gray-900 dark:text-gray-100">{a.vus} VUs</td>
                    <td className="py-2.5 font-mono text-brand-600 dark:text-brand-400 font-medium">{a.loadPercentage ?? Math.round((1/run.assignments.length)*100)}%</td>
                    <td className="py-2.5">
                      <code className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                        --execution-segment={a.executionSegment || `${(i/run.assignments.length).toFixed(4)}:${((i+1)/run.assignments.length).toFixed(4)}`}
                      </code>
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Notes */}
      <Card padding="md" className="mb-6">
        <div className="flex items-start gap-3">
          <StickyNote className="w-5 h-5 text-gray-400 mt-1 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Notes</h3>
              <Button size="sm" variant="ghost" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this test run..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none placeholder-gray-400 resize-none"
              rows={3}
            />
          </div>
        </div>
      </Card>

      {/* Cloud Sync */}
      <Card padding="md" className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-semibold text-sm">k6 Cloud</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {run.cloudRunUrl ? (
                  <a href={run.cloudRunUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                    View on k6 Cloud
                  </a>
                ) : (
                  'Sync results from k6 Cloud'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cloudRunId}
              onChange={(e) => setCloudRunId(e.target.value)}
              placeholder="Cloud Run ID"
              className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 w-32 focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <Button size="sm" onClick={handleCloudSync} disabled={syncing || !cloudRunId.trim()}>
              {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing...' : 'Fetch'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Multi-Chart Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Chart 1: Duration Percentiles */}
        {percentiles.length > 0 && (
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-sm">Response Duration Percentiles (ms)</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={percentiles} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [`${val} ms`, 'Duration']}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {percentiles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'P95' || entry.name === 'P99' || entry.name === 'MAX' ? '#f43f5e' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Chart 2: Network Timings Breakdown */}
        {networkTimings.length > 0 && (
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-sm">Network Timings Breakdown (ms)</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={networkTimings} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number, name: string) => [`${val} ms`, name.toUpperCase()]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="avg" name="Average" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p95" name="p95" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Chart 3: Throughput & Execution Volume */}
        {volumeStats.length > 0 && (
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Throughput & Execution Volume</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={volumeStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [val.toLocaleString(), 'Count']}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {volumeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Failed Reqs' ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Chart 4: Data Bandwidth */}
        {dataTransfer.length > 0 && (
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm">Network Bandwidth Transferred (KB)</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dataTransfer} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [`${val.toLocaleString()} KB`, 'Volume']}
                />
                <Bar dataKey="kb" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Chart 5: Virtual Users Concurrency */}
        {vuMetrics.length > 0 && (
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-cyan-500" />
              <h3 className="font-semibold text-sm">Virtual Users (VUs) Concurrency Profile</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={vuMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [`${val} VUs`, 'Concurrency']}
                />
                <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Chart 6: Checks Pass vs Fail Ratio */}
        {checksData.length > 0 && (
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-sm">Checks Pass vs Fail Ratio (%)</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={checksData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name.split(' ')[1]}: ${value}%`}>
                  {checksData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [`${val}%`, 'Rate']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Chart 7: HTTP Request Lifecycle Phases Breakdown */}
      {lifecyclePhases.length > 0 && (
        <Card padding="lg" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-orange-500" />
            <h3 className="font-semibold text-sm">HTTP Request Lifecycle Phases Breakdown (ms)</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={lifecyclePhases} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                formatter={(val: number) => [`${val} ms`, 'Phase Avg Duration']}
              />
              <Bar dataKey="avg" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Chart 8: Custom Protocols & Extensions Performance */}
      {customMetrics.length > 0 && (
        <Card padding="lg" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-purple-500" />
            <h3 className="font-semibold text-sm">Protocol & Custom Extensions Performance (ms)</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={customMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                formatter={(val: number, name: string) => [`${val} ms`, name.toUpperCase()]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="avg" name="Average (ms)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="p95" name="P95 (ms)" fill="#7e22ce" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Metrics table */}
      {run.results?.length > 0 && (
        <Card padding="none" className="mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-base font-semibold">All Metrics</h3>
          </div>
          <DataTable
            columns={[
              { key: 'metricName', label: 'Metric', render: (r: any) => <code className="font-mono text-xs">{r.metricName}</code>, className: 'font-medium' },
              { key: 'avg', label: 'Avg', render: (r: any) => r.avg?.toFixed(2), className: 'text-right font-mono text-xs', sortable: false },
              { key: 'min', label: 'Min', render: (r: any) => r.min?.toFixed(2), className: 'text-right font-mono text-xs', sortable: false },
              { key: 'max', label: 'Max', render: (r: any) => r.max?.toFixed(2), className: 'text-right font-mono text-xs', sortable: false },
              { key: 'p90', label: 'p90', render: (r: any) => r.p90?.toFixed(2), className: 'text-right font-mono text-xs', sortable: false },
              { key: 'p95', label: 'p95', render: (r: any) => r.p95?.toFixed(2), className: 'text-right font-mono text-xs', sortable: false },
              { key: 'p99', label: 'p99', render: (r: any) => r.p99?.toFixed(2), className: 'text-right font-mono text-xs', sortable: false },
              { key: 'count', label: 'Count', render: (r: any) => r.count, className: 'text-right font-mono text-xs', sortable: false },
            ]}
            data={run.results}
            keyExtractor={(r: any) => r.id}
            searchable
            searchPlaceholder="Search metrics..."
          />
        </Card>
      )}

      {/* Thresholds */}
      {run.thresholds?.length > 0 && (
        <Card padding="lg" className="mb-6">
          <h3 className="font-semibold mb-4">Threshold Results</h3>
          <div className="space-y-2">
            {run.thresholds.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                {t.passed
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                }
                <span className="font-mono text-xs font-medium">{t.metricName}</span>
                <code className="text-xs bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border dark:border-gray-700">{t.thresholdExpr}</code>
                <span className="text-xs text-gray-400">
                  actual: {t.actualValue?.toFixed(2) ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {percentiles.length === 0 && run.thresholds?.length === 0 && (
        <Card padding="lg">
          <div className="text-center py-8">
            <p className="text-gray-400">No results data available for this run.</p>
          </div>
        </Card>
      )}

      {/* Results Tree */}
      <Card padding="none" className="mb-6">
        <ResultsTreePanel runId={rid!} />
      </Card>
    </div>
  );
}
