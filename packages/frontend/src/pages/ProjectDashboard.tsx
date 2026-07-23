import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import TrendChart from '../components/TrendChart';
import { PageSkeleton } from '../components/Skeleton';
import { useTitle } from '../hooks/useTitle';
import { useToastStore } from '../stores/toastStore';
import Card from '../components/Card';
import { StatusBadge } from '../components/Badge';
import { Button } from '../components/ui';
import {
  ArrowUpRight, FileText, Play, Timer, CheckCircle,
  Settings, Zap, TrendingUp, TrendingDown,
  RefreshCw, AlertCircle, Box, BarChart3,
  ShieldCheck, ChevronRight, ListChecks, ListOrdered,
  Users, PieChart, Clock, Activity, BookOpen,
  GitBranch, Target, Bug, Search, Globe, Layers
} from 'lucide-react';

type TimeRange = '7d' | '14d' | '30d';
const SCRIPTS_PER_PAGE = 10;

interface ScriptHealth {
  id: string; name: string; version: number;
  totalRuns: number; passed: number; failed: number; passRate: number;
  avgDuration: number; lastRunStatus: string | null; lastRunAt: string | null;
}

function MiniSparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={height} className="shrink-0" viewBox={`0 0 ${w} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProjectDashboard() {
  useTitle('Project');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [stats, setStats] = useState<any>(null);
  const [scripts, setScripts] = useState<ScriptHealth[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [scriptsPage, setScriptsPage] = useState(0);
  const summaryHours = timeRange === '7d' ? 168 : timeRange === '14d' ? 336 : 720;

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    const fetchLimit = timeRange === '7d' ? 30 : timeRange === '14d' ? 60 : 120;
    Promise.all([
      api.getDashboardSummary(pid!, summaryHours),
      api.listScripts(pid!),
      api.listRuns({ projectId: pid, limit: fetchLimit }),
      api.listSchedules?.(pid!).catch(() => []) || Promise.resolve([]),
    ]).then(async ([s, sc, runs, sched]) => {
      setStats(s);
      setRecentRuns(runs);
      setSchedules(sched);

      const scriptHealthMap = new Map<string, { total: number; passed: number; failed: number; durations: number[]; lastRun: any; lastRunAt: string | null }>();
      for (const script of sc) scriptHealthMap.set(script.id, { total: 0, passed: 0, failed: 0, durations: [], lastRunAt: null, lastRun: null });

      for (const run of runs) {
        const h = scriptHealthMap.get(run.scriptId);
        if (!h) continue;
        h.total++;
        if (run.status === 'completed') h.passed++;
        else if (run.status === 'failed') h.failed++;
        const dur = run.results?.find((res: any) => res.metricName === 'http_req_duration');
        if (dur?.avg) h.durations.push(dur.avg);
        if (!h.lastRunAt || new Date(run.createdAt) > new Date(h.lastRunAt)) {
          h.lastRunAt = run.createdAt;
          h.lastRun = run;
        }
      }

      setScriptsPage(0);
      setScripts(sc.map((s: any) => {
        const h = scriptHealthMap.get(s.id)!;
        return {
          id: s.id, name: s.name, version: s.version,
          totalRuns: h.total, passed: h.passed, failed: h.failed,
          passRate: h.total > 0 ? (h.passed / h.total) * 100 : 0,
          avgDuration: h.durations.length > 0
            ? h.durations.reduce((a: number, b: number) => a + b, 0) / h.durations.length
            : 0,
          lastRunStatus: h.lastRun?.status ?? null,
          lastRunAt: h.lastRunAt,
        };
      }));
    }).catch((err) => { console.error(err); setError('Failed to load dashboard'); })
      .finally(() => setLoading(false));
  }, [pid, timeRange]);

  const quickRun = useCallback(async (scriptId: string, scriptName: string) => {
    setRunningId(scriptId);
    try {
      // If a configuration already exists for this script, use it directly without clearing options.
      // If no configuration exists, only then create an empty default configuration file.
      const configs = await api.listConfigs(scriptId);
      let config = configs.find((c: any) => !c.name?.startsWith('Quick Run - ')) || configs[0];
      if (!config) {
        config = await api.createConfig(scriptId, {
          name: `Default Configuration (${scriptName})`,
          options: {},
        });
      }
      const run = await api.triggerRun(config.id);
      navigate(`/projects/${pid}/runs/${run.id}/live`);
    } catch {
      toast.error('Failed to start quick run');
    } finally {
      setRunningId(null);
    }
  }, [pid, navigate, toast]);

  const totalCompleted = useMemo(() => recentRuns.filter((r: any) => r.status === 'completed').length, [recentRuns]);
  const totalFailed = useMemo(() => recentRuns.filter((r: any) => r.status === 'failed').length, [recentRuns]);
  const totalRunning = useMemo(() => recentRuns.filter((r: any) => r.status === 'running').length, [recentRuns]);

  const successRate = useMemo(() => {
    const total = totalCompleted + totalFailed;
    return total > 0 ? (totalCompleted / total) * 100 : 0;
  }, [totalCompleted, totalFailed]);

  const passRateTrend = useMemo(() => {
    if (recentRuns.length < 4) return undefined;
    const half = Math.floor(recentRuns.length / 2);
    const recent = recentRuns.slice(0, half);
    const older = recentRuns.slice(half);
    const recentGood = recent.filter((r: any) => r.status === 'completed').length;
    const olderGood = older.filter((r: any) => r.status === 'completed').length;
    const rRate = recent.length ? (recentGood / recent.length) * 100 : 0;
    const oRate = older.length ? (olderGood / older.length) * 100 : 0;
    return { value: Math.round(rRate - oRate), positive: rRate >= oRate };
  }, [recentRuns]);

  const durationSparkline = useMemo(() => {
    if (recentRuns.length < 2) return undefined;
    return recentRuns.slice(0, 15).reverse().map((r: any) => {
      const dur = r.results?.find((res: any) => res.metricName === 'http_req_duration');
      return dur?.avg || 0;
    }).filter((v: number) => v > 0);
  }, [recentRuns]);

  // Run per-day data
  const runsPerDayData = useMemo(() => {
    const dayBuckets: Record<string, { total: number; passed: number }> = {};
    const now = new Date();
    const days = timeRange === '30d' ? 30 : timeRange === '14d' ? 14 : 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayBuckets[d.toLocaleDateString()] = { total: 0, passed: 0 };
    }
    for (const run of recentRuns) {
      const key = new Date(run.createdAt).toLocaleDateString();
      if (dayBuckets[key]) { dayBuckets[key].total++; if (run.status === 'completed') dayBuckets[key].passed++; }
    }
    return Object.entries(dayBuckets).map(([date, counts]) => ({ date, ...counts }));
  }, [recentRuns, timeRange]);
  const maxDailyRuns = Math.max(...runsPerDayData.map(d => d.total), 1);

  // Pass rate trend bars
  const passRateTrendData = useMemo(() => {
    const sorted = [...recentRuns].reverse();
    if (sorted.length < 3) return [];
    const windowSize = Math.min(5, Math.max(2, Math.floor(sorted.length / 3)));
    return sorted.map((_, i) => {
      if (i + windowSize > sorted.length) return 0;
      const window = sorted.slice(i, i + windowSize);
      const good = window.filter(r => r.status === 'completed').length;
      return Math.round((good / window.length) * 100);
    }).filter(v => v > 0);
  }, [recentRuns]);

  // Script health matrix
  const scriptsHealth = useMemo(() => scripts.map(s => {
    const pct = s.passRate;
    const statusLabel = pct >= 80 ? 'Healthy' : pct >= 50 ? 'Unstable' : 'Failing';
    const color = pct >= 80 ? 'emerald' : pct >= 50 ? 'amber' : 'red';
    return { ...s, statusLabel, color };
  }), [scripts]);

  const healthyCount = scriptsHealth.filter(s => s.color === 'emerald').length;
  const unstableCount = scriptsHealth.filter(s => s.color === 'amber').length;
  const failingCount = scriptsHealth.filter(s => s.color === 'red').length;

  const activeSchedules = schedules.filter((s: any) => s.enabled).length;

  if (loading) return <PageSkeleton />;
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <AlertCircle className="w-10 h-10 mb-3" />
      <p className="text-sm">{error}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </Button>
    </div>
  );

  const timeRanges: { label: string; value: TimeRange }[] = [
    { label: '7d', value: '7d' },
    { label: '14d', value: '14d' },
    { label: '30d', value: '30d' },
  ];

  const statusDowntime = [
    { label: 'Running', count: totalRunning, color: 'bg-blue-500' },
    { label: 'Passed', count: totalCompleted, color: 'bg-emerald-500' },
    { label: 'Failed', count: totalFailed, color: 'bg-red-500' },
  ];
  const totalStatusRuns = totalRunning + totalCompleted + totalFailed || 1;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ===== TOP ROW: Header + KPI ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Command Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {scripts.length} plans &middot; {recentRuns.length} runs (this period) &middot; {healthyCount} healthy, {unstableCount} unstable, {failingCount} failing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {timeRanges.map(({ label, value }) => (
              <button key={value} onClick={() => setTimeRange(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeRange === value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >{label}</button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${pid}/plans`)}>
            <ListChecks className="w-3.5 h-3.5" /> Manage Plans
          </Button>
        </div>
      </div>

      {/* ===== QUICK STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Response</p>
            <Timer className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {stats?.avgDuration ? `${(stats.avgDuration).toFixed(0)}ms` : '—'}
          </p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">p95: {stats?.avgDuration ? (stats.avgDuration * 1.5).toFixed(0) : '—'}ms</p>
            {durationSparkline && <MiniSparkline data={durationSparkline} color="#6366f1" />}
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Success Rate</p>
            <ShieldCheck className="w-4 h-4 text-gray-400" />
          </div>
          <p className={`text-2xl font-bold tabular-nums ${successRate > 80 ? 'text-emerald-600' : successRate > 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {successRate.toFixed(0)}%
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${successRate > 80 ? 'bg-emerald-500' : successRate > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${successRate}%` }}
              />
            </div>
            {passRateTrend && (
              <span className={`text-xs font-medium flex items-center gap-0.5 ${passRateTrend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                {passRateTrend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {passRateTrend.value > 0 ? '+' : ''}{passRateTrend.value}%
              </span>
            )}
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Executions</p>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{recentRuns.length}</p>
          <div className="flex items-center gap-3 mt-2">
            {statusDowntime.map(s => (
              <div key={s.label} className="flex items-center gap-1 text-xs text-gray-400">
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                {s.count}
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 mt-1.5 h-1">
            {statusDowntime.map(s => (
              <div key={s.label} className={`${s.color} rounded-full transition-all`}
                style={{ width: `${(s.count / totalStatusRuns) * 100}%` }}
              />
            ))}
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Health</p>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex -space-x-1">
              {scriptsHealth.slice(0, 5).map(s => (
                <div key={s.id} className={`w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                  s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                }`} title={s.name} />
              ))}
            </div>
            {scripts.length > 5 && <span className="text-[10px] text-gray-400">+{scripts.length - 5}</span>}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {healthyCount} OK</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {unstableCount}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {failingCount}</span>
          </div>
          {activeSchedules > 0 && (
            <p className="text-[10px] text-brand-600 dark:text-brand-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {activeSchedules} active schedule{activeSchedules > 1 ? 's' : ''}
            </p>
          )}
        </Card>
      </div>

      {/* ===== CHARTS ROW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Runs per day stacked bar */}
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Runs per Day</h3>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          {runsPerDayData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No runs yet</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-28">
                {runsPerDayData.map(({ date, total, passed }) => (
                  <div key={date} className="flex-1 flex items-end gap-px" style={{ height: `${(total / maxDailyRuns) * 100}%` }}>
                    <div className="flex-1 rounded-t bg-emerald-400 dark:bg-emerald-500 transition-all hover:opacity-80"
                      style={{ height: `${passed / Math.max(total, 1) * 100}%` }}
                    />
                    <div className="flex-1 rounded-t bg-red-400 dark:bg-red-500 transition-all hover:opacity-80"
                      style={{ height: `${((total - passed) / Math.max(total, 1)) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> Passed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" /> Failed</span>
              </div>
            </>
          )}
        </Card>

        {/* Pass rate trend */}
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pass Rate Trend</h3>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          {passRateTrendData.length < 2 ? (
            <p className="text-xs text-gray-400 text-center py-8">Not enough data</p>
          ) : (
            <>
              <div className="flex items-end gap-1 h-28">
                {passRateTrendData.map((val, i) => (
                  <div key={i} title={`${val}%`}
                    className={`flex-1 rounded-t transition-all hover:opacity-80 ${
                      val > 80 ? 'bg-emerald-400 dark:bg-emerald-500' :
                      val > 50 ? 'bg-amber-400 dark:bg-amber-500' : 'bg-red-400 dark:bg-red-500'
                    }`}
                    style={{ height: `${val}%` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                <span>Rolling {Math.min(5, Math.max(2, Math.floor(recentRuns.length / 3)))}-run window</span>
                <span className="tablular-nums">{passRateTrendData[passRateTrendData.length - 1]}% latest</span>
              </div>
            </>
          )}
        </Card>

        {/* Donut health */}
        <Card padding="lg" className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Health</h3>
            <ShieldCheck className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                  fill="none"
                  stroke={successRate > 80 ? '#10b981' : successRate > 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${successRate} ${100 - successRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold tabular-nums ${successRate > 80 ? 'text-emerald-500' : successRate > 50 ? 'text-amber-500' : 'text-red-500'}`}>
                  {successRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== MIDDLE ROW: Response Trend + Quick Actions ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <Card padding="lg" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Response Time Trend</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Avg</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> p95</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> p99</span>
            </div>
          </div>
          <TrendChart pid={pid!} hours={summaryHours} />
        </Card>

        {/* Quick Access grid */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'New Plan', path: `plans`, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', desc: 'Create a new test plan' },
              { label: 'Test Runs', path: `runs`, icon: Play, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', desc: 'View run history' },
              { label: 'Suites', path: `suites`, icon: GitBranch, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30', desc: 'Orchestrate test suites' },
              { label: 'Schedules', path: `schedules`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', desc: 'Automated scheduling' },
              { label: 'Settings', path: `settings`, icon: Settings, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-800', desc: 'Project configuration' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="group flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all bg-white dark:bg-gray-900 text-left"
              >
                <div className={`p-2 rounded-lg shrink-0 ${a.bg}`}><a.icon className={`w-4 h-4 ${a.color}`} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.label}</p>
                  <p className="text-[10px] text-gray-400 truncate">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Active schedules */}
          {schedules.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Active Schedules</p>
              {schedules.filter((s: any) => s.enabled).slice(0, 3).map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-3 h-3 text-emerald-500" />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto text-gray-400 text-[10px]">{s.cronExpression}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== SCRIPT HEALTH MATRIX ===== */}
      <Card padding="none" className="mb-6">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Health Matrix</h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {healthyCount} Healthy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {unstableCount} Unstable</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {failingCount} Failing</span>
          </div>
        </div>
        {scriptsHealth.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-gray-400">
            <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            No plans yet. <button onClick={() => navigate(`/projects/${pid}/plans`)} className="text-brand-600 hover:underline">Create one</button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[420px] overflow-y-auto">
              {scriptsHealth.slice(scriptsPage * SCRIPTS_PER_PAGE, (scriptsPage + 1) * SCRIPTS_PER_PAGE).map(s => (
                <div key={s.id} onClick={() => navigate(`/projects/${pid}/plans/${s.id}`)}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{s.name}</p>
                      <span className="text-[10px] text-gray-400 font-mono">v{s.version}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${s.passRate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-medium tabular-nums shrink-0">{s.passRate.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-400 shrink-0">
                    <span>{s.totalRuns} runs</span>
                    {s.avgDuration > 0 && <span>{s.avgDuration.toFixed(0)}ms</span>}
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      s.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' :
                      s.color === 'amber' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600' :
                      'bg-red-50 dark:bg-red-950/30 text-red-600'
                    }`}>{s.statusLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickRun(s.id, s.name); }} disabled={runningId === s.id}>
                      <Zap className="w-3 h-3" />{runningId === s.id ? '...' : 'Run'}
                    </Button>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            {scriptsHealth.length > SCRIPTS_PER_PAGE && (
              <div className="px-5 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
                <span className="text-gray-400">{scriptsHealth.length} total plans</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScriptsPage(Math.max(0, scriptsPage - 1))}
                    disabled={scriptsPage === 0}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.ceil(scriptsHealth.length / SCRIPTS_PER_PAGE) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setScriptsPage(i)}
                      className={`px-2 py-1 rounded transition-colors ${
                        i === scriptsPage
                          ? 'bg-brand-600 text-white'
                          : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setScriptsPage(Math.min(Math.ceil(scriptsHealth.length / SCRIPTS_PER_PAGE) - 1, scriptsPage + 1))}
                    disabled={scriptsPage >= Math.ceil(scriptsHealth.length / SCRIPTS_PER_PAGE) - 1}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ===== BOTTOM ROW: Recent Activity + Schedules ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent Activity</h3>
            </div>
            <button onClick={() => navigate(`/projects/${pid}/runs`)} className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline">View all</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[320px] overflow-y-auto">
            {recentRuns.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-400">No activity yet</div>
            ) : recentRuns.slice(0, 10).map((r: any) => (
              <div key={r.id} onClick={() => navigate(`/projects/${pid}/runs/${r.id}`)}
                className="px-5 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
              >
                <StatusBadge status={r.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {r.config?.name || r.script?.name || r.scriptId?.slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {r.finishedAt ? ` · ${((new Date(r.finishedAt).getTime() - new Date(r.createdAt).getTime()) / 1000).toFixed(0)}s` : ''}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Testing Cycle Status */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Testing Cycle</h3>
            </div>
            <button onClick={() => navigate(`/projects/${pid}/plans`)} className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline">Manage plans</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {/* Phase 1: Plan */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Plan</p>
                  <p className="text-[10px] text-gray-400">Define test objectives and scenarios</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/plans`)} className="text-[10px]">
                  {scripts.filter(s => s.passRate > 0).length} plans
                </Button>
              </div>
            </div>
            {/* Phase 2: Execute */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Execute</p>
                  <p className="text-[10px] text-gray-400">Run tests and suites on demand or schedule</p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-gray-400">{recentRuns.length} runs</span>
                  {activeSchedules > 0 && <span className="text-emerald-600">{activeSchedules} scheduled</span>}
                </div>
              </div>
            </div>
            {/* Phase 3: Analyze */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Analyze</p>
                  <p className="text-[10px] text-gray-400">Review results, SLA, anomalies</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/sla`)} className="text-[10px]">
                  SLA reports
                </Button>
              </div>
            </div>
            {/* Phase 4: Optimize */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                  <Settings className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Optimize</p>
                  <p className="text-[10px] text-gray-400">Tune infrastructure, environments, thresholds</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/environments`)} className="text-[10px]">
                  Environments
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}