import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { Button } from '../components/ui';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, RefreshCw, ArrowLeft } from 'lucide-react';

interface Anomaly {
  runId: string;
  metric: string;
  value: number;
  mean: number;
  stdDev: number;
  severity: 'high' | 'medium';
  message: string;
}

export default function AnomalyDetection() {
  useTitle('Anomaly Detection');
  const { pid, sid } = useParams();
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptName, setScriptName] = useState('');

  const load = async () => {
    if (!sid) return;
    setLoading(true);
    setError(null);
    try {
      const [data, script] = await Promise.all([
        api.getAnomalies(sid),
        api.getScript(sid).catch(() => null),
      ]);
      if (data.anomalies) setAnomalies(data.anomalies);
      if (data.totalRuns) setTotalRuns(data.totalRuns);
      if (script) setScriptName(script.name);
    } catch (err: any) {
      setError(err.message || 'Failed to load anomalies');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [sid]);

  const severityColor = (s: string) => {
    switch (s) {
      case 'high': return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' };
      case 'medium': return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
      default: return { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600', dot: 'bg-gray-400' };
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Anomaly Detection"
        subtitle={scriptName || `Script ${(sid || '').slice(0, 8)}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/plans`)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Anomalies Found" value={anomalies.length} icon={<AlertTriangle className="w-5 h-5" />} variant={anomalies.length > 0 ? 'danger' : 'success'} />
        <StatCard title="Runs Analyzed" value={totalRuns} icon={<Activity className="w-5 h-5" />} />
        <StatCard title="High Severity" value={anomalies.filter((a) => a.severity === 'high').length} icon={<TrendingUp className="w-5 h-5" />} variant={anomalies.some((a) => a.severity === 'high') ? 'danger' : 'success'} />
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analyzing runs for anomalies...</p>
        </div>
      )}

      {error && (
        <Card padding="md" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </Card>
      )}

      {!loading && !error && anomalies.length === 0 && (
        <Card padding="lg">
          <div className="text-center py-8">
            <TrendingDown className="w-12 h-12 mx-auto text-green-300 dark:text-green-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No anomalies detected</p>
            <p className="text-xs text-gray-400 mt-1">All runs are within normal statistical bounds.</p>
          </div>
        </Card>
      )}

      {!loading && anomalies.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Flagged Anomalies</h3>
          {anomalies.map((a, i) => {
            const c = severityColor(a.severity);
            const direction = a.value > a.mean ? 'up' : 'down';
            return (
              <Card key={i} padding="md" className={`${c.bg} ${c.border}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <span className={`font-semibold text-sm ${c.text}`}>{a.metric}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase ${c.bg} ${c.text} border ${c.border}`}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 font-mono">{a.message}</p>
                    <p className="text-xs text-gray-500 mt-1">Run: <span className="font-mono">{a.runId.slice(0, 8)}...</span></p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-1">
                      {direction === 'up' ? <TrendingUp className={`w-4 h-4 ${c.text}`} /> : <TrendingDown className={`w-4 h-4 ${c.text}`} />}
                      <span className={`text-lg font-bold ${c.text}`}>{((a.value - a.mean) / a.mean * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-[10px] text-gray-400">vs baseline</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-[11px] text-gray-500">
                  <span>Value: <strong>{a.value.toFixed(2)}</strong></span>
                  <span>Mean: <strong>{a.mean.toFixed(2)}</strong></span>
                  <span>σ: <strong>{a.stdDev.toFixed(2)}</strong></span>
                  <span>z-score: <strong>{((a.value - a.mean) / a.stdDev).toFixed(1)}</strong></span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
