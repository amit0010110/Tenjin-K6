import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { Puzzle, Plus, Trash2, ToggleLeft, ToggleRight, X, ExternalLink, Hammer } from 'lucide-react';

interface PresetPlugin {
  category: 'Outputs' | 'Protocols & Clients' | 'Utilities & OS';
  name: string;
  description: string;
  repo: string;
}

const PRESET_PLUGINS: PresetPlugin[] = [
  // Outputs
  { category: 'Outputs', name: 'xk6-output-influxdb', description: 'Stream test metrics to InfluxDB v2.x instances right from k6', repo: 'github.com/grafana/xk6-output-influxdb' },
  { category: 'Outputs', name: 'xk6-output-elasticsearch', description: 'Stream metrics directly to Elasticsearch indexes', repo: 'github.com/elastic/xk6-output-elasticsearch' },
  { category: 'Outputs', name: 'xk6-output-timescaledb', description: 'Stream metrics to PostgreSQL / TimescaleDB hyper-tables', repo: 'github.com/grafana/xk6-output-timescaledb' },
  { category: 'Outputs', name: 'xk6-output-opentelemetry', description: 'Stream OpenTelemetry (OTLP) metrics to Jaeger or OTel Collector', repo: 'github.com/grafana/xk6-output-opentelemetry' },
  { category: 'Outputs', name: 'xk6-output-kafka', description: 'Publish raw k6 metrics to Apache Kafka topics', repo: 'github.com/grafana/xk6-output-kafka' },

  // Protocols & Clients
  { category: 'Protocols & Clients', name: 'xk6-kafka', description: 'Apache Kafka producer/consumer load testing', repo: 'github.com/mostafa/xk6-kafka' },
  { category: 'Protocols & Clients', name: 'xk6-sql', description: 'SQL database load testing (Postgres, MySQL, SQLite)', repo: 'github.com/grafana/xk6-sql' },
  { category: 'Protocols & Clients', name: 'xk6-redis', description: 'Redis client for caching, pub/sub, and streams', repo: 'github.com/grafana/xk6-redis' },
  { category: 'Protocols & Clients', name: 'xk6-mqtt', description: 'MQTT protocol support for IoT load testing', repo: 'github.com/pmalhaire/xk6-mqtt' },
  { category: 'Protocols & Clients', name: 'xk6-amqp', description: 'AMQP 0-9-1 / JMS bridge for RabbitMQ & IBM MQ AMQP', repo: 'github.com/lxkuz/xk6-amqp' },
  { category: 'Protocols & Clients', name: 'xk6-tcp', description: 'Raw TCP socket messaging & ISO 8583 financial transaction protocol', repo: 'github.com/grafana/xk6-tcp' },
  { category: 'Protocols & Clients', name: 'xk6-sftp', description: 'SFTP / FTP protocol support for uploading and downloading files', repo: 'github.com/InditexTech/xk6-sftp' },
  { category: 'Protocols & Clients', name: 'xk6-websockets', description: 'Advanced WebSocket client for bidirectional streaming tests', repo: 'github.com/grafana/xk6-websockets' },
  { category: 'Protocols & Clients', name: 'xk6-sse', description: 'Test Server-Sent Events (SSE) real-time streaming connections', repo: 'github.com/phymbert/xk6-sse' },
  { category: 'Protocols & Clients', name: 'xk6-kubernetes', description: 'Interact with Kubernetes API (Pods, Deployments, Secrets) during tests', repo: 'github.com/grafana/xk6-kubernetes' },

  // Utilities & OS
  { category: 'Utilities & OS', name: 'xk6-faker', description: 'Generate random names, addresses, emails & mock test data', repo: 'github.com/grafana/xk6-faker' },
  { category: 'Utilities & OS', name: 'xk6-exec', description: 'Execute external OS shell commands and scripts from your k6 script', repo: 'github.com/grafana/xk6-exec' },
];

