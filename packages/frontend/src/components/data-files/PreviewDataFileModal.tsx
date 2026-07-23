import React from 'react';
import { Table, Code, Download, X } from 'lucide-react';

interface PreviewDataFileModalProps {
  previewFile: {
    id: string;
    name: string;
    filename: string;
    content: string;
  } | null;
  previewHeaders: string[];
  previewData: string[][];
  onClose: () => void;
  onCopyRef: (filename: string) => void;
  onDownload: (file: any) => void;
}

export const PreviewDataFileModal: React.FC<PreviewDataFileModalProps> = ({
  previewFile,
  previewHeaders,
  previewData,
  onClose,
  onCopyRef,
  onDownload,
}) => {
  if (!previewFile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-elevated w-full max-w-4xl animate-scale-in max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{previewFile.name}</h3>
              <span className="text-[10px] text-gray-400 font-mono">({previewFile.filename})</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {previewHeaders.length} columns &middot; {previewData.length} rows shown
              {previewData.length >= 50 ? ' (first 50)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCopyRef(previewFile.filename)}
              className="text-[10px] text-brand-600 hover:underline flex items-center gap-1"
            >
              <Code className="w-3 h-3" /> Copy ref
            </button>
            <button
              onClick={() => onDownload(previewFile)}
              className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Download
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {previewHeaders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">#</th>
                    {previewHeaders.map((h, i) => (
                      <th key={i} className="text-left px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, ri) => (
                    <tr key={ri} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-2 py-1 text-gray-400 text-[10px]">{ri + 1}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 text-gray-900 dark:text-gray-100 whitespace-nowrap max-w-[250px] truncate">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">{previewFile.content}</pre>
          )}
        </div>
        <div className="px-6 py-3 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between text-xs text-gray-500">
          <span>File ID: <code className="text-gray-700 dark:text-gray-300 font-mono">{previewFile.id}</code></span>
          <span>In k6: <code className="bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border dark:border-gray-700 select-all">{`open('./${previewFile.filename}')`}</code></span>
        </div>
      </div>
    </div>
  );
};
