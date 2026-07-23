import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { PageSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui';
import { useTitle } from '../hooks/useTitle';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import {
  Activity, TrendingUp, AlertTriangle, Clock, ArrowRight, Plus,
  Layers, CheckCircle, BarChart3, Gauge, FileText, Play, Zap,
  RefreshCw, Users, Box, ChevronRight, TrendingDown, ShieldCheck,
  Timer, ListOrdered, Percent
} from 'lucide-react';

interface ProjectSummary {
  id: string; name: string; description: string | null;
  _count: { scripts: number; testRuns: number; members: number };
}

interface GlobalStats {
  totalProjects: number; totalScripts: number; totalRuns: number;
  passRate: number; completedRuns: number; failedRuns: number;
  avgDuration: number;
}

function MiniSparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const w = 80;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={height} className="shrink-0" viewBox={`0 0 ${w} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Dashboard() {
  useTitle('Dashboard');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [globalRuns, setGlobalRuns] = useState<any[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const projs = await api.listProjects();
      setProjects(projs);
      const summaries = await Promise.all(
        projs.map((p) => api.getDashboardSummary(p.id).catch(() => null))
      );

      const totalScripts = projs.reduce((s, p) => s + (p._count?.scripts ?? 0), 0);
      const totalRuns = summaries.reduce((s, d) => s + (d?.totalRuns ?? 0), 0);
      const completedRuns = summaries.reduce((s, d) => s + (d?.passedRuns ?? 0), 0);
      const failedRuns = summaries.reduce((s, d) => s + (d?.failedRuns ?? 0), 0);
      const totalDuration = summaries.reduce((s, d) => s + (d?.avgDuration ?? 0), 0);
      const projectsWithData = summaries.filter((s) => s !== null).length;

      setStats({
        totalProjects: projs.length,
        totalScripts,
        totalRuns,
        passRate: totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0,
        completedRuns,
        failedRuns,
        avgDuration: projectsWithData > 0 ? totalDuration / projectsWithData : 0,
      });

      const allRuns = (
        await Promise.all(
          projs.map((p) => api.listRuns({ projectId: p.id, limit: 30 }).catch(() => []))
        )
      ).flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setGlobalRuns(allRuns);
      setRecentRuns(allRuns.slice(0, 15));
      setError(null);
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-poll while any run is in progress
  const hasActiveRuns = globalRuns.some((r: any) => r.status === 'running' || r.status === 'pending');
  useEffect(() => {
    if (!hasActiveRuns && !loading) return;
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, [hasActiveRuns, loading, loadDashboard]);

  const totalCompleted = recentRuns.filter((r: any) => r.status === 'completed').length;
  const totalFailed = recentRuns.filter((r: any) => r.status === 'failed').length;
  const successRate = stats && stats.totalRuns > 0 ? (stats.passRate || 0) : 0;

  // Runs per day (last 7 days)
  const runsPerDayData = useMemo(() => {
    const dayBuckets: Record<string, { total: number; passed: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayBuckets[d.toLocaleDateString()] = { total: 0, passed: 0 };
    }
    for (const run of globalRuns) {
      const key = new Date(run.createdAt).toLocaleDateString();
      if (dayBuckets[key]) {
        dayBuckets[key].total++;
        if (run.status === 'completed') dayBuckets[key].passed++;
      }
    }
    return Object.entries(dayBuckets).map(([date, counts]) => ({ date, ...counts }));
  }, [globalRuns]);

  const maxDailyRuns = Math.max(...runsPerDayData.map(d => d.total), 1);

  // Project health data
  const projectHealth = useMemo(() => {
    return projects.map(p => {
      const projectRuns = globalRuns.filter(r => r.projectId === p.id);
      const completed = projectRuns.filter(r => r.status === 'completed').length;
      const failed = projectRuns.filter(r => r.status === 'failed').length;
      const total = projectRuns.length;
      return {
        id: p.id,
        name: p.name,
        scripts: p._count?.scripts ?? 0,
        totalRuns: total,
        passRate: total > 0 ? (completed / total) * 100 : 0,
        passed: completed,
        failed,
      };
    });
  }, [projects, globalRuns]);

  // Pass rate trend (last 14 runs)
  const passRateTrendData = useMemo(() => {
    const recent = globalRuns.slice(0, 14).reverse();
    if (recent.length < 2) return [];
    const windowSize = 5;
    return recent.map((_, i) => {
      if (i + windowSize > recent.length) return 0;
      const window = recent.slice(i, i + windowSize);
      const good = window.filter(r => r.status === 'completed').length;
      return Math.round((good / window.length) * 100);
    }).filter(v => v > 0);
  }, [globalRuns]);

  const passRateTrend = useMemo(() => {
    if (!stats || (stats.totalRuns ?? 0) < 2) return undefined;
    return { value: Math.abs(successRate - 50), positive: successRate > 50 };
  }, [stats, successRate]);

  const runSparkline = useMemo(() => {
    if (globalRuns.length < 3) return undefined;
    return runsPerDayData.map(d => d.total);
  }, [runsPerDayData]);

  if (loading) return <PageSkeleton />;
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <AlertTriangle className="w-10 h-10 mb-3" />
      <p className="text-sm">{error}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </Button>
    </div>
  );

  const quickActions = [
    { label: 'New Project', icon: Plus, onClick: () => navigate('/projects'), bg: 'bg-brand-50 dark:bg-brand-950/30 text-brand-600', desc: 'Create a new testing project' },
    { label: 'View Plans', icon: Layers, onClick: () => { if (projects[0]) navigate(`/projects/${projects[0].id}/plans`); }, bg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600', desc: `${stats?.totalScripts ?? 0} plan(s) across projects` },
    { label: 'View Runs', icon: Play, onClick: () => { if (projects[0]) navigate(`/projects/${projects[0].id}/runs`); }, bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600', desc: `${totalCompleted} completed, ${totalFailed} failed` },
    { label: 'All Projects', icon: Gauge, onClick: () => navigate('/projects'), bg: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600', desc: `${stats?.totalProjects ?? 0} project(s)` },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Welcome back{user?.name ? `, ${user.name}` : ''}!</p>
        </div>
        <Button onClick={() => navigate('/projects')}>
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all bg-white dark:bg-gray-900 text-left"
          >
            <div className={`p-2.5 rounded-lg shrink-0 ${action.bg}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{action.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{action.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 ml-auto transition-colors" />
          </button>
        ))}
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Projects" value={stats?.totalProjects ?? 0} icon={<Gauge className="w-5 h-5" />} subtitle="Active projects" />
        <StatCard title="Plans" value={stats?.totalScripts ?? 0} icon={<Layers className="w-5 h-5" />} subtitle="Total test plans" />
        <StatCard
          title="Success Rate"
          value={stats && stats.totalRuns > 0 ? `${successRate.toFixed(1)}%` : '—'}
          variant={successRate > 80 ? 'success' : successRate > 50 ? 'warning' : 'danger'}
          icon={<ShieldCheck className="w-5 h-5" />}
          subtitle={`${stats?.completedRuns ?? 0} passed / ${stats?.failedRuns ?? 0} failed`}
          trend={passRateTrend}
        />
        <StatCard
          title="Total Runs"
          value={stats?.totalRuns ?? 0}
          icon={<BarChart3 className="w-5 h-5" />}
          subtitle="Across all projects"
          sparklineData={runSparkline}
        />
        <StatCard
          title="Avg Duration"
          value={stats?.avgDuration ? `${(stats.avgDuration).toFixed(0)}ms` : '—'}
          icon={<Timer className="w-5 h-5" />}
          subtitle="Per run average"
          sparklineData={globalRuns.slice(0, 10).reverse().map((r: any) => {
            const dur = r.results?.find((res: any) => res.metricName === 'http_req_duration');
            return dur?.avg || 0;
          }).filter((v: number) => v > 0)}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Runs per day bar chart */}
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Runs per Day</h3>
            <ListOrdered className="w-4 h-4 text-gray-400" />
          </div>
          {runsPerDayData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No runs yet</p>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-28">
                {runsPerDayData.map(({ date, total, passed }) => (
                  <div key={date} className="flex-1 flex items-end gap-0.5">
                    <div
                      title={`${date}: ${passed} passed`}
                      className="flex-1 rounded-t bg-emerald-400 dark:bg-emerald-500 transition-all hover:opacity-80"
                      style={{ height: `${(passed / maxDailyRuns) * 100}%` }}
                    />
                    <div
                      title={`${date}: ${total - passed} failed`}
                      className="flex-1 rounded-t bg-red-400 dark:bg-red-500 transition-all hover:opacity-80"
                      style={{ height: `${((total - passed) / maxDailyRuns) * 100}%` }}
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

        {/* Success rate donut */}
        <Card padding="lg" className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Health</h3>
            <ShieldCheck className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
            <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Pass</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Fail</span>
            </div>
          </div>
        </Card>

        {/* Pass rate trend sparkline */}
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
                  <div
                    key={i}
                    title={`${val}%`}
                    className={`flex-1 rounded-t transition-all hover:opacity-80 ${
                      val > 80 ? 'bg-emerald-400 dark:bg-emerald-500' :
                      val > 50 ? 'bg-amber-400 dark:bg-amber-500' :
                      'bg-red-400 dark:bg-red-500'
                    }`}
                    style={{ height: `${val}%` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                <span>14 runs (rolling 5-run window)</span>
                <span className="tablular-nums">{passRateTrendData[passRateTrendData.length - 1]}%</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Project health comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Projects list */}
        <div className="lg:col-span-3">
          {projectHealth.length > 0 ? (
            <Card padding="none">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projects</h3>
                <span className="text-[10px] text-gray-400">{projectHealth.length} total</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {projectHealth.map(p => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                      <Box className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {p.name}
                        </p>
                        <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                          p.passRate > 80 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                          p.passRate > 50 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                          'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                        }`}>
                          {p.passRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1 mt-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            p.passRate > 80 ? 'bg-emerald-500' :
                            p.passRate > 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${p.passRate}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 shrink-0">
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{p.scripts}</span>
                      <span className="flex items-center gap-1"><Play className="w-3 h-3" />{p.totalRuns}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card padding="lg">
              <div className="text-center py-6">
                <Activity className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No projects yet</p>
                <Button onClick={() => navigate('/projects')}>
                  <Plus className="w-4 h-4" /> Create a Project
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Status summary cards + Recent runs */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card padding="md">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Passed</span>
              </div>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{totalCompleted}</p>
              <p className="text-[10px] text-gray-400">of {recentRuns.length} recent runs</p>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Failed</span>
              </div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{totalFailed}</p>
              <p className="text-[10px] text-gray-400">of {recentRuns.length} recent runs</p>
            </Card>
          </div>

          {/* Status summary bars */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status Breakdown</h3>
              <Percent className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gray-500">Passed</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{totalCompleted}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${recentRuns.length > 0 ? (totalCompleted / recentRuns.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gray-500">Failed</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{totalFailed}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${recentRuns.length > 0 ? (totalFailed / recentRuns.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </Card>

          {/* Recent runs compact list */}
          {recentRuns.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent</span>
                <span className="text-[10px] text-gray-400">{recentRuns.length} runs</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
                {recentRuns.slice(0, 7).map((r: any) => {
                  const project = projects.find(p => p.id === r.projectId);
                  return (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/projects/${r.projectId}/runs/${r.id}`)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    >
                      <StatusBadge status={r.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                          {r.script?.name || project?.name || r.scriptId?.slice(0, 8)}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => { if (projects[0]) navigate(`/projects/${projects[0].id}/runs`); }}
                  className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline w-full text-center">
                  View all runs
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}