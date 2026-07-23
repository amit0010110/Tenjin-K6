import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import ConfirmDialog from '../components/ConfirmDialog';
import Card from '../components/Card';
import { PageSkeleton } from '../components/Skeleton';
import {
  Upload, Table, Search,
  Database, AlertCircle, RefreshCw, Info, Users, BarChart3, Layers
} from 'lucide-react';
import { DataFileCard, UploadDataFileModal, PreviewDataFileModal } from '../components/data-files';

interface DataFile {
  id: string; name: string; filename: string; content: string; createdAt: string;
}

export default function DataFiles() {
  const { pid } = useParams();
  const toast = useToastStore();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DataFile | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const loadFiles = async () => {
    if (!pid) return;
    try {
      setLoading(true); setError(null);
      const data = await api.listDataFiles(pid);
      setFiles(data);
    } catch { setError('Failed to load data files'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadFiles(); }, [pid]);

  const handleUpload = async () => {
    if (!pid || !uploadName.trim() || !uploadContent.trim()) return;
    setUploading(true);
    try {
      await api.uploadDataFile(pid, { name: uploadName, content: uploadContent });
      toast.success('Data file uploaded');
      setShowUpload(false); setUploadName(''); setUploadContent('');
      loadFiles();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDataFile(deleteTarget);
      toast.success('Data file deleted');
      setDeleteTarget(null);
      loadFiles();
    } catch { toast.error('Failed to delete'); }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setUploadContent(text);
      setUploadName(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(file);
  };

  const handlePreview = async (fileId: string) => {
    try {
      const data = await api.getDataFile(fileId);
      setPreviewFile(data);
      const lines = data.content.split('\n').filter((l: string) => l.trim());
      if (lines.length > 0) {
        setPreviewHeaders(lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, '')));
        setPreviewData(lines.slice(1, 51).map((line: string) =>
          line.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''))
        ));
      }
    } catch { toast.error('Failed to load file'); }
  };

  const handleDownload = (f: any) => {
    const blob = new Blob([f.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = f.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const copyRef = (filename: string) => {
    navigator.clipboard.writeText(`open('./${filename}')`);
    toast.success('Reference copied: ' + `open('./${filename}')`);
  };

  const filtered = search
    ? files.filter((f: any) => f.name.toLowerCase().includes(search.toLowerCase()) || f.filename.toLowerCase().includes(search.toLowerCase()))
    : files;

  const totalRows = files.reduce((sum: number, f: any) => sum + (f.content?.split('\n').filter((l: string) => l.trim()).length || 0) - 1, 0);

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/30">
              <Database className="w-4 h-4 text-brand-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Data Files</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Upload CSV files for data-driven testing &middot; Each row becomes a test iteration
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="w-4 h-4" /> Upload File
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={loadFiles} className="ml-auto text-red-500 hover:text-red-700"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30"><Database className="w-5 h-5 text-indigo-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{files.length}</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Data Files</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30"><Layers className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{Math.max(0, totalRows)}</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Data Rows</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/30"><BarChart3 className="w-5 h-5 text-violet-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">SharedArray</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">k6 runtime</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30"><Users className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Data-driven</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Per-VU iteration</p></div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by file name..."
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
        />
      </div>

      {/* Usage guide banner */}
      <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
          <div className="text-xs text-brand-700 dark:text-brand-300 space-y-1">
            <p className="font-medium">How data files work at runtime:</p>
            <ol className="list-decimal list-inside space-y-0.5 opacity-90">
              <li>Upload a CSV file &mdash; it's stored and associated with this project</li>
              <li>In the <strong>Visual Test Builder</strong>, add a <code className="bg-brand-100 dark:bg-brand-900/50 px-1 rounded text-[10px]">Data File Reference</code> block and paste the file ID</li>
              <li>When a run is triggered, CSV files are automatically detected and copied to the k6 worker</li>
              <li>Each VU reads rows via <code className="bg-brand-100 dark:bg-brand-900/50 px-1 rounded text-[10px]">SharedArray</code> + <code className="bg-brand-100 dark:bg-brand-900/50 px-1 rounded text-[10px]">papaparse</code></li>
            </ol>
          </div>
        </div>
      </div>

      {/* Upload modal */}
      <UploadDataFileModal
        open={showUpload}
        uploadName={uploadName}
        uploadContent={uploadContent}
        uploading={uploading}
        onClose={() => setShowUpload(false)}
        onNameChange={setUploadName}
        onContentChange={setUploadContent}
        onFileInput={handleFileInput}
        onUpload={handleUpload}
      />

      {/* File list */}
      {filtered.length === 0 && !showUpload ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <Table className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No data files yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">Upload a CSV file to use for data-driven performance testing</p>
            <Button onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4" /> Upload Your First File
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-6">
            <Search className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No files match "{search}"</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((f: any) => (
            <DataFileCard
              key={f.id}
              file={f}
              onCopyRef={copyRef}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onDelete={(id) => setDeleteTarget(id)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      <PreviewDataFileModal
        previewFile={previewFile}
        previewHeaders={previewHeaders}
        previewData={previewData}
        onClose={() => { setPreviewFile(null); setPreviewData([]); setPreviewHeaders([]); }}
        onCopyRef={copyRef}
        onDownload={handleDownload}
      />

      <ConfirmDialog open={!!deleteTarget} title="Delete Data File"
        message="This will permanently delete this data file. Scripts referencing it will fail at runtime."
        confirmLabel="Delete" variant="danger"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}