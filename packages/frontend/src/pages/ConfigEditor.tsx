import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { OutputConfig } from '@tenjint6/shared';
import OutputsManager from '../components/OutputsManager';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Tabs from '../components/Tabs';
import { Button, Select } from '../components/ui';
import {
  Save, X, Plus, Trash2, Users, Clock, Gauge, Sigma, Tags, Variable,
  TrendingUp, BarChart4, GitBranch, Eye, EyeOff, ChevronDown, ChevronUp,
  Copy, Activity, Share2,
} from 'lucide-react';

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
  return val ?? {};
}

type ExecutorType = 'constant-vus' | 'ramping-vus' | 'constant-arrival-rate' | 'ramping-arrival-rate' | 'externally-controlled';

const EXECUTOR_LABELS: Record<ExecutorType, string> = {
  'constant-vus': 'Constant VUs',
  'ramping-vus': 'Ramping VUs',
  'constant-arrival-rate': 'Constant Arrival Rate',
  'ramping-arrival-rate': 'Ramping Arrival Rate',
  'externally-controlled': 'Externally Controlled',
};

interface Stage {
  duration: string;
  target: number;
}

interface Scenario {
  name: string;
  executor: ExecutorType;
  startTime?: string;
  gracefulStop?: string;
  vus?: number;
  maxVus?: number;
  iterations?: number;
  maxDuration?: string;
  stages?: Stage[];
  startRate?: number;
  timeUnit?: string;
  preAllocatedVUs?: number;
  env?: Record<string, string>;
  tags?: Record<string, string>;
}

interface EnvVar {
  key: string;
  value: string;
  secret: boolean;
}

