import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TreePine, Globe, CheckCircle, XCircle, AlertCircle, Clock, ChevronRight, ChevronDown, Search, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface RequestLog {
  id: string;
  method: string;
  url: string;
  status: number;
  body: string | null;
  headers: string | null;
  timing: number | null;
  timestamp: string;
}

export default function ResultsTreePanel({ runId }: { runId: string }) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    api.getRunRequestLogs(runId, page, pageSize).then(data => {
      setLogs(data.logs || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setLoading(false);
      setExpanded(new Set());
    }).catch(() => setLoading(false));
  }, [runId, page]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    if (status >= 300 && status < 400) return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
    return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  };

  const filtered = search
    ? logs.filter(l =>
        l.url.toLowerCase().includes(search.toLowerCase()) ||
        l.method.toLowerCase().includes(search.toLowerCase()) ||
        String(l.status).includes(search)
      )
    : logs;

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">Loading request logs...</div>
    );
  }

  return (
    <div className="border-t dark:border-gray-700">
      <div className="flex items-center gap-2 px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <ChevronRight className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Results Tree</span>
        <span className="text-[10px] text-gray-400 ml-1">
          {total > 0 ? `${filtered.length} of ${total} request${total !== 1 ? 's' : ''}` : 'No requests'}
        </span>
        <div className="ml-auto relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter..."
            className="w-32 text-xs pl-6 pr-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y dark:divide-gray-700">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            {total === 0 ? 'No requests captured. Run a test to see results.' : 'No requests match filter.'}
          </div>
        ) : (
          filtered.map(log => (
            <div key={log.id}>
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center gap-2 px-4 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {expanded.has(log.id)
                  ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                }
                <span className={`font-mono font-medium px-1.5 py-0.5 rounded text-[10px] uppercase ${
                  log.method === 'GET' ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30' :
                  log.method === 'POST' ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30' :
                  log.method === 'PUT' ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' :
                  log.method === 'DELETE' ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30' :
                  'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800'
                }`}>
                  {log.method}
                </span>
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{log.url}</span>
                {getStatusIcon(log.status)}
                <span className={`font-mono text-xs font-medium ${
                  log.status >= 200 && log.status < 300 ? 'text-green-600 dark:text-green-400' :
                  log.status >= 400 ? 'text-red-600 dark:text-red-400' :
                  'text-amber-600 dark:text-amber-400'
                }`}>
                  {log.status}
                </span>
                {log.timing != null && (
                  <span className="text-gray-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {log.timing.toFixed(0)}ms
                  </span>
                )}
              </div>
              {expanded.has(log.id) && (
                <div className="px-4 pb-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
                  {log.headers && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Response Headers</p>
                      <pre className="text-[10px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700 overflow-x-auto max-h-32">
                        {(() => {
                          try { return JSON.stringify(JSON.parse(log.headers), null, 2); }
                          catch { return log.headers; }
                        })()}
                      </pre>
                    </div>
                  )}
                  {log.body && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Response Body</p>
                      <pre className="text-[10px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700 overflow-x-auto max-h-48">
                        {(() => {
                          try { return JSON.stringify(JSON.parse(log.body), null, 2); }
                          catch { return log.body; }
                        })()}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
          <span>{total} total</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}