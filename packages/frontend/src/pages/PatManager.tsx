import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, FieldWrapper } from '../components/ui';
import { Key, Copy, Trash2, AlertTriangle } from 'lucide-react';

export default function PatManager() {
  useTitle('Personal Access Tokens');
  const token = useAuthStore((s) => s.token);
  const toast = useToastStore();
  const [pats, setPats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadPats = () => {
    setLoading(true);
    setError(null);
    fetch('/api/v1/pats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setPats)
      .catch(() => setError('Failed to load tokens'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPats(); }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    setError(null);
    setNewToken(null);
    try {
      const res = await fetch('/api/v1/pats', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { setError('Failed to create token'); return; }
      const pat = await res.json();
      setNewToken(pat.token);
      setName('');
      loadPats();
    } catch { setError('Failed to create token'); } finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token? Any services using it will immediately lose access.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/pats/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError('Failed to revoke token'); return; }
      loadPats();
      toast.success('Token revoked');
    } catch { setError('Failed to revoke token'); }
  };

  const copyToken = () => { if (newToken) { navigator.clipboard.writeText(newToken); setCopied(true); } };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Personal Access Tokens" subtitle="Tokens you generate can be used to authenticate with the API. Treat them like passwords."
        actions={null}
      />

      {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}

      {newToken && (
        <Card padding="md" className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Token created — copy it now, you won't see it again!</p>
              <div className="flex gap-2">
                <code className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-mono flex-1 break-all select-all">{newToken}</code>
                <Button variant="secondary" size="sm" onClick={copyToken}><Copy className="w-4 h-4" />{copied ? 'Copied!' : 'Copy'}</Button>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">Use this token in the <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> header.</p>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleCreate} className="flex gap-3 items-end">
        <div className="flex-1">
          <FieldWrapper label="Token name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., CI/CD, dev machine" required />
          </FieldWrapper>
        </div>
        <Button type="submit" disabled={creating || !name}>{creating ? 'Generating...' : 'Generate Token'}</Button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} padding="md"><div className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></Card>)}
        </div>
      ) : pats.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-6">
            <Key className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tokens yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create one above to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {pats.map((p: any) => (
            <Card key={p.id} padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Created {new Date(p.createdAt).toLocaleDateString()}
                    {p.lastUsedAt && ` · Last used ${new Date(p.lastUsedAt).toLocaleString()}`}
                    {p.expiresAt && ` · Expires ${new Date(p.expiresAt).toLocaleDateString()}`}
                    {!p.lastUsedAt && !p.expiresAt && ' · Never used'}
                  </p>
                </div>
                <button onClick={() => handleRevoke(p.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
