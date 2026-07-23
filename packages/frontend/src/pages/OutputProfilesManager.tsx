import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, FieldWrapper, Select } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { Share2, Plus, Trash2, Edit3, CheckCircle, AlertTriangle, Play, Check, Shield, Eye, EyeOff } from 'lucide-react';

const OUTPUT_PROFILE_TYPES = [
  { value: 'influxdb-v2', label: 'InfluxDB v2 (xk6)', icon: '🗄️', desc: 'Send real-time metrics using xk6-output-influxdb' },
  { value: 'influxdb', label: 'InfluxDB v1', icon: '🗄️', desc: 'Send metrics to InfluxDB v1 /write endpoint' },
  { value: 'prometheus', label: 'Prometheus Remote Write', icon: '📊', desc: 'Stream metrics to Prometheus remote write URL' },
  { value: 'elasticsearch', label: 'Elasticsearch (xk6)', icon: '🔍', desc: 'Stream metrics to Elasticsearch indices' },
  { value: 'kafka', label: 'Apache Kafka (xk6)', icon: '📨', desc: 'Publish real-time metrics to Kafka brokers' },
  { value: 'dynatrace', label: 'Dynatrace', icon: '🔵', desc: 'Send telemetry directly to Dynatrace APM' },
  { value: 'cloudwatch', label: 'Amazon CloudWatch', icon: '🌩️', desc: 'Send metrics to AWS CloudWatch' },
];

