import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, FieldWrapper, Select } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { Database, Plus, Trash2, Edit3, Server, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433 },
  { value: 'sqlite', label: 'SQLite', defaultPort: 0 },
];

const emptyForm = { name: '', type: 'postgres', host: 'localhost', port: 5432, database: '', username: '', password: '', ssl: false };

export default function DatabaseConnections() {
  useTitle('Database Connections');
  const { pid } = useParams();
  const toast = useToastStore();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!pid) return;
    setLoading(true);
    try { setConnections(await api.listDbConnections(pid)); }
    catch { toast.error('Failed to load DB connections'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pid]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const handleEdit = (conn: any) => {
    setForm({ name: conn.name, type: conn.type, host: conn.host, port: conn.port, database: conn.database, username: conn.username, password: '', ssl: conn.ssl });
    setEditingId(conn.id);
    setShowForm(true);
  };

  const handleTypeChange = (type: string) => {
    const t = DB_TYPES.find(d => d.value === type);
    setForm({ ...form, type, port: t?.defaultPort || 5432 });
  };

  const handleSave = async () => {
    if (!pid || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const data: any = { name: form.name, type: form.type, host: form.host, port: form.port, database: form.database, username: form.username, ssl: form.ssl };
        if (form.password) data.password = form.password;
        await api.updateDbConnection(editingId, data);
        toast.success('Connection updated');
      } else {
        await api.createDbConnection(pid, form);
        toast.success('Connection created');
      }
      resetForm();
      load();
    } catch { toast.error('Failed to save connection'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.deleteDbConnection(deleteTarget); toast.success('Connection deleted'); setDeleteTarget(null); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const togglePassword = (id: string) => {
    const next = new Set(showPasswords);
    if (next.has(id)) next.delete(id); else next.add(id);
    setShowPasswords(next);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Database Connections" subtitle="Manage database connections for SQL query testing across your performance test plans"
        breadcrumbs={[{ label: 'Test Plans', to: `/projects/${pid}/plans` }, { label: 'Databases' }]}
        actions={<Button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-xl shadow-sm"><Plus className="w-4 h-4 mr-1.5" /> New Connection</Button>}
      />

      {showForm && (
        <Card padding="lg" className="border-brand-500/20 shadow-md">
          <h3 className="font-semibold text-base mb-5 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Database className="w-5 h-5 text-brand-500" /> {editingId ? 'Edit' : 'New'} Database Connection
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FieldWrapper label="Connection Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production DB" />
            </FieldWrapper>
            <FieldWrapper label="Database Type">
              <Select value={form.type} onChange={(v) => handleTypeChange(v)}
                options={DB_TYPES.map(d => ({ label: d.label, value: d.value }))}
              />
            </FieldWrapper>
            <FieldWrapper label="Host">
              <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="localhost" />
            </FieldWrapper>
            <FieldWrapper label="Port">
              <Input type="number" value={String(form.port)} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 5432 })} />
            </FieldWrapper>
            <FieldWrapper label="Database Name">
              <Input value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} placeholder="mydb" />
            </FieldWrapper>
            <FieldWrapper label="Username">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="user" />
            </FieldWrapper>
            <FieldWrapper label="Password">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? '(unchanged)' : 'password'} />
            </FieldWrapper>
            <div className="flex flex-col justify-end pb-1.5">
              <label className="flex items-center gap-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <input type="checkbox" checked={form.ssl} onChange={(e) => setForm({ ...form, ssl: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 w-4 h-4" />
                Enable SSL encrypted connection
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="min-w-[100px]">
              {saving ? 'Saving...' : 'Save Connection'}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="md"><div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" /></Card>
          ))}
        </div>
      ) : connections.length === 0 && !showForm ? (
        <Card padding="lg">
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No database connections yet</p>
            <p className="text-sm mt-1 max-w-md mx-auto">Add a database connection to run queries, test latency, and validate database state during your performance tests.</p>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-5 rounded-xl"><Plus className="w-4 h-4 mr-1.5" /> Create Connection</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {connections.map((conn) => (
            <Card key={conn.id} padding="md" hover className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center shrink-0 border border-brand-500/10">
                      <Database className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate" title={conn.name}>{conn.name}</h3>
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase tracking-wider shrink-0">
                    {conn.type}
                  </span>
                </div>
                <div className="space-y-1.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/80 text-xs text-gray-600 dark:text-gray-400 font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <Server className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{conn.host}:{conn.port}/{conn.database}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                    <span className="flex items-center gap-1.5 truncate text-gray-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {conn.username}
                    </span>
                    {conn.password && (
                      <button onClick={() => togglePassword(conn.id)} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0 font-sans text-[11px]" title={showPasswords.has(conn.id) ? "Hide password" : "Show password"}>
                        {showPasswords.has(conn.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showPasswords.has(conn.id) ? conn.password : '••••••'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(conn)} className="text-xs py-1 px-2.5"><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(conn.id)} className="text-xs py-1 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Connection" message="Are you sure you want to delete this database connection? Any test plans using this connection will fail when running SQL queries." confirmLabel="Delete Connection" variant="danger"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
