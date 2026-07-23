import React from 'react';
import { Table, Layers, Code, Download, Eye, Trash2, ChevronRight } from 'lucide-react';

interface DataFileCardProps {
  file: {
    id: string;
    name: string;
    filename: string;
    content: string;
    createdAt: string;
  };
  onCopyRef: (filename: string) => void;
  onDownload: (file: any) => void;
  onPreview: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

export const DataFileCard: React.FC<DataFileCardProps> = ({
  file: f,
  onCopyRef,
  onDownload,
  onPreview,
  onDelete,
}) => {
  const rowCount = Math.max(0, f.content?.split('\n').filter((l: string) => l.trim()).length - 1);
  const colCount = f.content?.split('\n')[0]?.split(',').length || 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center shrink-0">
            <Table className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{f.name}</h3>
              <span className="text-[10px] text-gray-400 font-mono">{f.filename}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Layers className="w-3 h-3 text-gray-400" /> {rowCount} rows
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Table className="w-3 h-3 text-gray-400" /> {colCount} columns
              </span>
              <span className="text-[10px] text-gray-400">
                Uploaded {new Date(f.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-3 shrink-0">
          <button
            onClick={() => onCopyRef(f.filename)}
            className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-all"
            title="Copy open() reference"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDownload(f)}
            className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onPreview(f.id)}
            className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(f.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-[10px]">
        <span className="text-gray-400">Script reference:</span>
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] text-gray-600 dark:text-gray-300 font-mono select-all cursor-pointer"
          onClick={() => onCopyRef(f.filename)}
        >
          {`open('./${f.filename}')`}
        </code>
        <button onClick={() => onCopyRef(f.filename)} className="text-brand-600 hover:underline">Copy</button>
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">ID: <code className="text-gray-500">{f.id.slice(0, 8)}...</code></span>
      </div>
    </div>
  );
};
