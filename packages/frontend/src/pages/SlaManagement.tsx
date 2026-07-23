import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { Button, Input, Select } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, FileText, AlertTriangle, CheckCircle, Activity, ToggleLeft, ToggleRight, Trash2, ArrowLeft, RefreshCw, BarChart3, Clock, Download } from 'lucide-react';

interface SlaRule {
  id: string;
  name: string;
  description: string | null;
  metric: string;
  condition: string;
  threshold: number;
  timeWindow: number;
  scriptId: string | null;
  enabled: boolean;
  script: { id: string; name: string } | null;
  _count: { breaches: number };
  createdAt: string;
}

const METRICS = [
  { value: 'http_req_duration', label: 'Request Duration' },
  { value: 'http_req_failed', label: 'Error Rate' },
  { value: 'http_reqs', label: 'Throughput' },
  { value: 'iterations', label: 'Iterations' },
];

const CONDITIONS = [
  { value: 'lt', label: '< (less than)' },
  { value: 'lte', label: '<= (less or equal)' },
  { value: 'gt', label: '> (greater than)' },
  { value: 'gte', label: '>= (greater or equal)' },
];

const CONDITION_SYMBOLS: Record<string, string> = { lt: '<', lte: '<=', gt: '>', gte: '>=' };

export default function SlaManagement() {
  useTitle('SLA Management');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SlaRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', metric: 'http_req_duration', condition: 'lt', threshold: 200, timeWindow: 24, scriptId: '',
  });

  const loadRules = async () => {
    if (!pid) return;
    setLoading(true);
    try { setRules(await api.listSlaRules(pid)); }
    catch { toast.error('Failed to load SLA rules'); }
    setLoading(false);
  };

  const loadStatus = useCallback(async () => {
    if (!pid) return;
    try {
      const data = await api.getSlaStatus(pid);
      setStatusData(data.statuses || []);
    } catch { /* ignore */ }
  }, [pid]);

  const loadReport = async () => {
    if (!pid) return;
    setReportLoading(true);
    try {
      const data = await api.getSlaReport(pid);
      setReportData(data);
    } catch { toast.error('Failed to generate report'); }
    setReportLoading(false);
  };

  useEffect(() => {
    loadRules();
    loadStatus();
  }, [pid, loadStatus]);

  // Auto-poll status every 15s when there are enabled rules
  useEffect(() => {
    if (!pid || rules.length === 0) return;
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [pid, rules.length, loadStatus]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', metric: 'http_req_duration', condition: 'lt', threshold: 200, timeWindow: 24, scriptId: '' });
    setShowForm(true);
  };

  const openEdit = (rule: SlaRule) => {
    setEditing(rule);
    setForm({ name: rule.name, description: rule.description || '', metric: rule.metric, condition: rule.condition, threshold: rule.threshold, timeWindow: rule.timeWindow, scriptId: rule.scriptId || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pid || !form.name) return;
    try {
      const data: any = { name: form.name, description: form.description || undefined, metric: form.metric, condition: form.condition, threshold: form.threshold, timeWindow: form.timeWindow, scriptId: form.scriptId || null };
      if (editing) {
        await api.updateSlaRule(editing.id, data);
        toast.success('SLA rule updated');
      } else {
        await api.createSlaRule(pid, data);
        toast.success('SLA rule created');
      }
      setShowForm(false);
      setEditing(null);
      loadRules();
    } catch { toast.error('Failed to save SLA rule'); }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleSlaRule(id);
      loadRules();
    } catch { toast.error('Failed to toggle'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSlaRule(deleteTarget);
      toast.success('SLA rule deleted');
      setDeleteTarget(null);
      loadRules();
    } catch { toast.error('Failed to delete'); }
  };

  const formatMetric = (m: string) => m.replace(/http_req_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const compliantCount = statusData.filter((s) => s.compliant).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="SLA Management"
        subtitle="Define and monitor Service Level Agreements for your performance tests"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={loadStatus}>
              <RefreshCw className="w-4 h-4" /> Check Status
            </Button>
            <Button size="sm" variant="secondary" onClick={loadReport} disabled={reportLoading}>
              <BarChart3 className="w-4 h-4" /> Generate Report
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/sla/report`)}>
              <FileText className="w-4 h-4" /> View Full Report
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> New SLA
            </Button>
          </div>
        }
      />

      {statusData.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard title="Compliant" value={compliantCount} icon={<CheckCircle className="w-5 h-5" />} variant={compliantCount === statusData.length ? 'success' : 'default'} />
          <StatCard title="At Risk" value={statusData.length - compliantCount} icon={<AlertTriangle className="w-5 h-5" />} variant={compliantCount < statusData.length ? 'danger' : 'default'} />
          <StatCard title="Rules Active" value={statusData.length} icon={<Activity className="w-5 h-5" />} />
          <StatCard title="Metrics Tracked" value={new Set(statusData.map((s) => s.metric)).size} icon={<BarChart3 className="w-5 h-5" />} />
        </div>
      )}

      {reportData && (
        <Card padding="md" className="mb-6 border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-500" /> SLA Compliance Report
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {reportData.totalRules} rules · {reportData.enabledRules} enabled · {reportData.totalBreaches} total breaches · Overall compliance: <strong className={`${reportData.overallCompliance >= 99 ? 'text-green-600' : reportData.overallCompliance >= 95 ? 'text-amber-600' : 'text-red-600'}`}>{reportData.overallCompliance}%</strong>
              </p>
              <div className="flex flex-wrap gap-4 mt-2">
                {reportData.rules?.filter((r: any) => r.enabled).map((r: any) => (
                  <div key={r.ruleId} className="text-xs">
                    <span className="text-gray-500">{r.name}: </span>
                    <span className={`font-medium ${r.compliancePercent >= 99 ? 'text-green-600' : r.compliancePercent >= 95 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.compliancePercent}%
                    </span>
                    <span className="text-gray-400 ml-1">({r.totalRuns} runs)</span>
                  </div>
                ))}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setReportData(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Card key={i} padding="md"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}</div>
      ) : rules.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No SLA rules yet</p>
            <p className="text-xs text-gray-400 mt-1">Define SLAs to track compliance and get notified of breaches.</p>
            <Button size="sm" className="mt-4" onClick={openCreate}><Plus className="w-4 h-4" /> Create SLA Rule</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const status = statusData.find((s) => s.ruleId === rule.id);
            return (
              <Card key={rule.id} padding="md" className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className={`font-medium text-sm ${rule.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>{rule.name}</span>
                      {rule.script && <span className="text-xs text-gray-400 font-mono">{rule.script.name}</span>}
                    </div>
                    {rule.description && <p className="text-xs text-gray-500 mt-1">{rule.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span><strong>{formatMetric(rule.metric)}</strong> {CONDITION_SYMBOLS[rule.condition]} <strong>{rule.threshold}</strong></span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {rule.timeWindow}h window</span>
                      <span>{rule._count.breaches} breach{rule._count.breaches !== 1 ? 'es' : ''}</span>
                      {status && (
                        <span className={`flex items-center gap-1 ${status.compliant ? 'text-green-600' : 'text-red-600'}`}>
                          {status.compliant ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {status.compliant ? 'Compliant' : `Violated (${status.actualValue?.toFixed(1)})`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(rule.id)} title={rule.enabled ? 'Disable' : 'Enable'}>
                      {rule.enabled ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)} title="Edit">
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(rule.id)} title="Delete" className="hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{editing ? 'Edit SLA Rule' : 'Create SLA Rule'}</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. P95 must be under 200ms" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric</label>
                  <Select value={form.metric} onChange={(value) => setForm({ ...form, metric: value })} options={METRICS} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condition</label>
                  <Select value={form.condition} onChange={(value) => setForm({ ...form, condition: value })} options={CONDITIONS} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Threshold</label>
                  <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Window (hours)</label>
                  <Input type="number" value={form.timeWindow} onChange={(e) => setForm({ ...form, timeWindow: parseInt(e.target.value) || 24 })} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name}>{editing ? 'Update' : 'Create'} Rule</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete SLA Rule"
        message="This will permanently delete this SLA rule and its breach history." confirmLabel="Delete" variant="danger"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
