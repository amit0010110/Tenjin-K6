import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveRunStore, MetricPoint, SysStats } from '../stores/liveRunStore';
import { api } from '../api/client';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line, Legend } from 'recharts';
import Card from '../components/Card';
import { useTitle } from '../hooks/useTitle';
import { Square, Activity, Terminal, Gauge, Zap, Users, AlertTriangle, Clock, Cpu } from 'lucide-react';

const MAX_POINTS = 200;

function latest(points: MetricPoint[] | undefined): number | null {
  if (!points || points.length === 0) return null;
  return points[points.length - 1].value;
}

function avg(points: MetricPoint[] | undefined): number | null {
  if (!points || points.length === 0) return null;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computePercentiles(points: MetricPoint[]): { p50: number; p95: number; p99: number } {
  const values = points.map(p => p.value);
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}

function statCard(label: string, value: string | null, unit: string, icon: React.ReactNode, color: string, sub?: string) {
  return (
    <Card padding="md" className="h-full">
      <div className="flex items-start justify-between h-full">
        <div className="min-w-0 flex flex-col justify-between h-full">
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{label}</p>
          <div>
            <p className="text-xl font-bold mt-0.5 text-gray-900 dark:text-gray-100 truncate">
              {value ?? <span className="text-gray-400">--</span>}
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">{value ? unit : ''}</span>
            </p>
            {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function metricChart(
  title: string,
  data: { time: number; value: number }[],
  color: string,
  unit: string,
  icon: React.ReactNode,
  iconColor: string,
) {
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
        <span className={iconColor}>{icon}</span>{title}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" hide />
          <YAxis unit={unit} stroke="#9ca3af" tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#grad-${color.slice(1)})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

function percentileChart(
  data: { time: number; p50: number; p95: number; p99: number }[],
) {
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
        <Activity className="w-4 h-4 text-rose-500" />Latency Percentiles
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" hide />
          <YAxis unit="ms" stroke="#9ca3af" tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="p50" name="p50" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p95" name="p95" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p99" name="p99" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

function formatMs(ms: number | null): string {
  if (ms === null) return '--';
  if (ms >= 1000) return (ms / 1000).toFixed(2);
  return ms.toFixed(0);
}

function formatRate(val: number | null): string {
  if (val === null) return '--';
  return val.toFixed(1);
}

export default function LiveMonitor() {
  useTitle('Live Monitor');
  const { pid, rid } = useParams();
  const navigate = useNavigate();
  const { status, metrics, log, sysStats, connect, disconnect, appendLog } = useLiveRunStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect(rid!);

    const interval = setInterval(async () => {
      try {
        const run = await api.getRun(rid!);
        if (['completed', 'failed', 'aborted'].includes(run.status)) {
          appendLog(`Test ${run.status}`);
          disconnect();
          clearInterval(interval);
          setTimeout(() => navigate(`/projects/${pid}/runs/${rid}`), 2000);
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => {
      disconnect();
      clearInterval(interval);
    };
  }, [rid]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Raw data slices
  const durationPoints = metrics['http_req_duration']?.slice(-MAX_POINTS) ?? [];
  const reqsPoints = metrics['http_reqs']?.slice(-MAX_POINTS) ?? [];
  const vusPoints = metrics['vus']?.slice(-MAX_POINTS) ?? [];
  const failedPoints = metrics['http_req_failed']?.slice(-MAX_POINTS) ?? [];

  // Simple charts (single value per point)
  const durationChart = useMemo(() =>
    durationPoints.map((p, i) => ({ time: i, value: p.value })),
  [durationPoints]);

  const reqsChart = useMemo(() =>
    reqsPoints.map((p, i) => ({ time: i, value: p.value })),
  [reqsPoints]);

  const vusChart = useMemo(() =>
    vusPoints.map((p, i) => ({ time: i, value: p.value })),
  [vusPoints]);

  const failedChart = useMemo(() =>
    failedPoints.map((p, i) => ({ time: i, value: p.value * 100 })),
  [failedPoints]);

  // Percentile chart data (p50/p95/p99 from sliding window)
  const percentileData = useMemo(() => {
    const result: { time: number; p50: number; p95: number; p99: number }[] = [];
    // Bucket every 5 points for smoothness
    const bucketSize = 5;
    for (let i = 0; i < durationPoints.length; i += bucketSize) {
      const bucket = durationPoints.slice(0, i + bucketSize);
      const p = computePercentiles(bucket);
      result.push({ time: result.length, p50: p.p50, p95: p.p95, p99: p.p99 });
    }
    return result;
  }, [durationPoints]);

  // Current summary values
  const currLatency = latest(durationPoints);
  const avgLatency = avg(durationPoints);
  const currReqs = latest(reqsPoints);
  const currVUs = latest(vusPoints);
  const currFailed = latest(failedPoints);
  const currPctls = useMemo(() => computePercentiles(durationPoints), [durationPoints]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-brand-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Live Monitor</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 select-all">
                ID: {rid}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm capitalize text-gray-600 dark:text-gray-400">{status}</span>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(rid!); }}
            className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors font-medium"
            title="Copy Run ID to clipboard"
          >
            Copy ID
          </button>
          <button
            onClick={async () => { await api.abortRun(rid!); appendLog('Abort requested'); }}
            className="inline-flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />Abort
          </button>
        </div>
      </div>

      {/* Stat cards: test metrics */}
      <div className="grid grid-cols-8 gap-3">
        {statCard('Latency', formatMs(currLatency), 'ms',
          <Gauge className="w-4 h-4 text-white" />, 'bg-indigo-500', `avg ${formatMs(avgLatency)}ms`)}
        {statCard('p50', formatMs(currPctls.p50), 'ms',
          <Activity className="w-4 h-4 text-white" />, 'bg-emerald-500')}
        {statCard('p95', formatMs(currPctls.p95), 'ms',
          <Activity className="w-4 h-4 text-white" />, 'bg-amber-500')}
        {statCard('p99', formatMs(currPctls.p99), 'ms',
          <AlertTriangle className="w-4 h-4 text-white" />, 'bg-rose-500')}
        {statCard('Throughput', formatRate(currReqs), '/s',
          <Zap className="w-4 h-4 text-white" />, 'bg-emerald-500')}
        {statCard('VUs',
          currVUs !== null ? String(currVUs) : '--', '',
          <Users className="w-4 h-4 text-white" />, 'bg-blue-500')}
        {statCard('Errors',
          currFailed !== null ? (currFailed * 100).toFixed(1) : '--', '%',
          <AlertTriangle className="w-4 h-4 text-white" />, currFailed && currFailed > 0.05 ? 'bg-red-500' : 'bg-gray-500')}
        {statCard('Agent',
          sysStats ? `${sysStats.cpuPercent}%` : '--', '',
          <Cpu className="w-4 h-4 text-white" />, 'bg-gray-500',
          sysStats ? `${sysStats.memoryMb}MB / ${sysStats.memoryPercent}%` : '')}
      </div>

      {/* Charts grid: 3-col for more metrics */}
      <div className="grid grid-cols-3 gap-4">
        {metricChart('Response Time', durationChart, '#6366f1', 'ms',
          <Clock className="w-4 h-4 text-indigo-500" />, 'text-indigo-500')}
        {percentileChart(percentileData)}
        {metricChart('Request Rate', reqsChart, '#22c55e', '/s',
          <Zap className="w-4 h-4 text-green-500" />, 'text-green-500')}
        {metricChart('Virtual Users', vusChart, '#3b82f6', '',
          <Users className="w-4 h-4 text-blue-500" />, 'text-blue-500')}
        {metricChart('Error Rate %', failedChart, '#ef4444', '%',
          <AlertTriangle className="w-4 h-4 text-red-500" />, 'text-red-500')}
        {/* Empty slot for future use */}
        <Card padding="md">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-purple-500" />Data Points
          </h3>
          <div className="flex items-center justify-center h-[280px] text-gray-400 dark:text-gray-500 text-sm">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                {Object.values(metrics).reduce((s, a) => s + a.length, 0)}
              </p>
              <p className="text-xs mt-1">total samples received</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Output log */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Output Log</h3>
        </div>
        <div className="bg-gray-900 text-green-400 rounded-lg p-4 h-48 overflow-auto font-mono text-xs">
          {log.length === 0 ? (
            <p className="text-gray-500">Waiting for output...</p>
          ) : (
            log.map((line, i) => <div key={i}>{line}</div>)
          )}
          <div ref={logEndRef} />
        </div>
      </Card>
    </div>
  );
}
