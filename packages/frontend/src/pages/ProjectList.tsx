import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Input, Button, Spinner, FieldWrapper } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useTitle } from '../hooks/useTitle';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/Skeleton';
import Card from '../components/Card';
import {
  Plus, ChevronRight, Search, Box, FileText, Play, Users,
  Clock, TrendingUp, TrendingDown, ShieldCheck, AlertCircle, Shield,
  RefreshCw, Gauge, X, Folder, BarChart3, ArrowUpRight
} from 'lucide-react';

interface ProjectWithSummary {
  id: string; name: string; description: string | null;
  _count: { scripts: number; testRuns: number; members: number };
  summary?: {
    avgDuration: number; passRate: number; totalRuns: number;
    passedRuns: number; failedRuns: number;
  } | null;
}

export default function ProjectList() {
  useTitle('Projects');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [projects, setProjects] = useState<ProjectWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const loadProjects = () => {
    setLoading(true);
    setError(null);
    api.listProjects()
      .then(async (projs) => {
        const withSummaries = await Promise.all(
          projs.map(async (p) => {
            const summary = await api.getDashboardSummary(p.id).catch(() => null);
            return { ...p, summary };
          })
        );
        setProjects(withSummaries);
      })
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    setCreating(true);
    setError(null);
    try {
      const project = await api.createProject({ name: newName, description: newDesc || undefined });
      setShowForm(false);
      setNewName('');
      setNewDesc('');
      navigate(`/projects/${project.id}`);
    } catch { setError('Failed to create project'); } finally { setCreating(false); }
  };

  const filtered = useMemo(() => {
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q))
    );
  }, [projects, search]);

  const totalScripts = projects.reduce((s, p) => s + (p._count?.scripts ?? 0), 0);
  const totalRuns = projects.reduce((s, p) => s + (p._count?.testRuns ?? 0), 0);
  const totalMembers = projects.reduce((s, p) => s + (p._count?.members ?? 0), 0);

  const quickStats = [
    { label: 'Projects', value: projects.length, icon: Folder, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
    { label: 'Plans', value: totalScripts, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Total Runs', value: totalRuns, icon: Play, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Members', value: totalMembers, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {user?.name ? `${user.name}'s Projects` : 'Projects'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''} &middot; {totalScripts} script{totalScripts !== 1 ? 's' : ''} &middot; {totalRuns} run{totalRuns !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Project'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={loadProjects} className="ml-auto text-red-500 hover:text-red-700"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/30">
              <Plus className="w-4 h-4 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Create New Project</h3>
          </div>
          <FieldWrapper label="Name" htmlFor="name">
            <Input id="name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Performance Project" required />
          </FieldWrapper>
          <FieldWrapper label="Description (optional)">
            <Input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this project for?" />
          </FieldWrapper>
          <div className="flex gap-2">
            <Button type="submit" disabled={creating || !newName}>
              {creating && <Spinner />}
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickStats.map(s => (
          <div key={s.label} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className={`p-2.5 rounded-lg ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.value}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
        />
      </div>

      {loading ? (
        <PageSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📁"
          title={search ? 'No matches' : 'No projects yet'}
          description={search ? 'Try a different search term' : 'Create your first project to start performance testing.'}
          action={search ? undefined : { label: '+ New Project', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => {
            const passRate = p.summary?.passRate ?? 0;
            const hasData = (p.summary?.totalRuns ?? 0) > 0;
            const healthColor = !hasData ? 'gray' : passRate > 80 ? 'emerald' : passRate > 50 ? 'amber' : 'red';
            const healthLabel = !hasData ? 'No data' : passRate > 80 ? 'Healthy' : passRate > 50 ? 'Unstable' : 'Failing';

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="group relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        healthColor === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/30' :
                        healthColor === 'amber' ? 'bg-amber-50 dark:bg-amber-950/30' :
                        healthColor === 'red' ? 'bg-red-50 dark:bg-red-950/30' :
                        'bg-gray-50 dark:bg-gray-800'
                      }`}>
                        <Box className={`w-4 h-4 ${
                          healthColor === 'emerald' ? 'text-emerald-600' :
                          healthColor === 'amber' ? 'text-amber-600' :
                          healthColor === 'red' ? 'text-red-600' :
                          'text-gray-400'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {p.name}
                        </h3>
                        {p.description && (
                          <p className="text-xs text-gray-500 mt-px truncate">{p.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-1" />
                </div>

                {/* Health bar */}
                {hasData && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            healthColor === 'emerald' ? 'bg-emerald-500' :
                            healthColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${passRate}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono font-medium tabular-nums shrink-0 ${
                        healthColor === 'emerald' ? 'text-emerald-600' :
                        healthColor === 'amber' ? 'text-amber-600' : 'text-red-600'
                      }`}>{passRate.toFixed(0)}%</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-[10px]">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                    healthColor === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                    healthColor === 'amber' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                    healthColor === 'red' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {healthColor === 'emerald' ? <TrendingUp className="w-3 h-3" /> :
                     healthColor === 'red' ? <TrendingDown className="w-3 h-3" /> :
                     <Shield className="w-3 h-3" />}
                    {healthLabel}
                  </span>

                  <span className="flex items-center gap-1 text-gray-400" title="Plans">
                    <FileText className="w-3 h-3" />{p._count?.scripts ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400" title="Total runs">
                    <BarChart3 className="w-3 h-3" />{p._count?.testRuns ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400" title="Members">
                    <Users className="w-3 h-3" />{p._count?.members ?? 0}
                  </span>
                </div>

                {/* Quick action hover overlay */}
                <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 flex items-center gap-1">
                    View details <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}