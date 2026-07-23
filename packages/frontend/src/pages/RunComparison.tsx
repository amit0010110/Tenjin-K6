import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Select } from '../components/ui';
import { GitCompare, TrendingUp, TrendingDown, Minus, Download, MessageSquare } from 'lucide-react';

interface MetricDiff {
  name: string;
  runA: { value: number; p95: number; p99: number; count: number };
  runB: { value: number; p95: number; p99: number; count: number };
  changePercent: string | null;
}

export default function RunComparison() {
  useTitle('Run Comparison');
  const { pid, rid } = useParams();
  const [searchParams] = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const toast = useToastStore();
  const [runIdB, setRunIdB] = useState(searchParams.get('runB') || '');
  const [diff, setDiff] = useState<MetricDiff[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/runs?projectId=${pid}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.runs || [];
        setRuns(list.filter((r: any) => r.id !== rid));
      })
      .catch(() => { setError('Failed to load runs'); })
      .finally(() => setLoadingRuns(false));
  }, [pid, rid, token]);

  // Auto-compare when runB is pre-selected via query param
  useEffect(() => {
    if (runIdB && !loadingRuns && diff.length === 0) {
      (async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/v1/runs/compare', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ runIds: [rid, runIdB] }),
          });
          const data = await res.json();
          if (res.ok) setDiff(data.diff || []);
          setError(null);
        } catch { setError('Failed to compare runs'); }
        setLoading(false);
      })();
    }
  }, [runIdB, loadingRuns]);

  const handleCompare = async () => {
    if (!runIdB) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/runs/compare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ runIds: [rid, runIdB] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Compare failed'); return; }
      setDiff(data.diff || []);
      setError(null);
    } catch { setError('Failed to compare runs'); } finally { setLoading(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Run Comparison" subtitle="Compare performance metrics between two test runs"
        breadcrumbs={[{ label: 'Run Detail', to: `/projects/${pid}/runs/${rid}` }, { label: 'Comparison' }]}
      />

      {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}

      <Card padding="md">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compare with</label>
            <Select value={runIdB} onChange={(v) => setRunIdB(v)}
              placeholder="Select a run..."
              options={[
                { label: 'Select a run...', value: '' },
                ...runs.map((r: any) => ({ label: `${r.script?.name || r.id} (${new Date(r.createdAt).toLocaleDateString()})`, value: r.id })),
              ]}
            />
          </div>
          <Button onClick={handleCompare} disabled={loading || !runIdB}><GitCompare className="w-4 h-4" />{loading ? 'Comparing...' : 'Compare'}</Button>
          {diff.length > 0 && (
            <Button variant="secondary" onClick={() => {
              const blob = new Blob([JSON.stringify({ runA: rid, runB: runIdB, diff }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `compare-${rid!.slice(0,8)}-vs-${runIdB.slice(0,8)}.json`;
              a.click();
            }}>
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
        </div>
      </Card>

      {diff.length > 0 && (
        <>
          <Card padding="md" className="relative">
            <div className="absolute top-4 right-4 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => {
                const lines = diff.map((m) => {
                  const arrow = m.changePercent && Number(m.changePercent) > 0 ? '🔴' : m.changePercent && Number(m.changePercent) < 0 ? '🟢' : '⚪';
                  return `| ${m.name} | ${m.runA.value.toFixed(2)} | ${m.runB.value.toFixed(2)} | ${arrow} ${m.changePercent || '—'}% |`;
                });
                const md = `## Performance Comparison\n\n| Metric | Run A | Run B | Change |\n| --- | --- | --- | --- |\n${lines.join('\n')}\n\n_Generated by TenjinT6_`;
                navigator.clipboard.writeText(md);
                toast.success('PR comment copied to clipboard');
              }}>
                <MessageSquare className="w-3.5 h-3.5" /> Copy PR Comment
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700 text-left">
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Metric</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Run A (avg)</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Run B (avg)</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Change</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((m) => (
                  <tr key={m.name} className="border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{m.name}</td>
                    <td className="px-3 py-2">{m.runA.value.toFixed(2)}</td>
                    <td className="px-3 py-2">{m.runB.value.toFixed(2)}</td>
                    <td className={`px-3 py-2 flex items-center gap-1 ${m.changePercent && Number(m.changePercent) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {m.changePercent && Number(m.changePercent) > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : m.changePercent && Number(m.changePercent) < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                      {m.changePercent !== null ? `${m.changePercent}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card padding="md">
            <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Metric Comparison Chart</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={diff.filter((m) => m.runA.value || m.runB.value).slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="runA.value" name="Run A" fill="#6366f1" />
                <Bar dataKey="runB.value" name="Run B" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