export default function OutputProfilesManager() {
  useTitle('Output Profiles');
  const { pid } = useParams();
  const toast = useToastStore();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [outputType, setOutputType] = useState('influxdb-v2');
  const [isDefault, setIsDefault] = useState(false);
  const [configFields, setConfigFields] = useState<Record<string, string>>({
    url: 'http://localhost:8086',
    org: '',
    bucket: 'k6',
    token: '',
  });

  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await api.listOutputProfiles(pid);
      setProfiles(data);
    } catch {
      toast.error('Failed to load output profiles');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [pid]);

  const resetForm = () => {
    setName('');
    setOutputType('influxdb-v2');
    setIsDefault(false);
    setConfigFields({ url: 'http://localhost:8086', org: '', bucket: 'k6', token: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (profile: any) => {
    setName(profile.name);
    setOutputType(profile.outputType);
    setIsDefault(profile.isDefault);
    let parsed: Record<string, string> = {};
    try {
      parsed = typeof profile.configJson === 'string' ? JSON.parse(profile.configJson) : profile.configJson;
    } catch {
      parsed = {};
    }
    setConfigFields(parsed);
    setEditingId(profile.id);
    setShowForm(true);
  };

  const handleTypeChange = (type: string) => {
    setOutputType(type);
    if (type === 'influxdb-v2') {
      setConfigFields({ url: 'http://localhost:8086', org: '', bucket: 'k6', token: '' });
    } else if (type === 'influxdb') {
      setConfigFields({ url: 'http://localhost:8086/k6db' });
    } else if (type === 'prometheus') {
      setConfigFields({ url: 'https://prometheus.example.com/api/v1/write' });
    } else if (type === 'elasticsearch') {
      setConfigFields({ url: 'http://localhost:9200' });
    } else if (type === 'kafka') {
      setConfigFields({ brokers: 'localhost:9092', topic: 'k6-metrics' });
    } else if (type === 'dynatrace') {
      setConfigFields({ url: 'https://abc.live.dynatrace.com', apiToken: '' });
    } else {
      setConfigFields({ url: '' });
    }
  };

  const handleFieldChange = (key: string, val: string) => {
    setConfigFields((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!pid || !name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name,
        outputType,
        configJson: configFields,
        isDefault,
      };
      if (editingId) {
        await api.updateOutputProfile(editingId, payload);
        toast.success('Output profile updated successfully');
      } else {
        await api.createOutputProfile(pid, payload);
        toast.success('Output profile created successfully');
      }
      resetForm();
      load();
    } catch {
      toast.error('Failed to save output profile');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteOutputProfile(deleteTarget);
      toast.success('Output profile deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Failed to delete output profile');
    }
  };

  const handleTestConnection = async (profileId: string) => {
    setTestingId(profileId);
    try {
      const res = await api.testOutputProfile(profileId);
      if (res.status === 'success') {
        toast.success(res.message || 'Connection successful!');
      } else {
        toast.error(res.message || 'Connection failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to test connection');
    }
    setTestingId(null);
  };

  const toggleShowToken = (id: string) => {
    const next = new Set(showTokens);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setShowTokens(next);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Reusable Output Profiles"
        subtitle="Centralize external database & observability targets (InfluxDB, Prometheus, Kafka) to share across multiple Test Plans"
        breadcrumbs={[{ label: 'Test Plans', to: `/projects/${pid}/plans` }, { label: 'Output Profiles' }]}
        actions={
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-xl shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Output Profile
          </Button>
        }
      />

      {/* Pro-Tip Banner */}
      <div className="bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-transparent border border-brand-500/20 rounded-xl p-4 flex items-start gap-3">
        <Share2 className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Why use Reusable Output Profiles?</p>
          <p className="mt-1">
            Instead of re-entering credentials and endpoint URLs inside every single Test Plan, configure them once right here.
            You can also mark one profile as your <strong>Project Default</strong>, and all new test configurations will automatically inherit it when triggered!
          </p>
        </div>
      </div>

      {showForm && (
        <Card padding="lg" className="border-2 border-brand-500/30">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg text-gray-900 dark:text-gray-100">
            <Share2 className="w-5 h-5 text-brand-500" />
            {editingId ? 'Edit Output Profile' : 'Create Output Profile'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldWrapper label="Profile Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production InfluxDB v2 (Staging Cluster)"
              />
            </FieldWrapper>

            <FieldWrapper label="Output Type / Extension">
              <Select
                value={outputType}
                onChange={(v) => handleTypeChange(v)}
                options={OUTPUT_PROFILE_TYPES.map((t) => ({ label: `${t.icon} ${t.label}`, value: t.value }))}
              />
            </FieldWrapper>

            {/* Dynamic Fields */}
            {outputType === 'influxdb-v2' && (
              <>
                <FieldWrapper label="InfluxDB URL">
                  <Input
                    value={configFields.url || ''}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    placeholder="http://192.168.16.54:8086"
                  />
                </FieldWrapper>
                <FieldWrapper label="Organization">
                  <Input
                    value={configFields.org || ''}
                    onChange={(e) => handleFieldChange('org', e.target.value)}
                    placeholder="Yethi"
                  />
                </FieldWrapper>
                <FieldWrapper label="Bucket Name">
                  <Input
                    value={configFields.bucket || ''}
                    onChange={(e) => handleFieldChange('bucket', e.target.value)}
                    placeholder="jmeter"
                  />
                </FieldWrapper>
                <FieldWrapper label="API Token (Secret)">
                  <Input
                    type="password"
                    value={configFields.token || ''}
                    onChange={(e) => handleFieldChange('token', e.target.value)}
                    placeholder="InfluxDB API token"
                  />
                </FieldWrapper>
              </>
            )}

            {outputType === 'influxdb' && (
              <div className="md:col-span-2">
                <FieldWrapper label="InfluxDB v1 Write URL">
                  <Input
                    value={configFields.url || ''}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    placeholder="http://user:pass@localhost:8086/k6db"
                  />
                </FieldWrapper>
              </div>
            )}

            {outputType === 'prometheus' && (
              <div className="md:col-span-2">
                <FieldWrapper label="Prometheus Remote Write URL">
                  <Input
                    value={configFields.url || ''}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    placeholder="https://prometheus.example.com/api/v1/write"
                  />
                </FieldWrapper>
              </div>
            )}

            {outputType === 'elasticsearch' && (
              <div className="md:col-span-2">
                <FieldWrapper label="Elasticsearch URL">
                  <Input
                    value={configFields.url || ''}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    placeholder="http://localhost:9200"
                  />
                </FieldWrapper>
              </div>
            )}

            {outputType === 'kafka' && (
              <>
                <FieldWrapper label="Kafka Broker Addresses">
                  <Input
                    value={configFields.brokers || ''}
                    onChange={(e) => handleFieldChange('brokers', e.target.value)}
                    placeholder="broker1:9092,broker2:9092"
                  />
                </FieldWrapper>
                <FieldWrapper label="Kafka Topic">
                  <Input
                    value={configFields.topic || ''}
                    onChange={(e) => handleFieldChange('topic', e.target.value)}
                    placeholder="k6-metrics"
                  />
                </FieldWrapper>
              </>
            )}

            {outputType === 'dynatrace' && (
              <>
                <FieldWrapper label="Dynatrace Environment URL">
                  <Input
                    value={configFields.url || ''}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    placeholder="https://abc.live.dynatrace.com"
                  />
                </FieldWrapper>
                <FieldWrapper label="API Token">
                  <Input
                    type="password"
                    value={configFields.apiToken || ''}
                    onChange={(e) => handleFieldChange('apiToken', e.target.value)}
                    placeholder="dt0c01..."
                  />
                </FieldWrapper>
              </>
            )}

            <div className="md:col-span-2 mt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span>Set as Project Default Output Profile</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-0.5">
                When enabled, any test configuration without an explicitly assigned output will automatically stream to this target.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t dark:border-gray-700">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md"><div className="h-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
      ) : profiles.length === 0 && !showForm ? (
        <Card padding="lg">
          <div className="text-center py-10 text-gray-400 dark:text-gray-500">
            <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-brand-500" />
            <p className="font-medium text-gray-800 dark:text-gray-200 text-base">No reusable output profiles yet</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Create your first output profile to centralize your InfluxDB, Prometheus, or Kafka configurations so you don't have to enter them repeatedly.
            </p>
            <Button className="mt-4" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Create First Profile
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((profile) => {
            let parsed: Record<string, string> = {};
            try { parsed = typeof profile.configJson === 'string' ? JSON.parse(profile.configJson) : profile.configJson; } catch {}
            const typeInfo = OUTPUT_PROFILE_TYPES.find((t) => t.value === profile.outputType);

            return (
              <Card key={profile.id} padding="md" hover className={`flex flex-col justify-between h-full ${profile.isDefault ? 'ring-2 ring-brand-500/50 dark:ring-brand-400/50' : ''}`}>
                <div>
                  <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0">{typeInfo?.icon || '📦'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base">{profile.name}</h3>
                        {profile.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center gap-1">
                            <Check className="w-3 h-3" /> DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                        {typeInfo?.label || profile.outputType}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuration Summary */}
                <div className="mt-3 pt-3 border-t dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                  {parsed.url && (
                    <div className="flex justify-between truncate">
                      <span className="text-gray-500 dark:text-gray-400">Endpoint:</span>
                      <span className="text-gray-800 dark:text-gray-200 truncate max-w-[240px] font-medium">{parsed.url}</span>
                    </div>
                  )}
                  {parsed.bucket && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Bucket:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{parsed.bucket}</span>
                    </div>
                  )}
                  {parsed.org && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Organization:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{parsed.org}</span>
                    </div>
                  )}
                  {parsed.brokers && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Brokers:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{parsed.brokers}</span>
                    </div>
                  )}
                  {parsed.token && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Token:</span>
                      <button
                        type="button"
                        onClick={() => toggleShowToken(profile.id)}
                        className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-brand-500"
                      >
                        {showTokens.has(profile.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showTokens.has(profile.id) ? parsed.token : '••••••••••••'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTestConnection(profile.id)}
                    disabled={testingId === profile.id}
                    className="text-xs"
                  >
                    <Play className={`w-3 h-3 mr-1 ${testingId === profile.id ? 'animate-spin' : ''}`} />
                    {testingId === profile.id ? 'Testing...' : 'Test Connection'}
                  </Button>

                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(profile)}>
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(profile.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Output Profile"
        message="Are you sure you want to delete this output profile? Any test configs assigned to this profile will fall back to default behavior."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
