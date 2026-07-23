import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Select } from '../components/ui';
import { Badge } from '../components/Badge';
import Modal from '../components/Modal';
import {
  Lightbulb, Copy, ArrowLeft, Code,
  CheckCircle, XCircle,
  Trash2, Zap,
  Target, FileJson, FileText, Search
} from 'lucide-react';
import { useToastStore } from '../stores/toastStore';
import { generateScript } from '../lib/test-builder/generator';

interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  timestamp: string;
  durationMs: number;
}

interface Suggestion {
  name: string;
  requestIndex: number;
  location: 'header' | 'json' | 'body';
  extractPath: string;
  variableName: string;
  sampleValue: string;
  usedInRequests: number[];
  begin?: string;
  end?: string;
  score?: number;
}

type ExtractType = 'begin-end' | 'regex' | 'jsonpath';

interface CorrelationRule {
  id: string;
  enabled: boolean;
  original: Suggestion;
  variableName: string;
  extractLocation: 'header' | 'json' | 'body';
  extractPath: string;
  extractType: ExtractType;
  begin: string;
  end: string;
  pattern: string;
}

export default function AutoCorrelation() {
  useTitle('Auto-Correlation');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();

  const [captured, setCaptured] = useState<CapturedRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rules, setRules] = useState<CorrelationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [scriptName, setScriptName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    api.getRecordingCaptured(pid).then(data => {
      setCaptured(data.captured || []);
    }).catch(() => {});
  }, [pid]);

  const analyze = async () => {
    if (captured.length === 0) { toast.error('No captured requests. Record traffic first.'); return; }

    setLoading(true);
    try {
      const data = await api.analyzeCorrelation('', captured);
      setSuggestions(data.suggestions || []);
      setAnalyzed(true);

      const autoRules: CorrelationRule[] = (data.suggestions || []).map((s: Suggestion) => ({
        id: Math.random().toString(36).slice(2),
        enabled: true,
        original: s,
        variableName: s.variableName,
        extractLocation: s.location === 'header' ? 'header' : s.location === 'json' ? 'json' : 'body',
        extractPath: s.extractPath,
        extractType: s.location === 'header' ? 'begin-end' : 'jsonpath',
        begin: s.begin || '',
        end: s.end || '',
        pattern: '',
      }));
      setRules(autoRules);

      if (data.suggestions?.length > 0) {
        toast.success(`Found ${data.suggestions.length} possible correlation points`);
      } else {
        toast.success('No dynamic values detected — requests appear static');
      }
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
    setLoading(false);
  };

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const updateRule = (id: string, updates: Partial<CorrelationRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const applyRules = async () => {
    const enabledRules = rules.filter(r => r.enabled);
    if (enabledRules.length === 0) { toast.error('No rules enabled'); return; }
    setScriptName('');
    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    const name = scriptName.trim();
    if (!name) { toast.error('Please enter a test flow name'); return; }
    const enabledRules = rules.filter(r => r.enabled);
    if (enabledRules.length === 0) { toast.error('No rules enabled'); return; }

    setShowSaveDialog(false);
    try {
      const data = await api.generateCorrelationBlocks(captured, enabledRules.map(r => ({
        variableName: r.variableName,
        extractLocation: r.extractLocation,
        extractPath: r.extractPath,
        extractType: r.extractType,
        begin: r.begin,
        end: r.end,
        pattern: r.pattern,
        requestIndex: r.original.requestIndex,
        sampleValue: r.original.sampleValue,
        usedInRequests: r.original.usedInRequests,
      })));
      if (data.blocks?.length > 0) {
        const testBlocks = convertBlockTree(data.blocks);
        const code = generateScript(testBlocks);
        const script = await api.createScript(pid!, {
          name,
          content: code,
        });
        await api.saveBlocks(script.id, JSON.stringify(testBlocks));
        toast.success(`Created script with ${testBlocks.length} blocks (API requests + correlation)`);
        navigate(`/projects/${pid}/plans/${script.id}`);
      } else {
        toast.error('No blocks generated');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate blocks');
    }
  };

  const generatePreviewCode = () => {
    const enabled = rules.filter(r => r.enabled);
    const lines: string[] = [];
    enabled.forEach((r, i) => {
      if (i === 0) lines.push('// === Auto-Correlation Rules ===');
      lines.push('');
      if (r.extractType === 'jsonpath') {
        lines.push(`// Extract from JSON response: $.${r.extractPath}`);
        lines.push(`const ${r.variableName} = response.json().${r.extractPath};`);
      } else if (r.extractType === 'begin-end' && r.begin) {
        const endStr = r.end || '\\n';
        lines.push(`// Extract between "${r.begin}" and "${endStr}"`);
        lines.push(`const ${r.variableName} = response.body.match(/${escapeRegex(r.begin)}([^${escapeRegex(endStr)}]+)${escapeRegex(endStr)}/)[1];`);
      } else if (r.extractType === 'regex' && r.pattern) {
        lines.push(`// Extract using regex: ${r.pattern}`);
        lines.push(`const ${r.variableName} = response.body.match(/${r.pattern}/)[1];`);
      } else if (r.extractLocation === 'header') {
        lines.push(`// Extract from response header: ${r.extractPath}`);
        lines.push(`const ${r.variableName} = response.headers('${r.extractPath}');`);
      }

      const reqIndices = r.original.usedInRequests || [];
      if (reqIndices.length > 0) {
        lines.push(`// Used in subsequent request(s): #${reqIndices.map(i => i + 1).join(', #')}`);
      }
    });

    setPreviewCode(lines.join('\n'));
    setShowPreview(true);
  };

  const copyAllCode = () => {
    navigator.clipboard.writeText(previewCode);
    toast.success('Correlation code copied');
  };

  const methodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'POST': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'PUT': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      case 'DELETE': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'PATCH': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const locationIcon = (loc: string) => {
    switch (loc) {
      case 'header': return <FileText className="w-3.5 h-3.5" />;
      case 'json': return <FileJson className="w-3.5 h-3.5" />;
      default: return <Code className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Auto-Correlation"
        subtitle="Analyze captured requests to detect dynamic values and generate correlation rules"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/recording`)}>
              <ArrowLeft className="w-4 h-4" /> Recording
            </Button>
          </div>
        }
      />

      {/* Step 1: Analyze */}
      <Card padding="md" className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">1</div>
          <h3 className="font-semibold text-sm">Detect Dynamic Values</h3>
          <span className="text-xs text-gray-400">{captured.length} requests captured</span>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={analyze} disabled={loading || captured.length === 0}>
              {loading ? <><Code className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Search className="w-4 h-4" /> Analyze Captured Requests</>}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Scans captured responses for values that are reused in subsequent requests — no replay needed.
            Detects tokens, session IDs, CSRF tokens, and other dynamic values automatically.
          </p>
        </div>
      </Card>

      {/* Step 2: Review Correlation Rules */}
      {analyzed && (
        <Card padding="md" className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full bg-amber-500 dark:bg-amber-900/40 flex items-center justify-center text-xs font-bold text-white dark:text-amber-400">2</div>
            <h3 className="font-semibold text-sm">Review &amp; Edit Correlation Rules</h3>
            <Badge variant={suggestions.length > 0 ? 'warning' : 'success'}>
              {suggestions.length > 0 ? `${suggestions.length} rules` : 'No dynamic values'}
            </Badge>
            <span className="text-xs text-gray-400 ml-auto">
              {rules.filter(r => r.enabled).length} enabled
            </span>
          </div>

          {suggestions.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 mx-auto text-green-400 mb-2" />
              <p className="text-sm text-gray-500">No correlation points detected — all values appear static across requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const s = rule.original;
                return (
                  <Card key={rule.id} padding="sm" className={`border ${rule.enabled ? 'border-brand-300 dark:border-brand-700' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggleRule(rule.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Lightbulb className={`w-4 h-4 ${rule.enabled ? 'text-amber-500' : 'text-gray-300'}`} />
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{s.name}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            rule.extractLocation === 'header' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            rule.extractLocation === 'json' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {locationIcon(rule.extractLocation)} {rule.extractLocation}
                          </span>
                          {s.score && s.score > 100 && (
                            <Badge variant="warning">High relevance</Badge>
                          )}
                          {s.score && s.score >= 50 && s.score <= 100 && (
                            <Badge variant="info">Medium</Badge>
                          )}
                          {s.usedInRequests.length > 0 && (
                            <span className="text-[10px] text-gray-400">
                              used in #{s.usedInRequests.map(i => i + 1).join(', #')}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">Extract</span>
                            <span className="text-xs font-mono text-gray-900 dark:text-gray-200">{rule.extractPath}</span>
                          </div>
                          <span className="text-gray-300">|</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Sample:</span>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{s.sampleValue}</code>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-400 w-12 shrink-0">Type:</label>
                            <Select
                              value={rule.extractType}
                              onChange={(v) => updateRule(rule.id, { extractType: v as ExtractType })}
                              options={[
                                { label: 'Begin-End', value: 'begin-end' },
                                { label: 'Regex', value: 'regex' },
                                { label: 'JSONPath', value: 'jsonpath' },
                              ]}
                            />
                          </div>
                          {rule.extractType === 'begin-end' && (
                            <>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-gray-400 w-8 shrink-0">Begin:</label>
                                <input
                                  value={rule.begin}
                                  onChange={e => updateRule(rule.id, { begin: e.target.value })}
                                  className="text-[11px] px-1.5 py-0.5 border dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-full font-mono"
                                  placeholder="csrf_token="
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-gray-400 w-8 shrink-0">End:</label>
                                <input
                                  value={rule.end}
                                  onChange={e => updateRule(rule.id, { end: e.target.value })}
                                  className="text-[11px] px-1.5 py-0.5 border dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-full font-mono"
                                  placeholder=";"
                                />
                              </div>
                            </>
                          )}
                          {rule.extractType === 'regex' && (
                            <div className="md:col-span-2 flex items-center gap-2">
                              <label className="text-[10px] text-gray-400 w-12 shrink-0">Pattern:</label>
                              <input
                                value={rule.pattern}
                                onChange={e => updateRule(rule.id, { pattern: e.target.value })}
                                className="text-[11px] px-1.5 py-0.5 border dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-full font-mono"
                                placeholder="csrf_token=([^;]+)"
                              />
                            </div>
                          )}
                          {rule.extractType === 'jsonpath' && (
                            <div className="md:col-span-2" />
                          )}
                        </div>

                        {rule.extractType === 'jsonpath' && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <label className="text-[10px] text-gray-400 shrink-0">Path editable:</label>
                            <input
                              value={rule.extractPath}
                              onChange={e => updateRule(rule.id, { extractPath: e.target.value })}
                              className="text-[11px] px-1.5 py-0.5 border dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex-1 font-mono"
                              placeholder="data.token"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => removeRule(rule.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove rule">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={applyRules} disabled={rules.filter(r => r.enabled).length === 0}>
                  <Zap className="w-4 h-4" /> Apply to Script Builder
                </Button>
                <Button variant="secondary" onClick={generatePreviewCode} disabled={rules.filter(r => r.enabled).length === 0}>
                  <Code className="w-4 h-4" /> Preview Code
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Code Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Code className="w-4 h-4" /> Correlation Code Preview
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={copyAllCode}>
                  <Copy className="w-3.5 h-3.5" /> Copy All
                </Button>
                <button onClick={() => setShowPreview(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <pre className="p-4 overflow-auto flex-1 text-xs font-mono bg-gray-900 text-green-400 leading-relaxed whitespace-pre">
              {previewCode}
            </pre>
          </div>
        </div>
      )}

      {/* Save dialog */}
      <Modal open={showSaveDialog} onClose={() => setShowSaveDialog(false)} title="Save Test Flow" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Enter a name for the correlated test flow:
        </p>
        <input
          autoFocus
          value={scriptName}
          onChange={e => setScriptName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmSave(); }}
          placeholder="My Correlated Test"
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={confirmSave}>Save</Button>
        </div>
      </Modal>

      {/* Empty state */}
      {!analyzed && captured.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Lightbulb className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">No recording data</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
              Record HTTP traffic first using the Recording Proxy, then come here to detect dynamic values and generate correlation rules.
            </p>
            <Button onClick={() => navigate(`/projects/${pid}/recording`)}>
              <ArrowLeft className="w-4 h-4" /> Go to Recording
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function convertBlockTree(blocks: any[]): any[] {
  return blocks.map(b => ({
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    type: b.type === 'browser-navigate' ? 'browser-page' : b.type,
    label: b.label || '',
    children: b.children ? convertBlockTree(b.children) : [],
    properties: b.properties || {},
    enabled: true,
    elseBlocks: [],
  }));
}
