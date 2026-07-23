import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Select } from '../components/ui';
import { api } from '../api/client';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, LineChart as LineIcon, PieChart as PieIcon, Plus, Trash2,
  Save, FolderOpen, TrendingUp, Activity, GripVertical, Clock,
  RefreshCw, Settings, Copy, AlertCircle, Check, X, Folder,
} from 'lucide-react';

interface TrendPoint {
  id: string;
  createdAt: string;
  duration: number | null;
  p95: number | null;
  p99: number | null;
}

interface Widget {
  id: string;
  title: string;
  metric: string;
  widgetType: 'chart' | 'stat';
  chartType: 'line' | 'bar' | 'area' | 'pie';
  timeRange: string;
  color: string;
  showLegend: boolean;
  showGrid: boolean;
  thresholds: { value: number; color: string; label: string }[];
}

interface Dashboard {
  id: string;
  projectId: string;
  name: string;
  widgets: string;
  createdAt: string;
  updatedAt: string;
}

const METRICS = [
  { value: 'http_req_duration', label: 'HTTP Request Duration', unit: 'ms', color: '#6366f1' },
  { value: 'http_req_failed', label: 'HTTP Request Failed Rate', unit: '%', color: '#ef4444' },
  { value: 'iterations', label: 'Iterations', unit: '', color: '#10b981' },
  { value: 'vus', label: 'Virtual Users', unit: '', color: '#f59e0b' },
  { value: 'data_received', label: 'Data Received', unit: 'bytes', color: '#3b82f6' },
  { value: 'data_sent', label: 'Data Sent', unit: 'bytes', color: '#8b5cf6' },
  { value: 'http_req_throughput', label: 'HTTP Throughput', unit: 'req/s', color: '#06b6d4' },
];

const CHART_TYPES = [
  { value: 'line', label: 'Line', icon: LineIcon },
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'area', label: 'Area', icon: TrendingUp },
  { value: 'pie', label: 'Pie', icon: PieIcon },
];

const WIDGET_TYPES = [
  { value: 'chart', label: 'Chart' },
  { value: 'stat', label: 'Stat' },
];

const TIME_RANGES = [
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const PALETTE = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];

