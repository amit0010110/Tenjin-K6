import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTitle } from '../hooks/useTitle';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { generateScript } from '../lib/ai-generator';
import { Sparkles, Save, Play, ArrowRight, FileText, RefreshCw } from 'lucide-react';

export default function AiScriptGenerator() {
  useTitle('AI Script Generator');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();

  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<{ code: string; templateName: string; score: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scriptName, setScriptName] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      const gen = generateScript(prompt);
      setResult({ code: gen.code, templateName: gen.template.name, score: gen.match.score });
      setScriptName(gen.template.name);
      setGenerating(false);
      setShowPreview(true);
    }, 800);
  };

  const handleSave = async () => {
    if (!pid || !result) return;
    setSaving(true);
    try {
      const script = await api.createScript(pid, { name: scriptName || 'AI Generated Script', content: result.code });
      toast.success('Plan created from AI generation');
      navigate(`/projects/${pid}/plans/${script.id}`);
    } catch { toast.error('Failed to save script'); }
    setSaving(false);
  };

  const examples = [
    'Create a CRUD API test for /api/users with 50 VUs running for 5 minutes',
    'Build a WebSocket chat simulation with 100 concurrent users',
    'Generate a browser test for e-commerce checkout flow',
    'Create a GraphQL query test for a blog API',
    'Build a spike test that jumps from 0 to 500 users in 10 seconds',
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="AI Script Generator"
        subtitle="Describe your test in natural language and get a production-ready k6 script"
      />

      <Card padding="lg" className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Describe your performance test
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Test the login endpoint with JWT authentication, 100 concurrent users ramping up over 30 seconds..."
              rows={4}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 hover:text-brand-700 dark:hover:text-brand-300 rounded-full px-3 py-1.5 transition-colors"
              >
                {ex.length > 50 ? ex.slice(0, 50) + '...' : ex}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate Script'}
            </Button>
            {result && (
              <Button variant="secondary" onClick={() => { setResult(null); setShowPreview(false); setPrompt(''); }}>
                <RefreshCw className="w-4 h-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {generating && (
        <Card padding="lg">
          <div className="flex items-center gap-3 text-gray-500">
            <Sparkles className="w-5 h-5 text-brand-500 animate-pulse" />
            <span className="text-sm">Analyzing your prompt and matching against 20 templates...</span>
          </div>
        </Card>
      )}

      {result && showPreview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300">
                <FileText className="w-3 h-3" />
                {result.templateName}
              </span>
              <span className="text-xs text-gray-400">
                Match score: {result.score}/10
              </span>
            </div>
          </div>

          <Card padding="none">
            <div className="border-b dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Script</span>
              <div className="flex gap-2">
                <input
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="Script name"
                  className="text-sm rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 w-64 focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <Button size="sm" onClick={handleSave} disabled={saving || !scriptName}>
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Create Script'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(!showPreview)}>
                  Hide
                </Button>
              </div>
            </div>
            <pre className="p-4 text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto max-h-[600px] overflow-y-auto bg-white dark:bg-gray-900 leading-relaxed">
              {result.code}
            </pre>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving || !scriptName}>
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Create Script'}
            </Button>
            <Button variant="secondary" onClick={() => { setResult(null); setShowPreview(false); setPrompt(''); }}>
              <RefreshCw className="w-4 h-4" /> Start Over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
