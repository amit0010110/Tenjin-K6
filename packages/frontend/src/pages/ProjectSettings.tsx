import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import Card from '../components/Card';
import Tabs from '../components/Tabs';
import { Button, Input, FieldWrapper, Select } from '../components/ui';
import { Users, GitBranch, Cloud, Mail, Server, Gauge, Plus, Save, X, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface Member { id: string; role: string; user: { id: string; email: string; name: string; role: string }; }

export default function ProjectSettings() {
  useTitle('Project Settings');
  const { pid } = useParams();
  const token = useAuthStore((s) => s.token);
  const toast = useToastStore();
  const [tab, setTab] = useState<string>('members');

  const tabs = [
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { id: 'git', label: 'Git Sync', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'cloud', label: 'k6 Cloud', icon: <Cloud className="w-4 h-4" /> },
    { id: 'smtp', label: 'SMTP', icon: <Mail className="w-4 h-4" /> },
    { id: 'k8s', label: 'Kubernetes', icon: <Server className="w-4 h-4" /> },
    { id: 'budgets', label: 'Budgets', icon: <Gauge className="w-4 h-4" /> },
  ];

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  // Git state
  const [gitRepos, setGitRepos] = useState<any[]>([]);
  const [gitForm, setGitForm] = useState<any>(null);
  const [gitPulling, setGitPulling] = useState(false);
  // Cloud state
  const [cloudToken, setCloudToken] = useState('');
  const [savingCloud, setSavingCloud] = useState(false);
  const [showToken, setShowToken] = useState(false);
  // SMTP state
  const [smtpConfig, setSmtpConfig] = useState({ host: '', port: 587, user: '', pass: '', fromEmail: '' });
  const [smtpDirty, setSmtpDirty] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  // K8s state
  const [k8sConfig, setK8sConfig] = useState({ namespace: 'default', image: 'tenjint6/worker-agent:latest', imagePullPolicy: 'Always' });
  const [k8sDirty, setK8sDirty] = useState(false);
  const [savingK8s, setSavingK8s] = useState(false);
  const [k8sPods, setK8sPods] = useState<any[]>([]);
  // Budgets state
  const [budgetRules, setBudgetRules] = useState<any[]>([]);
  const [budgetForm, setBudgetForm] = useState<any>(null);
  const [savingBudget, setSavingBudget] = useState(false);

  const loadMembers = () => fetch(`/api/v1/projects/${pid}/members`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setMembers).catch(() => {});
  const loadGitRepos = () => fetch(`/api/v1/projects/${pid}/git`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setGitRepos).catch(() => {});

  const loadSmtpConfig = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${pid}`, { headers: { Authorization: `Bearer ${token}` } });
      const project = await res.json();
      const smtp = project.smtpConfig ? (typeof project.smtpConfig === 'string' ? JSON.parse(project.smtpConfig) : project.smtpConfig) : {};
      setSmtpConfig({ host: smtp.host || '', port: smtp.port || 587, user: smtp.user || '', pass: smtp.pass || '', fromEmail: smtp.fromEmail || '' });
    } catch {}
  };

  const loadK8sConfig = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${pid}`, { headers: { Authorization: `Bearer ${token}` } });
      const project = await res.json();
      const k8s = project.k8sConfig ? (typeof project.k8sConfig === 'string' ? JSON.parse(project.k8sConfig) : project.k8sConfig) : {};
      setK8sConfig({ namespace: k8s.namespace || 'default', image: k8s.image || 'tenjint6/worker-agent:latest', imagePullPolicy: k8s.imagePullPolicy || 'Always' });
      const podsRes = await fetch(`/api/v1/workers/k8s-pods?projectId=${pid}`, { headers: { Authorization: `Bearer ${token}` } });
      if (podsRes.ok) { const d = await podsRes.json(); setK8sPods(d.pods || []); }
    } catch {}
  };

  const loadBudgetRules = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${pid}/budget`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setBudgetRules(d.rules || []); }
    } catch {}
  };

  useEffect(() => {
    if (tab === 'members') loadMembers();
    else if (tab === 'git') loadGitRepos();
    else if (tab === 'smtp') loadSmtpConfig();
    else if (tab === 'k8s') loadK8sConfig();
    else if (tab === 'budgets') loadBudgetRules();
  }, [pid, token, tab]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage members, integrations, and project-level configuration</p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'members' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Team Members</h3>

          <Card padding="md">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <FieldWrapper label="Email address">
                  <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
                </FieldWrapper>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                <Select value={inviteRole} onChange={setInviteRole} options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }, { value: 'viewer', label: 'Viewer' }]} />
              </div>
              <Button onClick={async () => {
                if (!inviteEmail) return;
                setInviting(true);
                try {
                  const res = await fetch(`/api/v1/projects/${pid}/members`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
                  if (res.ok) { setInviteEmail(''); loadMembers(); toast.success('Member invited'); } else { const d = await res.json(); toast.error(d.message); }
                } catch {} finally { setInviting(false); }
              }} disabled={inviting || !inviteEmail}>{inviting ? 'Inviting...' : 'Invite'}</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id} padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{m.user.name}</p>
                    <p className="text-xs text-gray-500">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={m.role} onChange={async (value) => { await fetch(`/api/v1/projects/${pid}/members/${m.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: value }) }); loadMembers(); }} options={[{ value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }, { value: 'viewer', label: 'Viewer' }]} />
                    <button onClick={async () => {
                      if (!confirm(`Remove ${m.user.name} from project?`)) return;
                      const res = await fetch(`/api/v1/projects/${pid}/members/${m.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                      if (res.ok) { loadMembers(); toast.success(`${m.user.name} removed`); }
                    }} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
            {members.length === 0 && (
              <Card padding="lg">
                <div className="text-center py-6"><Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" /><p className="text-gray-500 dark:text-gray-400 text-sm">No members yet</p></div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'git' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Git Repositories</h3>
            <Button variant="secondary" size="sm" onClick={() => setGitForm({ name: '', repoUrl: '', branch: 'main', authToken: '' })}>
              <Plus className="w-4 h-4" />Add Repo
            </Button>
          </div>
          <p className="text-sm text-gray-500">Connect a Git repository to sync scripts. Push from the Script Editor; pull to import scripts.</p>

          {gitForm && (
            <Card padding="md">
              <h4 className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">{gitForm.id ? 'Edit Repo' : 'New Repository'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="Name">
                  <Input value={gitForm.name} onChange={(e) => setGitForm({ ...gitForm, name: e.target.value })} placeholder="Production Repo" />
                </FieldWrapper>
                <FieldWrapper label="Branch">
                  <Input value={gitForm.branch} onChange={(e) => setGitForm({ ...gitForm, branch: e.target.value })} placeholder="main" />
                </FieldWrapper>
                <div className="col-span-2">
                  <FieldWrapper label="Repository URL">
                    <Input value={gitForm.repoUrl} onChange={(e) => setGitForm({ ...gitForm, repoUrl: e.target.value })} placeholder="https://github.com/user/repo.git" />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <FieldWrapper label="Auth Token (optional)">
                    <Input type="password" value={gitForm.authToken} onChange={(e) => setGitForm({ ...gitForm, authToken: e.target.value })} placeholder="ghp_... or gitlab token" />
                  </FieldWrapper>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={async () => {
                  const res = await fetch(`/api/v1/projects/${pid}/git`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(gitForm) });
                  if (res.ok) { setGitForm(null); loadGitRepos(); }
                }}><Save className="w-4 h-4" />Save</Button>
                <Button variant="secondary" onClick={() => setGitForm(null)}><X className="w-4 h-4" />Cancel</Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {gitRepos.map((r: any) => (
              <Card key={r.id} padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-brand-500" />
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{r.name}</span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{r.branch}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono truncate max-w-md">{r.repoUrl} · Last synced {r.lastSyncedAt ? new Date(r.lastSyncedAt).toLocaleDateString() : 'Never'}</p>
                  </div>
                  <button onClick={async () => {
                    if (!confirm('Delete this repo config?')) return;
                    await fetch(`/api/v1/git/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                    loadGitRepos(); toast.success('Git repo config deleted');
                  }} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Card>
            ))}
            {gitRepos.length === 0 && (
              <Card padding="lg">
                <div className="text-center py-6"><GitBranch className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" /><p className="text-gray-500 dark:text-gray-400 text-sm">No git repos configured</p></div>
              </Card>
            )}
          </div>

          {gitRepos.length > 0 && (
            <Button onClick={async () => {
              setGitPulling(true);
              try {
                const res = await fetch(`/api/v1/projects/${pid}/git-pull`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                const d = await res.json();
                if (res.ok) toast.success(d.message || 'Sync complete');
                else toast.error(d.message || 'Sync failed');
                loadGitRepos();
              } catch {} finally { setGitPulling(false); }
            }} disabled={gitPulling}>
              <RefreshCw className={`w-4 h-4 ${gitPulling ? 'animate-spin' : ''}`} />{gitPulling ? 'Pulling...' : 'Pull All from Git'}
            </Button>
          )}
        </div>
      )}

      {tab === 'cloud' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">k6 Cloud Integration</h3>
          <p className="text-sm text-gray-500">
            Stream test results directly to{' '}
            <a href="https://grafana.com/products/cloud/k6/" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Grafana Cloud k6</a>.
            Enable the <strong>Cloud</strong> option in your test config to push results.
          </p>

          <Card padding="md">
            <FieldWrapper label="k6 Cloud API Token" hint="Generate a token from your Grafana Cloud k6 project settings.">
              <div className="flex gap-2">
                <Input value={cloudToken} onChange={(e) => setCloudToken(e.target.value)} placeholder="Enter your k6 cloud token..."
                  type={showToken ? 'text' : 'password'} className="flex-1" />
                <button onClick={() => setShowToken(!showToken)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 border dark:border-gray-700 rounded-lg">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FieldWrapper>
            <div className="flex gap-2 pt-2">
              <Button onClick={async () => {
                setSavingCloud(true);
                try {
                  const res = await fetch(`/api/v1/projects/${pid}/cloud-token`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: cloudToken }) });
                  if (res.ok) toast.success('Token saved');
                  else toast.error('Failed to save token');
                } catch { toast.error('Failed to save token'); } finally { setSavingCloud(false); }
              }} disabled={savingCloud}><Save className="w-4 h-4" />{savingCloud ? 'Saving...' : 'Save Token'}</Button>
              <Button variant="danger" onClick={async () => {
                if (!confirm('Remove the stored cloud token?')) return;
                try {
                  const res = await fetch(`/api/v1/projects/${pid}/cloud-token`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: '' }) });
                  if (res.ok) { setCloudToken(''); toast.success('Cloud token removed'); }
                } catch { toast.error('Failed to remove token'); }
              }}><Trash2 className="w-4 h-4" />Remove</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'smtp' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">SMTP Configuration</h3>
          <p className="text-sm text-gray-500">
            Configure an SMTP server for sending alert notifications via email.
            Once configured, select <strong>Email</strong> as the channel when creating alert rules.
          </p>

          <Card padding="md" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="SMTP Host" hint="e.g. smtp.gmail.com">
                <Input value={smtpConfig.host} onChange={(e) => { setSmtpConfig({ ...smtpConfig, host: e.target.value }); setSmtpDirty(true); }} placeholder="smtp.example.com" />
              </FieldWrapper>
              <FieldWrapper label="Port" hint="587 (STARTTLS) or 465 (SSL)">
                <Input type="number" value={String(smtpConfig.port)} onChange={(e) => { setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 }); setSmtpDirty(true); }} />
              </FieldWrapper>
              <FieldWrapper label="Username">
                <Input value={smtpConfig.user} onChange={(e) => { setSmtpConfig({ ...smtpConfig, user: e.target.value }); setSmtpDirty(true); }} placeholder="alerts@example.com" autoComplete="off" />
              </FieldWrapper>
              <FieldWrapper label="Password">
                <div className="flex gap-2">
                  <Input type={showSmtpPass ? 'text' : 'password'} value={smtpConfig.pass} onChange={(e) => { setSmtpConfig({ ...smtpConfig, pass: e.target.value }); setSmtpDirty(true); }} placeholder="SMTP password" className="flex-1" autoComplete="off" />
                  <button onClick={() => setShowSmtpPass(!showSmtpPass)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 border dark:border-gray-700 rounded-lg">
                    {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FieldWrapper>
              <FieldWrapper label="From Email" hint="Sender address for alert emails">
                <Input value={smtpConfig.fromEmail} onChange={(e) => { setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value }); setSmtpDirty(true); }} placeholder="noreply@example.com" />
              </FieldWrapper>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={async () => {
                setSavingSmtp(true);
                try {
                  const res = await fetch(`/api/v1/projects/${pid}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ smtpConfig: JSON.stringify(smtpConfig) }) });
                  if (res.ok) { setSmtpDirty(false); toast.success('SMTP configuration saved'); }
                  else toast.error('Failed to save SMTP config');
                } catch { toast.error('Failed to save SMTP config'); } finally { setSavingSmtp(false); }
              }} disabled={savingSmtp || !smtpDirty}>
                <Save className="w-4 h-4" />{savingSmtp ? 'Saving...' : 'Save SMTP Config'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'k8s' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Kubernetes Cluster</h3>
          <p className="text-sm text-gray-500">
            Configure your Kubernetes cluster to deploy worker agents as pods. The backend uses your local <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">kubeconfig</code> to connect.
            Build the worker image: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">docker build -t tenjint6/worker-agent -f packages/worker-agent/Dockerfile .</code>
          </p>

          <Card padding="md" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Namespace" hint="K8s namespace for worker pods">
                <Input value={k8sConfig.namespace} onChange={(e) => { setK8sConfig({ ...k8sConfig, namespace: e.target.value }); setK8sDirty(true); }} placeholder="default" />
              </FieldWrapper>
              <FieldWrapper label="Image" hint="Container image for worker agents">
                <Input value={k8sConfig.image} onChange={(e) => { setK8sConfig({ ...k8sConfig, image: e.target.value }); setK8sDirty(true); }} placeholder="tenjint6/worker-agent:latest" />
              </FieldWrapper>
              <FieldWrapper label="Image Pull Policy" hint="When to pull the image">
                <Select value={k8sConfig.imagePullPolicy} onChange={(value) => { setK8sConfig({ ...k8sConfig, imagePullPolicy: value }); setK8sDirty(true); }} options={[{ value: 'Always', label: 'Always' }, { value: 'IfNotPresent', label: 'IfNotPresent' }, { value: 'Never', label: 'Never' }]} />
              </FieldWrapper>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={async () => {
                setSavingK8s(true);
                try {
                  const res = await fetch(`/api/v1/projects/${pid}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ k8sConfig: JSON.stringify(k8sConfig) }) });
                  if (res.ok) { setK8sDirty(false); toast.success('Kubernetes configuration saved'); loadK8sConfig(); }
                  else toast.error('Failed to save K8s config');
                } catch { toast.error('Failed to save K8s config'); } finally { setSavingK8s(false); }
              }} disabled={savingK8s || !k8sDirty}>
                <Save className="w-4 h-4" />{savingK8s ? 'Saving...' : 'Save K8s Config'}
              </Button>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Running Worker Pods</h4>
            <Button variant="ghost" size="sm" onClick={loadK8sConfig}><RefreshCw className="w-3 h-3" /> Refresh</Button>
          </div>
          <div className="space-y-2">
            {k8sPods.length === 0 ? (
              <Card padding="md">
                <p className="text-center text-sm text-gray-400 py-4">No worker pods found in namespace "{k8sConfig.namespace}"</p>
              </Card>
            ) : (
              k8sPods.map((pod: any) => (
                <Card key={pod.metadata?.name} padding="sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium font-mono">{pod.metadata?.name}</span>
                    <span className={`px-2 py-0.5 rounded-full ${pod.status?.phase === 'Running' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                      {pod.status?.phase}
                    </span>
                    <span className="text-gray-500">{pod.status?.podIP || '—'}</span>
                    <span className="text-gray-500">{pod.metadata?.creationTimestamp ? new Date(pod.metadata.creationTimestamp).toLocaleString() : '—'}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'budgets' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Performance Budgets</h3>
          <p className="text-sm text-gray-500">
            Define performance budgets that gate your CI/CD pipelines. Each budget is a threshold for a specific metric.
            If an error-severity budget fails, CI checks will fail the pipeline.
          </p>

          {budgetRules.length === 0 && (
            <Card padding="lg">
              <div className="text-center py-6"><Gauge className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" /><p className="text-gray-500 dark:text-gray-400 text-sm">No budget rules defined</p></div>
            </Card>
          )}

          {budgetRules.map((rule: any, i: number) => (
            <Card key={rule.id} padding="md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${rule.severity === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                    {rule.severity}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setBudgetForm({ ...rule, index: i })}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    const updated = budgetRules.filter((_: any, idx: number) => idx !== i);
                    const res = await fetch(`/api/v1/projects/${pid}/budget`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: updated }) });
                    if (res.ok) { setBudgetRules(updated); toast.success('Budget rule deleted'); }
                    else toast.error('Failed to delete rule');
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {rule.metric} {rule.expression}
              </div>
            </Card>
          ))}

          {budgetForm !== null ? (
            <BudgetRuleForm
              initial={budgetForm}
              onSave={async (rule: any) => {
                setSavingBudget(true);
                const updated = [...budgetRules];
                if (budgetForm.index !== undefined && budgetForm.index >= 0 && budgetForm.index < updated.length) {
                  updated[budgetForm.index] = { ...rule, id: budgetForm.id || crypto.randomUUID() };
                } else {
                  updated.push({ ...rule, id: crypto.randomUUID() });
                }
                const res = await fetch(`/api/v1/projects/${pid}/budget`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: updated }) });
                if (res.ok) { setBudgetRules(updated); setBudgetForm(null); toast.success('Budget rule saved'); }
                else toast.error('Failed to save budget rule');
                setSavingBudget(false);
              }}
              onCancel={() => setBudgetForm(null)}
              saving={savingBudget}
            />
          ) : (
            <Button onClick={() => setBudgetForm({ name: '', metric: 'http_req_duration', expression: 'p(95)<500', severity: 'error', enabled: true, id: '', index: -1 })}>
              <Plus className="w-4 h-4" /> Add Budget Rule
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetRuleForm({ initial, onSave, onCancel, saving }: {
  initial: any; onSave: (rule: any) => void; onCancel: () => void; saving: boolean;
}) {
  const [form, setForm] = useState({ ...initial });

  return (
    <Card padding="md" className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="Rule Name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Homepage P95 < 200ms" />
        </FieldWrapper>
        <FieldWrapper label="Metric">
          <Input value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} placeholder="http_req_duration" />
        </FieldWrapper>
        <FieldWrapper label="Expression" hint="e.g., p(95)<500, avg<200, max<3000">
          <Input value={form.expression} onChange={(e) => setForm({ ...form, expression: e.target.value })} placeholder="p(95)<500" />
        </FieldWrapper>
        <FieldWrapper label="Severity">
          <Select value={form.severity} onChange={(value) => setForm({ ...form, severity: value })} options={[{ value: 'error', label: 'Error (fails CI)' }, { value: 'warning', label: 'Warning (advisory)' }]} />
        </FieldWrapper>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
        Enabled
      </label>
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={saving || !form.name || !form.metric || !form.expression}>
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Rule'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}