export default function ConfigEditor() {
  useTitle('Test Configuration');
  const { pid, sid, cid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const isNew = cid === 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [useSimpleMode, setUseSimpleMode] = useState(true);
  const [vus, setVus] = useState(10);
  const [duration, setDuration] = useState('30s');
  const [iterations, setIterations] = useState('');
  const [stages, setStages] = useState<Stage[]>([
    { duration: '2m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '2m', target: 0 },
  ]);
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { name: 'main', executor: 'constant-vus', vus: 10, maxDuration: '5m' },
  ]);
  const [thresholds, setThresholds] = useState<{ metric: string; expr: string }[]>([]);
  const [outputs, setOutputs] = useState<OutputConfig[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [tags, setTags] = useState<{ key: string; value: string }[]>([]);
  const [browser, setBrowser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [outputProfileId, setOutputProfileId] = useState<string | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (pid) {
      api.listOutputProfiles(pid).then(setAvailableProfiles).catch(console.error);
    }
    if (isNew || !cid) return;
    api.listConfigs(sid!).then((configs) => {
      const config = configs.find((c: any) => c.id === cid);
      if (!config) return;
      const opts = safeJson(config.options);
      setName(config.name);
      setDescription(config.description ?? '');
      setOutputProfileId(config.outputProfileId ?? null);
      setVus(opts.vus ?? 10);
      setDuration(opts.duration ?? '30s');
      setIterations(opts.iterations ?? '');
      setBrowser(opts.browser ?? false);
      setOutputs(opts.outputs || []);
      setStages(opts.stages || stages);
      setScenarios(opts.scenarios ? Object.entries(opts.scenarios).map(([name, s]: [string, any]) => ({ name, ...s })) : scenarios);
      setEnvVars(opts.env ? Object.entries(opts.env).map(([key, value]: [string, any]) => ({ key, value, secret: false })) : []);
      setTags(opts.tags ? Object.entries(opts.tags).map(([key, value]: [string, any]) => ({ key, value })) : []);
      setUseSimpleMode(!opts.scenarios);
      const th = Object.entries(opts.thresholds ?? {}).flatMap(([metric, exprs]: [string, any]) =>
        (Array.isArray(exprs) ? exprs : []).map((expr: string) => ({ metric, expr }))
      );
      setThresholds(th.length > 0 ? th : [{ metric: 'http_req_duration', expr: 'p(95)<500' }]);
    }).catch(console.error);
  }, [cid, sid, isNew]);

  const addThreshold = () => setThresholds([...thresholds, { metric: 'http_req_duration', expr: 'p(95)<500' }]);
  const removeThreshold = (idx: number) => setThresholds(thresholds.filter((_, i) => i !== idx));
  const updateThreshold = (idx: number, field: 'metric' | 'expr', value: string) =>
    setThresholds(thresholds.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));

  const addStage = () => setStages([...stages, { duration: '1m', target: 10 }]);
  const removeStage = (idx: number) => setStages(stages.filter((_, i) => i !== idx));
  const updateStage = (idx: number, field: 'duration' | 'target', value: string | number) =>
    setStages(stages.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '', secret: false }]);
  const removeEnvVar = (idx: number) => setEnvVars(envVars.filter((_, i) => i !== idx));
  const updateEnvVar = (idx: number, field: 'key' | 'value' | 'secret', value: string | boolean) =>
    setEnvVars(envVars.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));

  const addTag = () => setTags([...tags, { key: '', value: '' }]);
  const removeTag = (idx: number) => setTags(tags.filter((_, i) => i !== idx));
  const updateTag = (idx: number, field: 'key' | 'value', value: string) =>
    setTags(tags.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));

  const addScenario = () => setScenarios([...scenarios, { name: `scenario-${scenarios.length + 1}`, executor: 'constant-vus', vus: 5, maxDuration: '5m' }]);
  const removeScenario = (idx: number) => setScenarios(scenarios.filter((_, i) => i !== idx));
  const updateScenario = (idx: number, field: string, value: any) =>
    setScenarios(scenarios.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const handleSave = async () => {
    setSaving(true);
    try {
      const options: Record<string, any> = { browser, outputs };
      const cloudOut = outputs.find((o) => o.type === 'cloud' && o.enabled);
      if (cloudOut) options.cloud = true;
      const promOut = outputs.find((o) => o.type === 'prometheus' && o.enabled);
      const prometheusUrl = promOut?.config?.url || '';

      if (useSimpleMode) {
        options.vus = vus;
        options.duration = duration || undefined;
        if (iterations) options.iterations = parseInt(iterations, 10);
        if (stages.length > 1 || stages[0]?.target !== 10) {
          options.stages = stages;
        }
      } else {
        const scenariosObj: Record<string, any> = {};
        for (const s of scenarios) {
          const { name, ...scenario } = s;
          scenariosObj[name] = scenario;
        }
        options.scenarios = scenariosObj;
      }

      if (envVars.length > 0) {
        options.env = envVars.reduce<Record<string, string>>((acc, e) => {
          if (e.key) acc[e.key] = e.secret ? `\${__SECRET_${e.key}}` : e.value;
          return acc;
        }, {});
      }
      if (tags.length > 0) {
        options.tags = tags.reduce<Record<string, string>>((acc, t) => {
          if (t.key) acc[t.key] = t.value;
          return acc;
        }, {});
      }
      if (thresholds.length > 0) {
        options.thresholds = thresholds.reduce<Record<string, string[]>>((acc, t) => {
          if (!acc[t.metric]) acc[t.metric] = [];
          acc[t.metric].push(t.expr);
          return acc;
        }, {});
      }

      const payload = {
        name,
        description,
        options,
        prometheusPushUrl: prometheusUrl || undefined,
        outputProfileId: outputProfileId || null,
      };
      if (isNew) await api.createConfig(sid!, payload);
      else await api.updateConfig(cid!, payload);
      navigate(`/projects/${pid}/plans/${sid}`);
      toast.success('Configuration saved');
    } catch (err: any) {
      toast.error('Failed to save configuration', err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabItems: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Basic', icon: <Users className="w-4 h-4" /> },
    { id: 'load-profile', label: 'Load Profile', icon: <Activity className="w-4 h-4" /> },
    { id: 'scenarios', label: 'Scenarios', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'thresholds', label: 'Thresholds', icon: <Gauge className="w-4 h-4" /> },
    { id: 'env', label: 'Environment', icon: <Variable className="w-4 h-4" /> },
    { id: 'outputs', label: 'Outputs', icon: <BarChart4 className="w-4 h-4" /> },
  ];

  const maxStageTarget = Math.max(...stages.map(s => s.target), 1);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title={isNew ? 'New Configuration' : 'Edit Configuration'}
        subtitle="Configure test parameters, load profile, thresholds, and outputs"
        breadcrumbs={[
          { label: 'Test Plans', to: `/projects/${pid}/plans` },
          { label: isNew ? 'New Config' : 'Edit Config' },
        ]}
      />

      <div className="mb-4">
        <Tabs tabs={tabItems} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="space-y-6">
        {activeTab === 'basic' && (
          <Card padding="lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Configuration Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                  placeholder="My Test Config" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                  rows={2} placeholder="Optional description" />
              </div>
              <div className="flex items-center gap-2.5 pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={browser} onChange={(e) => setBrowser(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  Browser Test (k6 Browser Module)
                </label>
                <span className="text-xs text-gray-400">Enables Chromium-based browser testing</span>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'load-profile' && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Load Profile</h3>
              <button onClick={() => setUseSimpleMode(!useSimpleMode)}
                className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                {useSimpleMode ? <TrendingUp className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                Switch to {useSimpleMode ? 'Staged' : 'Simple'} Mode
              </button>
            </div>

            {useSimpleMode ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <Users className="w-3 h-3 inline mr-1" />Virtual Users
                  </label>
                  <input type="number" min={1} value={vus} onChange={(e) => setVus(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <Clock className="w-3 h-3 inline mr-1" />Duration
                  </label>
                  <input value={duration} onChange={(e) => setDuration(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                    placeholder="30s, 5m, 1h" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <Sigma className="w-3 h-3 inline mr-1" />Iterations (optional)
                  </label>
                  <input type="number" min={1} value={iterations} onChange={(e) => setIterations(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                    placeholder="Blank = time-based" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ramp Stages</span>
                  <Button variant="ghost" size="sm" onClick={addStage}>
                    <Plus className="w-3.5 h-3.5" /> Add Stage
                  </Button>
                </div>

                {/* Visual stage preview */}
                <div className="h-16 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 relative overflow-hidden">
                  {stages.map((s, i) => {
                    const prev = stages[i - 1] || { target: 0 };
                    const totalDuration = stages.reduce((a, s) => a + parseDuration(s.duration), 0) || 1;
                    const startPct = stages.slice(0, i).reduce((a, s) => a + parseDuration(s.duration) / totalDuration, 0) * 100;
                    const widthPct = parseDuration(s.duration) / totalDuration * 100;
                    const heightPct = (s.target / maxStageTarget) * 100;
                    const prevHeightPct = (prev.target / maxStageTarget) * 100;
                    return (
                      <div key={i} className="absolute bottom-0" style={{ left: `${startPct}%`, width: `${widthPct}%` }}>
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x="0" y={100 - heightPct} width="100" height={heightPct} fill="rgba(99,102,241,0.15)" />
                          <line x1="0" y1={100 - prevHeightPct} x2="100" y2={100 - heightPct} stroke="rgb(99,102,241)" strokeWidth="1.5" />
                        </svg>
                      </div>
                    );
                  })}
                </div>

                {stages.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-12">{i === 0 ? 'Start' : `Stage ${i}`}</span>
                    <input value={s.duration} onChange={(e) => updateStage(i, 'duration', e.target.value)}
                      className="w-28 border rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                      placeholder="30s" />
                    <span className="text-xs text-gray-400">→</span>
                    <input type="number" min={0} value={s.target} onChange={(e) => updateStage(i, 'target', Number(e.target.value))}
                      className="w-24 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                      placeholder="VUs" />
                    <span className="text-xs text-gray-400">VUs</span>
                    {stages.length > 1 && (
                      <button onClick={() => removeStage(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'scenarios' && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Scenarios (Advanced)</h3>
              <Button variant="ghost" size="sm" onClick={addScenario}>
                <Plus className="w-3.5 h-3.5" /> Add Scenario
              </Button>
            </div>
            {scenarios.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No scenarios defined. Add one to configure multiple executors.</p>
            ) : (
              <div className="space-y-4">
                {scenarios.map((s, i) => (
                  <div key={i} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <input value={s.name} onChange={(e) => updateScenario(i, 'name', e.target.value)}
                        className="font-medium text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-500 outline-none text-gray-900 dark:text-gray-100"
                        placeholder="Scenario name" />
                      <button onClick={() => removeScenario(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Executor</label>
                        <Select value={s.executor} onChange={(value) => updateScenario(i, 'executor', value)} options={Object.entries(EXECUTOR_LABELS).map(([value, label]) => ({ value, label }))} />
                      </div>
                      {['constant-vus', 'ramping-vus', 'externally-controlled'].includes(s.executor) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            VUs
                          </label>
                          <input type="number" min={1} value={s.vus || ''} onChange={(e) => updateScenario(i, 'vus', Number(e.target.value))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 outline-none" />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Duration</label>
                        <input value={s.maxDuration || ''} onChange={(e) => updateScenario(i, 'maxDuration', e.target.value)}
                          className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 outline-none"
                          placeholder="5m" />
                      </div>
                      {['constant-arrival-rate', 'ramping-arrival-rate'].includes(s.executor) && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Rate</label>
                            <input type="number" min={1} value={s.startRate || ''} onChange={(e) => updateScenario(i, 'startRate', Number(e.target.value))}
                              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pre-allocated VUs</label>
                            <input type="number" min={1} value={s.preAllocatedVUs || ''} onChange={(e) => updateScenario(i, 'preAllocatedVUs', Number(e.target.value))}
                              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 outline-none" />
                          </div>
                        </>
                      )}
                    </div>
                    {s.executor === 'ramping-vus' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Ramp Stages</label>
                          <button onClick={() => {
                            const sc = [...scenarios];
                            sc[i].stages = [...(sc[i].stages || []), { duration: '1m', target: 20 }];
                            setScenarios(sc);
                          }} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Add</button>
                        </div>
                        {(s.stages || []).map((st, si) => (
                          <div key={si} className="flex gap-2 items-center mb-1">
                            <input value={st.duration} onChange={(e) => {
                              const sc = [...scenarios];
                              sc[i].stages![si] = { ...st, duration: e.target.value };
                              setScenarios(sc);
                            }} className="w-24 border rounded px-1.5 py-1 text-xs font-mono bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100" placeholder="1m" />
                            <span className="text-xs text-gray-400">→</span>
                            <input type="number" value={st.target} onChange={(e) => {
                              const sc = [...scenarios];
                              sc[i].stages![si] = { ...st, target: Number(e.target.value) };
                              setScenarios(sc);
                            }} className="w-20 border rounded px-1.5 py-1 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100" />
                            <span className="text-xs text-gray-400">VUs</span>
                            <button onClick={() => {
                              const sc = [...scenarios];
                              sc[i].stages = sc[i].stages!.filter((_, j) => j !== si);
                              setScenarios(sc);
                            }} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'thresholds' && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Thresholds & SLOs</h3>
              <Button variant="ghost" size="sm" onClick={addThreshold}>
                <Plus className="w-3.5 h-3.5" /> Add Threshold
              </Button>
            </div>
            <div className="space-y-2">
              {thresholds.length === 0 && (
                <p className="text-xs text-gray-400 italic">No thresholds — test will pass regardless of performance</p>
              )}
              {thresholds.map((t, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={t.metric} onChange={(value) => updateThreshold(i, 'metric', value)} options={[{ value: 'http_req_duration', label: 'http_req_duration' }, { value: 'http_req_failed', label: 'http_req_failed' }, { value: 'http_reqs', label: 'http_reqs' }, { value: 'iterations', label: 'iterations' }, { value: 'checks', label: 'checks' }, { value: 'http_req_duration{name:critical}', label: "http_req_duration{name:critical}" }]} />
                  <input value={t.expr} onChange={(e) => updateThreshold(i, 'expr', e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                    placeholder="p(95)<500" />
                  <button onClick={() => removeThreshold(i)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['p(95)<500', 'p(99)<1000', 'rate<0.01', 'avg<200', 'max<3000', 'count>100'].map(eg => (
                <button key={eg} onClick={() => setThresholds([...thresholds, { metric: 'http_req_duration', expr: eg }])}
                  className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-colors font-mono">
                  + {eg}
                </button>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'env' && (
          <div className="space-y-6">
            <Card padding="lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  <Variable className="w-4 h-4 inline mr-1.5" />Environment Variables
                </h3>
                <Button variant="ghost" size="sm" onClick={addEnvVar}>
                  <Plus className="w-3.5 h-3.5" /> Add Variable
                </Button>
              </div>
              <div className="space-y-2">
                {envVars.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No environment variables defined</p>
                )}
                {envVars.map((e, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={e.key} onChange={(ev) => updateEnvVar(i, 'key', ev.target.value)}
                      className="w-40 border rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                      placeholder="VARIABLE_NAME" />
                    <input value={e.value} onChange={(ev) => updateEnvVar(i, 'value', ev.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                      placeholder="value" type={e.secret ? 'password' : 'text'} />
                    <button onClick={() => updateEnvVar(i, 'secret', !e.secret)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                      title={e.secret ? 'Hide value' : 'Show value'}>
                      {e.secret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => removeEnvVar(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  <Tags className="w-4 h-4 inline mr-1.5" />Tags
                </h3>
                <Button variant="ghost" size="sm" onClick={addTag}>
                  <Plus className="w-3.5 h-3.5" /> Add Tag
                </Button>
              </div>
              <div className="space-y-2">
                {tags.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No tags defined</p>
                )}
                {tags.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={t.key} onChange={(e) => updateTag(i, 'key', e.target.value)}
                      className="w-40 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                      placeholder="tag_name" />
                    <input value={t.value} onChange={(e) => updateTag(i, 'value', e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-gray-100"
                      placeholder="value" />
                    <button onClick={() => removeTag(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'outputs' && (
          <div className="space-y-6">
            <Card padding="lg" className="border border-brand-500/20 bg-brand-500/5 dark:bg-brand-500/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-brand-500" />
                    Shared Output Profile
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Assign a centralized output profile (InfluxDB, Prometheus, Kafka) shared across all your test plans.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={outputProfileId || ''}
                    onChange={(e) => setOutputProfileId(e.target.value || null)}
                    className="flex-1 sm:w-64 border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="">Inherit Project Default Profile</option>
                    {availableProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.outputType}){p.isDefault ? ' [Project Default]' : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/projects/${pid}/output-profiles`)}
                  >
                    Manage Profiles
                  </Button>
                </div>
              </div>
            </Card>

            <Card padding="lg">
              <OutputsManager outputs={outputs} onChange={setOutputs} />
            </Card>
          </div>
        )}

        <div className="flex gap-3 pt-2 sticky bottom-0 bg-gray-50 dark:bg-gray-950 py-4 -mx-6 px-6 border-t dark:border-gray-800">
          <Button onClick={handleSave} disabled={saving || !name}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/projects/${pid}/plans/${sid}`)}>
            <X className="w-4 h-4" /> Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseDuration(d: string): number {
  const m = d.match(/^(\d+(?:\.\d+)?)(s|m|h)$/);
  if (!m) return 60;
  const val = parseFloat(m[1]);
  if (m[2] === 'h') return val * 3600;
  if (m[2] === 'm') return val * 60;
  return val;
}