function formatMetric(metric: string, value: number): string {
  if (metric === 'http_req_duration') return `${value.toFixed(0)}ms`;
  if (metric === 'http_req_failed') return `${(value * 100).toFixed(1)}%`;
  if (metric === 'vus') return value.toFixed(0);
  if (metric === 'data_received' || metric === 'data_sent') {
    const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(value) / Math.log(k));
    return parseFloat((value / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[Math.min(i, 3)];
  }
  return value.toFixed(1);
}

function fmtByWidget(w: Widget, value: number): string { return formatMetric(w.metric, value); }

function formatDuration(ms: number): string {
  if (!ms) return '0ms';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function DashboardBuilder() {
  useTitle('Dashboard Builder');
  const { pid } = useParams();

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [dashboardName, setDashboardName] = useState('My Dashboard');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [globalRange, setGlobalRange] = useState('24h');

  const [showAdd, setShowAdd] = useState(false);
  const [editWidget, setEditWidget] = useState<Widget | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newMetric, setNewMetric] = useState('http_req_duration');
  const [newWidgetType, setNewWidgetType] = useState<'chart' | 'stat'>('chart');
  const [newChartType, setNewChartType] = useState<'line' | 'bar' | 'area' | 'pie'>('line');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newThreshold, setNewThreshold] = useState('');
  const [thresholds, setThresholds] = useState<{ value: number; color: string; label: string }[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);

  const loadDashboards = async () => {
    if (!pid) return;
    try {
      const list = await api.listDashboards(pid);
      setDashboards(list);
      if (list.length > 0 && !currentId) {
        selectDashboard(list[0]);
      } else if (list.length === 0) {
        setWidgets([
          { id: '1', title: 'Response Time', metric: 'http_req_duration', widgetType: 'chart', chartType: 'line', timeRange: '24h', color: '#6366f1', showLegend: true, showGrid: true, thresholds: [] },
          { id: '2', title: 'Error Rate', metric: 'http_req_failed', widgetType: 'stat', chartType: 'bar', timeRange: '24h', color: '#ef4444', showLegend: false, showGrid: true, thresholds: [] },
          { id: '3', title: 'Virtual Users', metric: 'vus', widgetType: 'chart', chartType: 'area', timeRange: '24h', color: '#f59e0b', showLegend: true, showGrid: true, thresholds: [] },
          { id: '4', title: 'Throughput', metric: 'http_req_throughput', widgetType: 'stat', chartType: 'line', timeRange: '24h', color: '#06b6d4', showLegend: false, showGrid: true, thresholds: [] },
        ]);
        setDashboardName('My Dashboard');
        setCurrentId(null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadDashboards(); }, [pid]);

  const selectDashboard = async (d: Dashboard) => {
    setCurrentId(d.id);
    setDashboardName(d.name);
    try {
      const parsed = JSON.parse(d.widgets);
      setWidgets(Array.isArray(parsed) ? parsed.map((w: any) => ({ ...w, color: w.color || '#6366f1', showLegend: w.showLegend !== false, showGrid: w.showGrid !== false, thresholds: w.thresholds || [] })) : []);
    } catch { setWidgets([]); }
    setDirty(false);
  };

  const globalHours = globalRange.endsWith('h')
    ? parseInt(globalRange, 10)
    : parseInt(globalRange, 10) * 24;

  const loadTrend = async () => {
    if (!pid) return;
    try {
      const data = await api.getDashboardTrend(pid, globalHours);
      setTrendData(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadTrend(); }, [pid, refreshKey, globalHours]);

  const chartData = trendData.map((p) => ({
    time: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    duration: p.duration ?? 0,
    p95: p.p95 ?? 0,
    p99: p.p99 ?? 0,
  }));

  const addThreshold = () => {
    const val = parseFloat(newThreshold);
    if (isNaN(val)) return;
    setThresholds([...thresholds, { value: val, color: PALETTE[thresholds.length % PALETTE.length], label: `> ${val}ms` }]);
    setNewThreshold('');
  };

  const commitAddWidget = () => {
    const w: Widget = {
      id: editWidget ? editWidget.id : Date.now().toString(),
      title: newTitle || METRICS.find(m => m.value === newMetric)?.label || newMetric,
      metric: newMetric,
      widgetType: newWidgetType,
      chartType: editWidget?.chartType || newChartType,
      timeRange: editWidget?.timeRange || globalRange,
      color: newColor,
      showLegend: editWidget?.showLegend ?? true,
      showGrid: editWidget?.showGrid ?? true,
      thresholds: thresholds,
    };
    if (editWidget) {
      setWidgets(widgets.map((x) => x.id === editWidget.id ? w : x));
    } else {
      setWidgets([...widgets, w]);
    }
    setDirty(true);
    setShowAdd(false);
    setEditWidget(null);
    setNewTitle('');
    setNewMetric('http_req_duration');
    setNewWidgetType('chart');
    setNewChartType('line');
    setNewColor('#6366f1');
    setThresholds([]);
    setNewThreshold('');
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
    setDirty(true);
  };

  const openEdit = (w: Widget) => {
    setEditWidget(w);
    setNewTitle(w.title);
    setNewMetric(w.metric);
    setNewWidgetType(w.widgetType);
    setNewChartType(w.chartType);
    setNewColor(w.color);
    setThresholds(w.thresholds || []);
    setShowAdd(true);
  };

  const saveDashboard = async () => {
    if (!pid) return;
    setSaving(true);
    try {
      if (currentId) {
        await api.updateDashboard(currentId, { name: dashboardName, widgets: JSON.stringify(widgets) });
      } else {
        const created = await api.createDashboard(pid, { name: dashboardName, widgets: JSON.stringify(widgets) });
        setCurrentId(created.id);
      }
      setDirty(false);
      await loadDashboards();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const saveAsNew = async () => {
    if (!pid) return;
    setSaving(true);
    try {
      const created = await api.createDashboard(pid, { name: dashboardName + ' (copy)', widgets: JSON.stringify(widgets) });
      setCurrentId(created.id);
      setDashboardName(created.name);
      setDirty(false);
      await loadDashboards();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const deleteDashboard = async () => {
    if (!currentId) return;
    try {
      await api.deleteDashboard(currentId);
      setCurrentId(null);
      setWidgets([]);
      setDashboardName('My Dashboard');
      setDirty(false);
      await loadDashboards();
    } catch { /* ignore */ }
  };

  const newDashboard = () => {
    setCurrentId(null);
    setWidgets([]);
    setDashboardName('New Dashboard');
    setDirty(false);
  };

  const widgetStat = (w: Widget) => {
    const vals = chartData.map(d => d.duration).filter(v => v > 0);
    if (vals.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-center text-gray-400">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No data yet</p>
          </div>
        </div>
      );
    }
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const latest = vals[vals.length - 1];
    const prev = vals.length > 1 ? vals[vals.length - 2] : latest;
    const trend = latest > prev ? 'up' : latest < prev ? 'down' : 'flat';
    return (
      <div className="relative">
        <div className="flex items-center justify-center h-40 rounded-lg overflow-hidden">
          <div className="text-center px-4">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatMetric(w.metric, avg)}</span>
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-gray-400'}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(((latest - prev) / (prev || 1)) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 mt-1.5">
              <span className="text-[11px] text-gray-400">max {fmtByWidget(w, max)}</span>
              <span className="text-[11px] text-gray-300 dark:text-gray-600">|</span>
              <span className="text-[11px] text-gray-400">min {fmtByWidget(w, min)}</span>
            </div>
            <div className="mt-3 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.slice(-20)}>
                  <defs>
                    <linearGradient id={`spark-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={w.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={w.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="duration" stroke={w.color} fill={`url(#spark-${w.id})`} strokeWidth={2} dot={false} />
</AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {w.thresholds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {w.thresholds.map((t, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: t.color + '20', color: t.color, border: `1px solid ${t.color}40` }}>{t.label}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const widgetChart = (w: Widget) => {
    const data = w.chartType === 'pie'
      ? [
        { name: '≤ p95', value: chartData.filter(d => d.duration <= d.p95).length, color: '#10b981' },
        { name: 'p95-p99', value: chartData.filter(d => d.duration > d.p95 && d.duration <= d.p99).length, color: '#f59e0b' },
        { name: '> p99', value: chartData.filter(d => d.duration > d.p99).length, color: '#ef4444' },
      ]
      : chartData;

    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-center text-gray-400">
            <LineIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
            <p className="text-xs">No data yet</p>
          </div>
        </div>
      );
    }

    const renderChart = () => {
      switch (w.chartType) {
        case 'line':
          return (
            <LineChart data={data}>
              {w.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickLine={false} tickFormatter={(v) => fmtByWidget(w, v)} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [fmtByWidget(w, v), w.title]} />
              {w.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              <Line type="monotone" dataKey="duration" stroke={w.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name={w.title} />
              <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="p95" />
              {w.thresholds.map((t, i) => (
                <Line key={i} type="monotone" dataKey={() => t.value} stroke={t.color} strokeWidth={1} strokeDasharray="6 3" dot={false} name={t.label} />
              ))}
            </LineChart>
          );
        case 'bar':
          return (
            <BarChart data={data} margin={{ top: 5, bottom: 5 }}>
              {w.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
              <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#9ca3af" tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickLine={false} tickFormatter={(v) => fmtByWidget(w, v)} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [fmtByWidget(w, v), w.title]} />
              {w.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              <Bar dataKey="duration" fill={w.color} radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          );
        case 'area':
          return (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={w.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={w.color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {w.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
              <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#9ca3af" tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickLine={false} tickFormatter={(v) => fmtByWidget(w, v)} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [fmtByWidget(w, v), w.title]} />
              {w.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              <Area type="monotone" dataKey="duration" stroke={w.color} strokeWidth={2} fill={`url(#grad-${w.id})`} dot={false} />
              {w.thresholds.map((t, i) => (
                <Line key={i} type="monotone" dataKey={() => t.value} stroke={t.color} strokeWidth={1} strokeDasharray="6 3" dot={false} name={t.label} />
              ))}
            </AreaChart>
          );
        case 'pie':
          return (
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.map((entry: any, i) => <Cell key={i} fill={entry.color || PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              {w.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
            </PieChart>
          );
      }
    };

    return (
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    );
  };

  const renderWidget = (w: Widget) => {
    return (
      <Card key={w.id} padding="md" className="hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{w.title}</h3>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono uppercase">{w.chartType}</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openEdit(w)} className="p-1.5 text-gray-400 hover:text-brand-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Edit">
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => removeWidget(w.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Remove">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {w.widgetType === 'stat' ? widgetStat(w) : widgetChart(w)}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-800 text-[10px] text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{TIME_RANGES.find(r => r.value === w.timeRange)?.label || w.timeRange}</span>
          <span className="ml-auto">{w.metric.replace(/_/g, ' ')}</span>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
          <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard Builder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {widgets.length} widget{widgets.length !== 1 ? 's' : ''} &middot; {trendData.length} data points
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {TIME_RANGES.slice(0, 4).map(r => (
              <button key={r.value} onClick={() => setGlobalRange(r.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${globalRange === r.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >{r.label}</button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRefreshKey(k => k + 1)} title="Refresh data">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dashboard selector bar */}
      <div className="flex items-center gap-3 mb-6 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <Folder className="w-4 h-4 text-gray-400 shrink-0" />
        <Select value={currentId || ''} onChange={(v) => { const d = dashboards.find(x => x.id === v); if (d) selectDashboard(d); }}
          options={[
            { label: '-- New Dashboard --', value: '' },
            ...dashboards.map(d => ({ label: `${d.name} ${d.id === currentId ? '(current)' : ''}`, value: d.id })),
          ]}
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <input value={dashboardName} onChange={(e) => { setDashboardName(e.target.value); setDirty(true); }}
            className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500 w-48 text-gray-900 dark:text-gray-100" />
          <Button size="sm" variant="ghost" onClick={newDashboard} title="New dashboard"><Folder className="w-4 h-4" /></Button>
          {currentId && <Button size="sm" variant="ghost" onClick={saveAsNew} disabled={saving}><Copy className="w-4 h-4" /></Button>}
          {currentId && <Button size="sm" variant="ghost" onClick={deleteDashboard} className="!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"><Trash2 className="w-4 h-4" /></Button>}
        </div>
      </div>

      {/* Add/Edit Widget Panel */}
      {showAdd && (
        <Card padding="md" className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: newColor }} />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editWidget ? 'Edit Widget' : 'Add Widget'}</h3>
            <button onClick={() => { setShowAdd(false); setEditWidget(null); }} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Title</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Metric</label>
              <Select value={newMetric} onChange={(v) => { setNewMetric(v); const m = METRICS.find(x => x.value === v); if (m) setNewColor(m.color); }}
                options={METRICS.map(m => ({ label: m.label, value: m.value }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Type</label>
              <div className="flex gap-1">
                {WIDGET_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNewWidgetType(t.value as any)}
                    className={`flex-1 text-[10px] px-2 py-2 rounded-lg border transition-all ${
                      newWidgetType === t.value ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/20 text-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >{t.label}</button>
                ))}
              </div>
            </div>
            {newWidgetType === 'chart' && (
              <div>
                <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Chart</label>
                <div className="flex gap-1">
                  {CHART_TYPES.map(c => (
                    <button key={c.value} onClick={() => setNewChartType(c.value as any)}
                      className={`flex items-center gap-1 text-[10px] px-2 py-2 rounded-lg border transition-all ${
                        newChartType === c.value ? 'bg-brand-50 dark:bg-brand-950/20 border-brand-400 text-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    ><c.icon className="w-3 h-3" />{c.label}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Color</label>
              <div className="flex gap-1 flex-wrap">
                {PALETTE.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Thresholds</label>
              <div className="flex gap-1">
                <input value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addThreshold(); }}
                  placeholder="ms"
                  className="flex-1 text-xs bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-brand-500 w-16 text-gray-900 dark:text-gray-100" />
                <button onClick={addThreshold} disabled={!newThreshold} className="text-[10px] px-2 py-2 bg-brand-500 text-white rounded-lg disabled:opacity-40"><Plus className="w-3 h-3" /></button>
              </div>
              {thresholds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {thresholds.map((t, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: t.color + '20', color: t.color }}>
                      {t.label}
                      <button onClick={() => setThresholds(thresholds.filter((_, j) => j !== i))} className="hover:opacity-60"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setEditWidget(null); }}>Cancel</Button>
            <Button size="sm" onClick={commitAddWidget}>
              <Check className="w-3.5 h-3.5" /> {editWidget ? 'Update' : 'Add'}
            </Button>
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" onClick={() => { setEditWidget(null); setNewTitle(''); setNewMetric('http_req_duration'); setNewWidgetType('chart'); setNewChartType('line'); setNewColor('#6366f1'); setThresholds([]); setShowAdd(!showAdd); }}>
          <Plus className="w-3.5 h-3.5" /> {showAdd ? 'Close' : 'Add Widget'}
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={saveDashboard} disabled={saving || !dirty}>
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Widget Grid */}
      {widgets.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Start building your dashboard</h3>
            <p className="text-sm text-gray-400 mb-4">Add charts and stat cards to visualize your performance metrics.</p>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" /> Add your first widget
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map(w => renderWidget(w))}
        </div>
      )}
    </div>
  );
}