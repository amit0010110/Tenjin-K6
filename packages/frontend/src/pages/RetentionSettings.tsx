import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { Database, Trash2, Clock, AlertTriangle, HardDrive, Activity } from 'lucide-react';

export default function RetentionSettings() {
  useTitle('Data Retention');
  const { pid } = useParams();
  const toast = useToastStore();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [olderThanDays, setOlderThanDays] = useState(90);
  const [purging, setPurging] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setStats(await api.getRetentionStats(pid!)); } catch { toast.error('Failed to load stats'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pid]);

  const handlePurge = async () => {
    if (!confirm(`Delete all runs older than ${olderThanDays} days? This cannot be undone.`)) return;
    setPurging(true);
    try {
      const res = await api.purgeRuns(pid!, olderThanDays);
      toast.success(res.message);
      load();
    } catch { toast.error('Failed to purge'); }
    setPurging(false);
  };

  const daysSince = (date: string | null) => {
    if (!date) return '—';
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000) + ' days';
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Data Retention" subtitle="Manage data lifecycle and storage" />

      {loading ? (
        <Card padding="lg">
          <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </Card>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalRuns}</p>
                  <p className="text-xs text-gray-500">Total Runs</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPoints?.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Data Points</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{daysSince(stats.oldestRunAt)}</p>
                  <p className="text-xs text-gray-500">Oldest Data</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                  <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{daysSince(stats.latestRunAt)}</p>
                  <p className="text-xs text-gray-500">Latest Data</p>
                </div>
              </div>
            </Card>
          </div>

          <Card padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Purge Old Runs</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Permanently delete test runs and their result data older than the specified number of days.
                  This action cannot be undone.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Delete runs older than</label>
                    <input type="number" value={olderThanDays} onChange={(e) => setOlderThanDays(Number(e.target.value))} min={1}
                      className="w-20 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-center focus:ring-2 focus:ring-brand-500 outline-none" />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                  <Button variant="danger" size="sm" onClick={handlePurge} disabled={purging}>
                    <Trash2 className="w-4 h-4" /> {purging ? 'Purging...' : 'Purge Now'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card padding="lg">
          <div className="text-center py-8">
            <Database className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Could not load retention stats</p>
          </div>
        </Card>
      )}
    </div>
  );
}
