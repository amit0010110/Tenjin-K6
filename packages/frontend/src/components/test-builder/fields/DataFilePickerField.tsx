import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table } from 'lucide-react';
import { api } from '../../../api/client';

export function DataFilePicker({ value, onChange, fieldError }: { value: unknown; onChange: (v: string) => void; fieldError?: string }) {
  const { pid } = useParams();
  const [fileList, setFileList] = useState<Array<{ id: string; name: string; filename: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const val = value as string | undefined;

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    api.listDataFiles(pid).then(setFileList).catch(() => {}).finally(() => setLoading(false));
  }, [pid]);

  useEffect(() => {
    if (!val) { setPreview(null); return; }
    api.getDataFile(val).then((f: { content: string }) => {
      const lines = f.content.trim().split('\n');
      if (lines.length < 1) { setPreview(null); return; }
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''));
      const dataRows = lines.slice(1, 6).map((line: string) =>
        line.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''))
      );
      setPreview({ headers, rows: dataRows });
    }).catch(() => setPreview(null));
  }, [val]);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Data File</label>
      {fieldError && <p className="text-[10px] text-red-500 mb-0.5">{fieldError}</p>}
      <select
        value={val || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-xs px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500 ${fieldError ? 'border-red-400 dark:border-red-500' : 'dark:border-gray-600'}`}
      >
        <option value="">{loading ? 'Loading...' : 'Select a file...'}</option>
        {fileList.map(f => (
          <option key={f.id} value={f.id}>{f.name} ({f.filename})</option>
        ))}
      </select>

      {preview !== null && (
        <div className="mt-2 rounded border dark:border-gray-600 overflow-hidden">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-600 flex items-center gap-1">
            <Table className="w-3 h-3" /> Preview (first {preview.rows.length} rows)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  {preview.headers.map((h: string, i: number) => (
                    <th key={i} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400 border-r dark:border-gray-600 last:border-r-0 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row: string[], ri: number) => (
                  <tr key={ri} className="border-t dark:border-gray-600">
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="px-2 py-0.5 text-gray-700 dark:text-gray-300 border-r dark:border-gray-600 last:border-r-0 truncate max-w-[120px]">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
