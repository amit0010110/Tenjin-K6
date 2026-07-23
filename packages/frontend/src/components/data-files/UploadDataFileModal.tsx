import React from 'react';
import { Upload } from 'lucide-react';
import { Button, Input } from '../ui';

interface UploadDataFileModalProps {
  open: boolean;
  uploadName: string;
  uploadContent: string;
  uploading: boolean;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onContentChange: (content: string) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
}

export const UploadDataFileModal: React.FC<UploadDataFileModalProps> = ({
  open,
  uploadName,
  uploadContent,
  uploading,
  onClose,
  onNameChange,
  onContentChange,
  onFileInput,
  onUpload,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-elevated w-full max-w-2xl animate-scale-in">
        <div className="px-6 py-4 border-b dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-600" /> Upload Data File
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Select a CSV file from your computer or paste CSV/JSON data directly
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select CSV File</label>
            <input
              type="file"
              accept=".csv,.json,.tsv,.txt"
              onChange={onFileInput}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 dark:file:bg-brand-950/30 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-950/50 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
            <Input
              value={uploadName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Test Users"
            />
            {uploadName && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Filename: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{uploadName.toLowerCase().replace(/\s+/g, '_')}.csv</code>
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Preview</label>
            <textarea
              value={uploadContent}
              onChange={(e) => onContentChange(e.target.value)}
              rows={6}
              placeholder="CSV content will appear here after selecting a file..."
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
            />
            {uploadContent && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {uploadContent.split('\n').filter(l => l.trim()).length - 1} data rows
              </p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t dark:border-gray-800 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onUpload} disabled={!uploadName || !uploadContent || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
};
