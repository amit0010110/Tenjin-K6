import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { Button } from '../components/ui';
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface RegressionMetric {
  name: string;
  baseline: { avg: number; p95: number; p99: number; count: number };
  current: { avg: number; p95: number; p99: number; count: number };
  changePercent: number | null;
  direction: 'improved' | 'regressed' | 'unchanged';
  severity: 'high' | 'medium' | 'none';
}

interface RegressionData {
  scriptId: string;
  scriptName: string;
  baseline: { runId: string; runLabel: string; metrics: any[] };
  current: { runId: string; runLabel: string; metrics: any[] };
  regression: RegressionMetric[];
  summary: { metricsCompared: number; regressions: number; improvements: number; totalRuns: number };
  message?: string;
}

export default function RegressionDetection() {
  useTitle('Regression Detection');
  const { pid, sid } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<RegressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (baselineRunId?: string) => {
    if (!sid) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.getRegressions(sid, baselineRunId);
      setData(d as RegressionData);
    } catch (err: any) {
      setError(err.message || 'Regression analysis failed');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [sid]);

  const directionIcon = (d: string) => {
    switch (d) {
      case 'regressed': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'improved': return <TrendingDown className="w-4 h-4 text-green-500" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'high': return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' };
      case 'medium': return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
      default: return { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600', dot: 'bg-gray-400' };
    }
  };

  const formatMetricName = (name: string) => name.replace(/^http_req_/, 'req ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Regression Detection"
        subtitle={data?.scriptName || `Script ${(sid || '').slice(0, 8)}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/plans`)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button size="sm" variant="secondary" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Computing regression analysis...</p>
        </div>
      )}

      {error && (
        <Card padding="md" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </Card>
      )}

      {!loading && data?.message && (
        <Card padding="md" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 mb-4">
          <p className="text-sm text-amber-700 dark:text-amber-300">{data.message}</p>
        </Card>
      )}

      {!loading && data && !data.message && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard title="Regressions" value={data.summary.regressions} icon={<AlertTriangle className="w-5 h-5" />} variant={data.summary.regressions > 0 ? 'danger' : 'success'} />
            <StatCard title="Improvements" value={data.summary.improvements} icon={<TrendingDown className="w-5 h-5" />} variant={data.summary.improvements > 0 ? 'success' : 'default'} />
            <StatCard title="Metrics Compared" value={data.summary.metricsCompared} icon={<Activity className="w-5 h-5" />} />
            <StatCard title="Total Runs" value={data.summary.totalRuns} icon={<CheckCircle className="w-5 h-5" />} />
          </div>

          <Card padding="sm" className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>Baseline: <strong className="text-gray-700 dark:text-gray-300">{data.baseline.runLabel}</strong></span>
                <span>Current: <strong className="text-gray-700 dark:text-gray-300">{data.current.runLabel}</strong></span>
              </div>
            </div>
          </Card>

          {data.summary.regressions === 0 && data.summary.improvements === 0 ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <Minus className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No significant changes detected</p>
                <p className="text-xs text-gray-400 mt-1">All metrics are within normal thresholds (within 5% of baseline).</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Metric Comparison</h3>
              {data.regression
                .filter((m) => m.direction !== 'unchanged')
                .concat(data.regression.filter((m) => m.direction === 'unchanged'))
                .map((m, i) => {
                  const c = severityColor(m.direction === 'regressed' ? m.severity : 'none');
                  const changeStr = m.changePercent !== null ? `${m.changePercent > 0 ? '+' : ''}${m.changePercent.toFixed(1)}%` : 'N/A';
                  return (
                    <Card key={i} padding="md" className={`${m.direction === 'regressed' ? c.bg : ''} ${m.direction === 'regressed' ? c.border : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {directionIcon(m.direction)}
                            <span className={`font-semibold text-sm ${m.direction === 'regressed' ? c.text : 'text-gray-900 dark:text-gray-100'}`}>
                              {formatMetricName(m.name)}
                            </span>
                            {m.direction === 'regressed' && m.severity === 'high' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700">
                                High
                              </span>
                            )}
                            {m.direction === 'regressed' && m.severity === 'medium' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                                Medium
                              </span>
                            )}
                            {m.direction === 'improved' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700">
                                Improved
                              </span>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-gray-400">Baseline avg:</span>
                              <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">{m.baseline.avg.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Current avg:</span>
                              <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">{m.current.avg.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">p95:</span>
                              <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">{m.current.p95.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <span className={`text-lg font-bold ${m.direction === 'regressed' ? c.text : m.direction === 'improved' ? 'text-green-500' : 'text-gray-500'}`}>
                            {changeStr}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
