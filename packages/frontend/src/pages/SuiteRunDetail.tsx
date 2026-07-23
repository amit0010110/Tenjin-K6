import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import { Button } from '../components/ui';
import { Layers, Play, CheckCircle, XCircle, Clock, ArrowRight, Activity, RefreshCw } from 'lucide-react';

interface RunResult {
  id: string; metricName: string; avg: number; min: number; max: number;
  p90: number; p95: number; p99: number; count: number;
}

interface ThresholdResult {
  id: string; metricName: string; thresholdExpr: string; actualValue: number; passed: boolean;
}

interface Run {
  id: string; status: string; scriptId: string; createdAt: string; startedAt: string | null;
  finishedAt: string | null; k6ExitCode: number | null; triggerType: string;
  script: { name: string };
  results: RunResult[];
  thresholdResults: ThresholdResult[];
}

interface SuiteRunData {
  suiteRunId: string; createdAt: string; runs: Run[];
}

export default function SuiteRunDetail() {
  useTitle('Suite Run');
  const { pid, suiteRunId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<SuiteRunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/suite-runs/${suiteRunId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Suite run not found');
      const d = await r.json();
      setData(d);
      setError(null);
      return d;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [suiteRunId, token]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  // Auto-poll while runs are active
  const isRunning = data?.runs.some((r) => r.status === 'running' || r.status === 'pending');
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [isRunning, fetchRun]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Card key={i} padding="md"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} padding="md"><div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500 text-center">Error: {error}</div>;
  }

  if (!data) return null;

  const total = data.runs.length;
  const completed = data.runs.filter((r) => r.status === 'completed').length;
  const failed = data.runs.filter((r) => r.status === 'failed').length;
  const running = data.runs.filter((r) => r.status === 'running' || r.status === 'pending').length;
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  const allResults = data.runs.flatMap((r) => r.results);
  const avgDuration = allResults.filter((r) => r.metricName === 'http_req_duration').reduce((sum, r) => sum + r.avg, 0) /
    Math.max(allResults.filter((r) => r.metricName === 'http_req_duration').length, 1);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Suite Run"
        subtitle={`${new Date(data.createdAt).toLocaleString()} · ${completed + failed} of ${total} complete`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/suites`)}>
              <ArrowRight className="w-4 h-4" /> Go to Suites
            </Button>
          </div>
        }
      />

      {/* Progress bar */}
      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><Play className="w-3 h-3 text-brand-500" />{running} running</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" />{completed} passed</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{failed} failed</span>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Scripts" value={total} icon={<Layers className="w-5 h-5" />} />
        <StatCard
          title="Pass Rate"
          value={total > 0 ? `${Math.round((completed / total) * 100)}%` : '—'}
          variant={completed === total ? 'success' : failed > 0 ? 'danger' : 'default'}
          icon={<Activity className="w-5 h-5" />}
        />
        <StatCard title="Passed" value={completed} variant="success" icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="Failed" value={failed} variant={failed > 0 ? 'danger' : 'default'} icon={<XCircle className="w-5 h-5" />} />
      </div>

      {/* Script runs */}
      <div className="space-y-2">
        {data.runs.map((run) => {
          const dur = run.results.find((r) => r.metricName === 'http_req_duration');
          const thresholds = run.thresholdResults;
          const failedThresholds = thresholds.filter((t) => !t.passed);
          const duration = run.startedAt && run.finishedAt
            ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
            : null;

          return (
            <Card
              key={run.id}
              padding="md"
              hover
              onClick={() => {
                const isRunning = run.status === 'running' || run.status === 'pending';
                navigate(isRunning ? `/projects/${pid}/runs/${run.id}/live` : `/projects/${pid}/runs/${run.id}`);
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <StatusBadge status={run.status} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{run.script.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {dur && <span>{dur.avg.toFixed(0)}ms avg</span>}
                      {duration !== null && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration}s</span>}
                      {failedThresholds.length > 0 && (
                        <span className="text-red-500">{failedThresholds.length} threshold{failedThresholds.length > 1 ? 's' : ''} failed</span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
