import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, FieldWrapper } from '../components/ui';
import { Link, Copy, Trash2, AlertTriangle } from 'lucide-react';

export default function WebhookSettings() {
  useTitle('CI/CD Webhooks');
  const { pid } = useParams<{ pid: string }>();
  const token = useAuthStore((s) => s.token);
  const toast = useToastStore();
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = () => {
    fetch('/api/v1/webhooks/keys', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setKeys)
      .catch(() => setError('Failed to load API keys'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadKeys(); }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/v1/webhooks/keys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { setError('Failed to generate key'); return; }
      const key = await res.json();
      setNewKey(key.key);
      setName('');
      loadKeys();
    } catch { setError('Failed to generate key'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    try {
      await fetch(`/api/v1/webhooks/keys/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      loadKeys();
      toast.success('API key deleted');
    } catch { toast.error('Failed to delete key'); }
  };

  const copyKey = () => { if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); } };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="CI/CD Webhooks" subtitle="Use API keys to securely trigger test runs and query status from your external CI/CD pipeline."
        breadcrumbs={[{ label: 'Settings', to: `/projects/${pid || ''}/settings` }, { label: 'Webhooks' }]}
      />

      {error && <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/60 font-medium">{error}</div>}

      {newKey && (
        <Card padding="lg" className="border-yellow-400 bg-yellow-50/80 dark:bg-yellow-950/40 shadow-md">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <div>
                <h4 className="text-base font-semibold text-yellow-900 dark:text-yellow-100">New API Key Generated Successfully</h4>
                <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-0.5">Copy and save your secret API key right now. For security reasons, it will never be displayed again after you leave this page!</p>
              </div>
              <div className="flex gap-2">
                <code className="bg-white dark:bg-gray-900 border border-yellow-300 dark:border-yellow-800/80 rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold flex-1 break-all text-gray-900 dark:text-gray-100 shadow-inner">{newKey}</code>
                <Button variant="secondary" size="sm" onClick={copyKey} className="shrink-0 px-4 rounded-xl"><Copy className="w-4 h-4 mr-1.5" />{copied ? 'Copied!' : 'Copy Key'}</Button>
              </div>
              <p className="text-xs text-yellow-800/80 dark:text-yellow-300/80 font-mono">Usage: Send header <code className="bg-yellow-100 dark:bg-yellow-900/60 px-1.5 py-0.5 rounded text-yellow-900 dark:text-yellow-100 font-bold">Authorization: Bearer {newKey.slice(0, 8)}...</code> when POSTing to <code className="bg-yellow-100 dark:bg-yellow-900/60 px-1.5 py-0.5 rounded text-yellow-900 dark:text-yellow-100 font-bold">/api/v1/webhooks/trigger</code>.</p>
            </div>
          </div>
        </Card>
      )}

      <Card padding="lg" className="border-brand-500/20 shadow-sm">
        <h3 className="font-semibold text-base mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Link className="w-4 h-4 text-brand-500" /> Generate New Webhook Key
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Create a unique API token for GitHub Actions, GitLab CI, Jenkins, or custom curl scripts.</p>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3.5 sm:items-end">
          <div className="flex-1">
            <FieldWrapper label="Key Description / Pipeline Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., GitHub Actions Main Branch Production Deploy" required />
            </FieldWrapper>
          </div>
          <Button type="submit" className="rounded-xl px-5 h-10 shrink-0"><Link className="w-4 h-4 mr-1.5" />Generate API Key</Button>
        </form>
      </Card>

      <div>
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          Active API Keys <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">{keys.length}</span>
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => <Card key={i} padding="md"><div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" /></Card>)}
          </div>
        ) : keys.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <Link className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">No API keys generated yet</p>
              <p className="text-xs text-gray-400 mt-1">Generate a key above to start triggering automated performance tests.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {keys.map((k: any) => (
              <Card key={k.id} padding="md" hover className="flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center shrink-0 border border-purple-500/10">
                        <Link className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate" title={k.name}>{k.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{k.key.slice(0, 16)}••••••••</p>
                      </div>
                    </div>
                  </div>
                  {k.lastUsedAt && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/80 text-[11px] text-gray-500 dark:text-gray-400">
                      Last used: <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(k.lastUsedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(k.id)} className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-3">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke Key
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