export default function PluginManager() {
  useTitle('Plugins');
  const { pid } = useParams();
  const toast = useToastStore();

  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<{ binaryPath?: string; binaryName?: string; status?: string; error?: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    setLoading(true);
    try { setPlugins(await api.listPlugins(pid!)); } catch { toast.error('Failed to load plugins'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pid]);

  const handleAdd = async () => {
    if (!name || !repoUrl) return;
    try {
      await api.createPlugin(pid!, { name, repoUrl, description });
      toast.success('Plugin added');
      setName(''); setRepoUrl(''); setDescription(''); setShowForm(false);
      load();
    } catch { toast.error('Failed to add plugin'); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try { await api.togglePlugin(id, !enabled); load(); } catch { toast.error('Failed to toggle plugin'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this plugin?')) return;
    try { await api.deletePlugin(id); toast.success('Plugin removed'); load(); }
    catch { toast.error('Failed to remove plugin'); }
  };

  const addPreset = async (p: typeof PRESET_PLUGINS[0]) => {
    if (plugins.some(pl => pl.name === p.name || pl.repoUrl?.includes(p.repo))) {
      toast.error(`${p.name} is already added to this project`);
      return;
    }
    try {
      await api.createPlugin(pid!, { name: p.name, repoUrl: `https://${p.repo}`, description: p.description });
      toast.success(`${p.name} added! Click "Build k6 Binary" when ready.`);
      load();
    } catch {
      toast.error(`Failed to add ${p.name}`);
    }
  };

  const handleBuild = async () => {
    setBuilding(true); setBuildResult(null);
    try {
      const result = await api.buildPlugins(pid!);
      setBuildResult(result);
      toast.success(`k6 built with ${result.plugins} plugin(s)`);
    } catch (err: any) {
      setBuildResult({ status: 'failed', error: err?.message || 'Build failed' });
      toast.error('Build failed');
    }
    setBuilding(false);
  };

  const enabledCount = plugins.filter(p => p.enabled).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Plugins"
        subtitle={`${plugins.length} plugin${plugins.length !== 1 ? 's' : ''} installed (${enabledCount} enabled)`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleBuild} disabled={building || enabledCount === 0}>
              <Hammer className={`w-4 h-4 ${building ? 'animate-spin' : ''}`} />
              {building ? 'Building Binary...' : 'Build k6 Binary'}
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4" /> Add Plugin
            </Button>
          </div>
        }
      />

      {(building || buildResult) && (
        <Card padding="md" className="mb-6 bg-brand-50/50 dark:bg-brand-950/20 border-brand-200 dark:border-brand-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                <Hammer className={`w-4 h-4 text-brand-600 dark:text-brand-400 ${building ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {building ? 'Compiling custom k6 binary via xk6...' : buildResult?.status === 'built' ? 'k6 Binary Compiled Successfully!' : 'Binary Build Failed'}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-mono">
                  {building
                    ? `Building with ${enabledCount} enabled plugin(s)...`
                    : buildResult?.binaryPath
                    ? `Binary path: ${buildResult.binaryPath}`
                    : buildResult?.error || 'Check server logs for compiler details.'}
                </p>
              </div>
            </div>
            {!building && (
              <button onClick={() => setBuildResult(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Card>
      )}

      {showForm && (
        <Card padding="md" className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="xk6-output-prometheus"
                  className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gray-500 mb-1">GitHub Repo URL</label>
                <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/grafana/xk6-output-prometheus"
                  className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Add Plugin</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
            </div>
          </form>

          <div className="mt-4 pt-4 border-t dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 mb-2">Quick add from catalog:</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PLUGINS.map((p) => (
                <button key={p.name} onClick={() => addPreset(p)}
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 hover:text-brand-700 dark:hover:text-brand-300 rounded-full px-3 py-1.5 transition-colors">
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} padding="md"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Puzzle className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No plugins installed</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2 mb-10">
          {plugins.map((p) => (
            <Card key={p.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
                    <Puzzle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{p.name}</h3>
                    {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                  }`}>
                    {p.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {p.repoUrl && (
                    <a href={p.repoUrl} target="_blank" rel="noopener noreferrer"
                      className="text-gray-400 hover:text-brand-500 p-1.5">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => handleToggle(p.id, p.enabled)} className="text-gray-400 hover:text-brand-500 p-1.5">
                    {p.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500 p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Always-visible Available xk6 Extensions Directory */}
      <div className="mt-12 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Available xk6 Extension Directory</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Browse and 1-click install official & verified extensions to your project. Click &quot;Build k6 Binary&quot; when ready to compile.
          </p>
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <span className="font-bold text-sm">💡</span>
            <div>
              <span className="font-semibold">Pro-Tip for Clean Builds:</span> Because different extensions target different major k6 versions (`v1.x` vs `v2.x`), enable only the specific <span className="font-semibold">1 to 3 extensions</span> required by your test script (e.g. `xk6-output-influxdb` or `xk6-sql`). Enabling conflicting versions together will cause Go compiler conflicts!
            </div>
          </div>
        </div>

        {(['Outputs', 'Protocols & Clients', 'Utilities & OS'] as const).map((cat) => {
          const categoryPlugins = PRESET_PLUGINS.filter((p) => p.category === cat);
          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                {cat}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryPlugins.map((p) => {
                  const isInstalled = plugins.some((pl) => pl.name === p.name || pl.repoUrl?.includes(p.repo));
                  return (
                    <Card key={p.name} padding="md" className="flex flex-col justify-between border-gray-100 dark:border-gray-800 hover:border-violet-200 dark:hover:border-violet-900 transition-colors">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{p.name}</h4>
                          <a href={`https://${p.repo}`} target="_blank" rel="noopener noreferrer"
                            className="text-gray-400 hover:text-brand-500 text-xs flex items-center gap-1">
                            GitHub <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{p.description}</p>
                      </div>
                      <div className="flex justify-end pt-2 border-t dark:border-gray-800/60">
                        {isInstalled ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
                            ✓ Installed in Project
                          </span>
                        ) : (
                          <button
                            onClick={() => addPreset(p)}
                            disabled={building}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50">
                            <Plus className="w-3.5 h-3.5" /> 1-Click Add
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
