import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { BarChart3, Download, AlertTriangle, CheckCircle, Activity, Clock, ArrowLeft, RefreshCw, FileText } from 'lucide-react';

interface Breach {
  id: string;
  metric: string;
  actualValue: number;
  threshold: number;
  message: string | null;
  breachedAt: string;
  slaRule: { id: string; name: string; metric: string; threshold: number; condition: string };
  run: { id: string; status: string; createdAt: string } | null;
}

export default function SlaReport() {
  useTitle('SLA Report');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  const load = async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const [breachData, reportData] = await Promise.all([
        api.getSlaBreaches(pid),
        api.getSlaReport(pid),
      ]);
      setBreaches(breachData);
      setReport(reportData);
    } catch { toast.error('Failed to load SLA data'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pid]);

  const refreshReport = async () => {
    if (!pid) return;
    setReportLoading(true);
    try {
      const [breachData, reportData] = await Promise.all([
        api.getSlaBreaches(pid),
        api.getSlaReport(pid),
      ]);
      setBreaches(breachData);
      setReport(reportData);
    } catch { toast.error('Failed to refresh'); }
    setReportLoading(false);
  };

  const exportCsv = () => {
    if (breaches.length === 0) return;
    const headers = 'Rule,Metric,Actual,Threshold,Breached At,Run ID\n';
    const rows = breaches.map((b) =>
      `"${b.slaRule.name}","${b.metric}",${b.actualValue.toFixed(2)},${b.threshold},"${new Date(b.breachedAt).toISOString()}","${b.run?.id || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sla-breaches-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const formatMetric = (m: string) => m.replace(/http_req_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const conditionLabel = (c: string) => ({ lt: '<', lte: '<=', gt: '>', gte: '>=' }[c] || c);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="SLA Reports"
        subtitle="Compliance report and breach history"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/sla`)}>
              <ArrowLeft className="w-4 h-4" /> SLA Rules
            </Button>
            <Button size="sm" variant="secondary" onClick={refreshReport} disabled={reportLoading}>
              <RefreshCw className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={breaches.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Card key={i} padding="md"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}</div>
      ) : (
        <>
          {report && (
            <div className="grid grid-cols-5 gap-4 mb-6">
              <StatCard title="Overall Compliance" value={`${report.overallCompliance}%`} icon={<CheckCircle className="w-5 h-5" />} variant={report.overallCompliance >= 99 ? 'success' : report.overallCompliance >= 95 ? 'warning' : 'danger'} />
              <StatCard title="Rules" value={report.totalRules} icon={<FileText className="w-5 h-5" />} />
              <StatCard title="Enabled" value={report.enabledRules} icon={<Activity className="w-5 h-5" />} />
              <StatCard title="Total Breaches" value={report.totalBreaches} icon={<AlertTriangle className="w-5 h-5" />} variant={report.totalBreaches > 0 ? 'danger' : 'success'} />
              <StatCard title="Window" value={report.reportWindow} icon={<Clock className="w-5 h-5" />} />
            </div>
          )}

          {report?.rules?.filter((r: any) => r.enabled).length > 0 && (
            <Card padding="md" className="mb-6">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-500" /> Per-Rule Compliance
              </h3>
              <div className="space-y-3">
                {report.rules.filter((r: any) => r.enabled).map((r: any) => {
                  const pct = r.compliancePercent;
                  return (
                    <div key={r.ruleId}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{r.name}</span>
                        <span className={pct >= 99 ? 'text-green-600' : pct >= 95 ? 'text-amber-600' : 'text-red-600'}>{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 99 ? 'bg-green-500' : pct >= 95 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1 text-[10px] text-gray-400">
                        <span>{r.compliantRuns}/{r.totalRuns} compliant runs</span>
                        <span>{r.metric.replace(/http_req_/, '')} {conditionLabel(r.condition)} {r.threshold}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {breaches.length === 0 ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto text-green-300 dark:text-green-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No SLA breaches</p>
                <p className="text-xs text-gray-400 mt-1">All SLA rules are currently compliant.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Breach History ({breaches.length})
              </h3>
              {breaches.map((b) => (
                <Card key={b.id} padding="md" className="border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{b.slaRule.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{formatMetric(b.metric)}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Actual: <strong className="text-red-600">{b.actualValue.toFixed(2)}</strong> · Threshold: {conditionLabel(b.slaRule.condition)} {b.threshold}
                        {b.message && <span className="ml-2">{b.message}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(b.breachedAt).toLocaleString()}
                        {b.run && <span className="ml-2">Run: <span className="font-mono">{b.run.id.slice(0, 8)}…</span></span>}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
