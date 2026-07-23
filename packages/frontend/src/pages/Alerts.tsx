import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, FieldWrapper, Select } from '../components/ui';
import { Bell, BellOff, Plus, Trash2, Pencil, AlertTriangle, Clock, CheckCircle, XCircle, History } from 'lucide-react';

interface AlertRule {
  id: string; name: string; description: string | null; metricName: string;
  condition: string; threshold: number; channelType: string;
  channelConfig: Record<string, unknown>; enabled: boolean;
  lastTriggeredAt: string | null; createdAt: string;
}

interface AlertEvent {
  id: string; alertRuleId: string; runId: string | null; metricName: string;
  metricValue: number; condition: string; threshold: number;
  channelType: string; sent: boolean; error: string | null;
  createdAt: string; alertRule: { name: string };
}

const CONDITION_LABELS: Record<string, string> = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '=' };
const CHANNEL_LABELS: Record<string, string> = { slack: 'Slack', webhook: 'Webhook', email: 'Email' };

const emptyForm = {
  name: '', description: '', metricName: 'http_req_duration',
  condition: 'gt', threshold: 500, channelType: 'slack',
  channelConfig: {} as Record<string, unknown>,
};

export default function Alerts() {
  useTitle('Alerts');
  const { pid } = useParams();
  const token = useAuthStore((s) => s.token);
  const toast = useToastStore();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, e] = await Promise.all([
        fetch(`/api/v1/projects/${pid}/alerts`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/projects/${pid}/alerts/history`, { headers }).then((r) => r.json()),
      ]);
      setRules(r);
      setEvents(e);
    } catch {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [pid, token]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (rule: AlertRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      metricName: rule.metricName,
      condition: rule.condition,
      threshold: rule.threshold,
      channelType: rule.channelType,
      channelConfig: rule.channelConfig,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = JSON.stringify(form);
      if (editing) {
        const res = await fetch(`/api/v1/alerts/${editing.id}`, { method: 'PUT', headers, body });
        if (!res.ok) throw new Error();
        toast.success('Alert updated');
      } else {
        const res = await fetch(`/api/v1/projects/${pid}/alerts`, { method: 'POST', headers, body });
        if (!res.ok) throw new Error();
        toast.success('Alert created');
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch {
      toast.error('Failed to save alert');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (rule: AlertRule) => {
    try {
      const res = await fetch(`/api/v1/alerts/${rule.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error();
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
      toast.success(rule.enabled ? 'Alert disabled' : 'Alert enabled');
    } catch {
      toast.error('Failed to toggle alert');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert rule permanently?')) return;
    try {
      await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE', headers });
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Alert deleted');
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Alerts" subtitle="Configure threshold-based alerts for your test runs." />

      {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'rules' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
        >
          <Bell className="w-4 h-4 inline mr-1.5" />Rules
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
        >
          <History className="w-4 h-4 inline mr-1.5" />History
        </button>
      </div>

      {activeTab === 'rules' && (
        <>
          <div className="flex justify-end">
            <Button onClick={openCreate}><Plus className="w-4 h-4" />Add Alert</Button>
          </div>

          {/* Create/Edit Modal */}
          {showForm && (
            <Card padding="lg" className="border-brand-400">
              <form onSubmit={handleSave} className="space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{editing ? 'Edit Alert' : 'New Alert'}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldWrapper label="Name">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., High response time" required />
                  </FieldWrapper>

                  <FieldWrapper label="Metric">
                    <Input value={form.metricName} onChange={(e) => setForm({ ...form, metricName: e.target.value })} placeholder="e.g., http_req_duration" required />
                  </FieldWrapper>

                  <FieldWrapper label="Condition">
                    <Select
                      value={form.condition}
                      onChange={(v) => setForm({ ...form, condition: v })}
                      options={[
                        { label: '> (greater than)', value: 'gt' },
                        { label: '< (less than)', value: 'lt' },
                        { label: '>= (greater or equal)', value: 'gte' },
                        { label: '<= (less or equal)', value: 'lte' },
                        { label: '= (equal)', value: 'eq' },
                      ]}
                    />
                  </FieldWrapper>

                  <FieldWrapper label="Threshold">
                    <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} required />
                  </FieldWrapper>

                  <FieldWrapper label="Channel">
                    <Select
                      value={form.channelType}
                      onChange={(v) => {
                        const configs: Record<string, Record<string, unknown>> = {
                          slack: { webhookUrl: '' },
                          webhook: { url: '' },
                          email: { recipients: '' },
                        };
                        setForm({ ...form, channelType: v, channelConfig: configs[v] });
                      }}
                      options={[
                        { label: 'Slack', value: 'slack' },
                        { label: 'Webhook', value: 'webhook' },
                        { label: 'Email', value: 'email' },
                      ]}
                    />
                  </FieldWrapper>

                  {form.channelType === 'slack' && (
                    <FieldWrapper label="Slack Webhook URL">
                      <Input value={(form.channelConfig as any).webhookUrl || ''} onChange={(e) => setForm({ ...form, channelConfig: { ...form.channelConfig, webhookUrl: e.target.value } })} placeholder="https://hooks.slack.com/services/..." />
                    </FieldWrapper>
                  )}

                  {form.channelType === 'webhook' && (
                    <FieldWrapper label="Webhook URL">
                      <Input value={(form.channelConfig as any).url || ''} onChange={(e) => setForm({ ...form, channelConfig: { ...form.channelConfig, url: e.target.value } })} placeholder="https://example.com/webhook" />
                    </FieldWrapper>
                  )}

                  {form.channelType === 'email' && (
                    <FieldWrapper label="Recipients (comma-separated)">
                      <Input value={(form.channelConfig as any).recipients || ''} onChange={(e) => setForm({ ...form, channelConfig: { ...form.channelConfig, recipients: e.target.value } })} placeholder="team@example.com, admin@example.com" />
                    </FieldWrapper>
                  )}
                </div>

                <FieldWrapper label="Description (optional)">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                    rows={2}
                    placeholder="When should this alert trigger?"
                  />
                </FieldWrapper>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Card key={i} padding="md"><div className="h-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}
            </div>
          ) : rules.length === 0 ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No alert rules configured</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Add alerts to get notified when performance thresholds are breached.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <Card key={rule.id} padding="md">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{rule.name}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${rule.enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                          {rule.enabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{rule.metricName}</span>
                        <span className="font-mono">{CONDITION_LABELS[rule.condition] || rule.condition} {rule.threshold}</span>
                        <span>{CHANNEL_LABELS[rule.channelType] || rule.channelType}</span>
                        {rule.description && <span className="truncate hidden sm:inline">· {rule.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleEnabled(rule)}
                        className={`p-1.5 rounded-md transition-colors ${rule.enabled ? 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-gray-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        {rule.enabled ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(rule)} className="p-1.5 rounded-md text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Card key={i} padding="md"><div className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}
            </div>
          ) : events.length === 0 ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No alert events yet</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Alert events will appear here when thresholds are breached.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <Card key={ev.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded-full ${ev.sent ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'}`}>
                          {ev.sent ? <Bell className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        </span>
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{ev.alertRule.name}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{ev.metricName}</span>
                        <span className="font-mono">{ev.metricValue} {CONDITION_LABELS[ev.condition]} {ev.threshold}</span>
                        <span>{ev.sent ? 'Delivered' : 'Failed'}</span>
                        {ev.error && <span className="text-red-500 truncate">· {ev.error}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{new Date(ev.createdAt).toLocaleString()}</span>
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
