import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { History, ChevronLeft, ChevronRight, User, Activity } from 'lucide-react';

export default function AuditLogViewer() {
  useTitle('Audit Log');
  const { pid } = useParams();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.listAuditLogs(pid!, page).then((r) => {
      setLogs(r.logs);
      setTotal(r.total);
      setTotalPages(r.totalPages);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [pid, page]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="Audit Log" subtitle={`${total} event${total !== 1 ? 's' : ''}`} />

      {loading ? (
        <Card padding="lg">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      ) : logs.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <History className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No audit events yet</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y dark:divide-gray-800">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {log.user?.name || log.user?.email || 'Unknown'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 font-mono">
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{log.entity}</span>
                    <span className="text-xs text-gray-400">#{log.entityId?.slice(0, 8)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                    {log.details && <span className="ml-2 text-gray-400">{log.details}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t dark:border-gray-800">
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
