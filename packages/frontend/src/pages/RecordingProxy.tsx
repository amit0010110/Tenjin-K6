import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { Button, Input, Select } from '../components/ui';
import { Badge } from '../components/Badge';
import {
  Play, Square, Download, Trash2, List, RefreshCw, ArrowLeft,
  Globe, Target, Monitor, Radio, Terminal, MousePointer,
  Code, Eye, FileText, FileJson, AlertTriangle, ChevronRight,
  Zap, XCircle, ExternalLink, Type, CornerDownLeft, Pointer
} from 'lucide-react';
import { useToastStore } from '../stores/toastStore';
import { generateScript } from '../lib/test-builder/generator';

type RecorderMode = 'http-proxy' | 'playwright';
type BrowserType = 'chromium' | 'firefox' | 'webkit';

interface CapturedRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  timestamp: string;
  durationMs: number;
  source: string;
}

interface CapturedAction {
  id: string;
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  timestamp: string;
}

interface BrowserInfo {
  name: string;
  executablePath: string;
}

interface ScreencastFrame {
  data: string;
  mimeType: string;
  viewport: { width: number; height: number };
  timestamp: number;
}

const WS_BASE = `ws://${window.location.hostname}:${window.location.port || 5173}`;

function toTestBlocks(blocks: any[]): any[] {
  return blocks.map(b => ({
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    type: b.type === 'browser-navigate' ? 'browser-page' : b.type,
    label: b.label,
    children: b.children ? toTestBlocks(b.children) : [],
    properties: b.properties || {},
    enabled: true,
    elseBlocks: [],
  }));
}

export default function RecordingProxy() {
  useTitle('Recording');
  const { pid } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const projectId = pid || 'default';

  const [mode, setMode] = useState<RecorderMode>('http-proxy');
  const [recording, setRecording] = useState(false);
  const [captured, setCaptured] = useState<CapturedRequest[]>([]);
  const [actions, setActions] = useState<CapturedAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  const [targetUrl, setTargetUrl] = useState('http://localhost:3000');
  const [pwTargetUrl, setPwTargetUrl] = useState('');
  const [browserType, setBrowserType] = useState<BrowserType>('chromium');
  const [headless, setHeadless] = useState(false);
  const [availableBrowsers, setAvailableBrowsers] = useState<BrowserInfo[]>([]);
  const [browserInfo, setBrowserInfo] = useState<string | null>(null);
  const [commandUrl, setCommandUrl] = useState('');
  const [commandSelector, setCommandSelector] = useState('');
  const [commandValue, setCommandValue] = useState('');

  // Filter state
  const [filterInclude, setFilterInclude] = useState('');
  const [filterExclude, setFilterExclude] = useState('*.css, *.js, *.png, *.ico, *.svg, *.woff, *.woff2, *.ttf, *.eot');
  const [filterMethods, setFilterMethods] = useState<string[]>(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
  const [showFilter, setShowFilter] = useState(false);
  const [generatedBlocks, setGeneratedBlocks] = useState<any[]>([]);

  // Create script dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [scriptName, setScriptName] = useState('');

  const [activityLog, setActivityLog] = useState<string[]>([]);
  const activityRef = useRef<HTMLDivElement>(null);

  const [screencastFrame, setScreencastFrame] = useState<ScreencastFrame | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const browserViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCaptured();
    api.listBrowsers().then(data => {
      setAvailableBrowsers(data.browsers || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (recording) {
      interval = setInterval(loadCaptured, 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [recording]);

  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight;
    }
  }, [activityLog]);

  // Playwright WebSocket connection
  useEffect(() => {
    if (mode === 'playwright' && recording) {
      connectWs();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setScreencastFrame(null);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [mode, recording]);

  const connectWs = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    try {
      const ws = new WebSocket(`${WS_BASE}/api/v1/ws/playwright?projectId=${projectId}`);
      ws.onopen = () => {
        addLog('Browser WebSocket connected');
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'screencast') {
            setScreencastFrame(msg.data as ScreencastFrame);
          } else if (msg.type === 'request' || msg.type === 'response') {
            // traffic captured — handled by poll
          } else if (msg.type === 'action') {
            if (msg.data.type !== 'wheel') {
              addLog(`${msg.data.type}${msg.data.url || msg.data.selector || msg.data.value ? ' ' + (msg.data.url || msg.data.selector || msg.data.value) : ''}`);
            }
          } else if (msg.type === 'state') {
            if (msg.data.message) addLog(msg.data.message);
          } else if (msg.type === 'error') {
            toast.error(msg.data?.message || 'Browser error');
          } else if (msg.type === 'result') {
            addLog(`Command result: ${msg.data?.command || 'ok'}`);
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => {
        addLog('Browser WebSocket error');
      };
      ws.onclose = () => {
        addLog('Browser WebSocket disconnected');
        if (recording) {
          // will auto-reconnect on next render cycle
        }
      };
      wsRef.current = ws;
    } catch (err: any) {
      addLog(`Failed to connect: ${err.message}`);
    }
  };

  // Handle click on browser view → forward coordinates
  const handleBrowserClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!screencastFrame || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const rect = browserViewRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Focus the browser view so keyboard events are captured
    browserViewRef.current?.focus();

    const scaleX = screencastFrame.viewport.width / rect.width;
    const scaleY = screencastFrame.viewport.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    wsRef.current.send(JSON.stringify({
      type: 'command',
      data: { type: 'clickAt', x, y },
    }));
    addLog(`Clicked at viewport (${x}, ${y})`);
  }, [screencastFrame]);

  // Forward mouse wheel scroll to Playwright — use ref + non-passive listener so preventDefault works
  const browserWheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  useEffect(() => {
    const el = browserViewRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!screencastFrame || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const rect = el.getBoundingClientRect();
      if (!rect) return;
      const scaleX = screencastFrame.viewport.width / rect.width;
      const scaleY = screencastFrame.viewport.height / rect.height;
      wsRef.current.send(JSON.stringify({
        type: 'command',
        data: { type: 'wheel', deltaX: Math.round(e.deltaX * scaleX), deltaY: Math.round(e.deltaY * scaleY) },
      }));
    };
    browserWheelHandlerRef.current = handler;
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [screencastFrame]);

  // Handle keyboard input on browser view → forward keystrokes to Playwright
  const handleBrowserKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!screencastFrame) return;

    const key = e.key;

    // Ignore modifier-only keys
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;

    // Ignore browser shortcuts (Cmd/Win held with another key)
    if (e.metaKey || e.ctrlKey) {
      // Allow Ctrl/Cmd+C, Ctrl/Cmd+V through but those are browser shortcuts
      if (key === 'c' || key === 'v' || key === 'x' || key === 'a' ||
          key === 'w' || key === 't' || key === 'r' || key === 'z') return;
      return;
    }

    e.preventDefault();

    const specialKeys: Record<string, string> = {
      'Enter': 'Enter',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Escape': 'Escape',
      'Delete': 'Delete',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
    };

    if (key in specialKeys) {
      wsRef.current.send(JSON.stringify({
        type: 'command',
        data: { type: 'pressKey', key: specialKeys[key] },
      }));
      addLog(`Key: ${key}`);
    } else if (key.length === 1) {
      // Single printable character
      wsRef.current.send(JSON.stringify({
        type: 'command',
        data: { type: 'typeText', value: key },
      }));
    }
  }, [screencastFrame]);

  const loadCaptured = async () => {
    try {
      const data = await api.getRecordingCaptured(projectId);
      setCaptured(data.captured || []);
      setActions(data.actions || []);
      setRecording(data.recording || false);
      if (data.mode) setMode(data.mode as RecorderMode);
      if (data.targetUrl) {
        if (data.mode === 'playwright') {
          setPwTargetUrl(data.targetUrl);
        } else {
          setTargetUrl(data.targetUrl);
        }
      }
      if (data.browserType) setBrowserType(data.browserType as BrowserType);
    } catch { /* ignore */ }
  };

  const addLog = (msg: string) => {
    setActivityLog(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const buildFilter = () => {
    const filter: Record<string, any> = {};
    const includes = filterInclude.split(',').map(s => s.trim()).filter(Boolean);
    const excludes = filterExclude.split(',').map(s => s.trim()).filter(Boolean);
    if (includes.length > 0) filter.includePatterns = includes;
    if (excludes.length > 0) filter.excludePatterns = excludes;
    if (filterMethods.length > 0 && filterMethods.length < 5) filter.methods = filterMethods;
    return Object.keys(filter).length > 0 ? filter : undefined;
  };

  const createPlanFromRecording = async () => {
    if (!scriptName.trim()) { toast.error('Plan name required'); return; }
    try {
      const testBlocks = toTestBlocks(generatedBlocks);
      const code = generateScript(testBlocks);
      const script = await api.createScript(projectId, { name: scriptName, content: code });
      await api.saveBlocks(script.id, JSON.stringify(testBlocks));
      toast.success(`Test plan "${scriptName}" created`);
      setShowCreateDialog(false);
      setScriptName('');
      navigate(`/projects/${pid}/plans/${script.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create plan');
    }
  };

  const startProxyRecording = async () => {
    setLoading(true);
    try {
      const filter = buildFilter();
      const res = await api.startRecording(targetUrl, { mode: 'http-proxy', filter }, projectId);
      setRecording(true);
      setMode('http-proxy');
      localStorage.setItem('recording_target_url', targetUrl);
      addLog(`Proxy recording started → ${targetUrl}`);
      toast.success('Proxy recording started');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start');
    }
    setLoading(false);
  };

  const startPlaywrightRecording = async () => {
    if (!pwTargetUrl.trim()) { toast.error('Target URL is required'); return; }
    setLoading(true);
    try {
      const filter = buildFilter();
      const res = await api.startRecording(pwTargetUrl, { mode: 'playwright', browserType, headless, filter }, projectId);
      setRecording(true);
      setMode('playwright');
      localStorage.setItem('recording_target_url', pwTargetUrl);
      setBrowserInfo(`Browser: ${browserType}${headless ? ' (headless)' : ''} | WS: ${res.browserWsEndpoint || 'N/A'}`);
      addLog(`Interactive Browser (${browserType}) session started → ${pwTargetUrl}`);
      toast.success('Interactive Browser session started');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Interactive Browser');
    }
    setLoading(false);
  };

  const sendWsCommand = (type: string, extra: Record<string, unknown> = {}) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Browser WebSocket not connected');
      return;
    }
    const cmd: Record<string, unknown> = { type, ...extra };
    wsRef.current.send(JSON.stringify({ type: 'command', data: cmd }));
    addLog(`Command: ${type} ${Object.values(extra).filter(Boolean).join(' ')}`);
  };

  const sendCommand = async (type: string) => {
    try {
      const cmd: any = { type };
      if (type === 'navigate' && commandUrl) cmd.url = commandUrl;
      if ((type === 'click' || type === 'fill' || type === 'hover' || type === 'select') && commandSelector) cmd.selector = commandSelector;
      if ((type === 'fill' || type === 'select') && commandValue) cmd.value = commandValue;

      const res = await api.executePlaywrightCommand(cmd, projectId);
      addLog(`Command: ${type} — OK`);
      loadCaptured();
      if (type !== 'navigate' || true) {
        setCommandUrl('');
        setCommandSelector('');
        setCommandValue('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Command failed');
      addLog(`Command failed: ${type} — ${err.message}`);
    }
  };

  const stopRec = async () => {
    setLoading(true);
    try {
      const res = await api.stopRecording(projectId);
      setRecording(false);
      setScreencastFrame(null);
      addLog(`Recording stopped — ${res.captured} requests, ${res.actions || 0} actions`);
      toast.success('Recording stopped');
      loadCaptured();
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop');
    }
    setLoading(false);
  };

  const clearAll = async () => {
    try {
      await api.clearRecording(projectId);
      setCaptured([]);
      setActions([]);
      setActivityLog([]);
      setGeneratedCount(0);
      toast.success('Cleared');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear');
    }
  };

  const generateBlocks = async () => {
    setLoading(true);
    try {
      const result = await api.generateRecordingBlocks(projectId);
      setGeneratedCount(result.count || 0);
      setGeneratedBlocks(result.blocks || []);
      addLog(`Generated ${result.count} blocks from ${result.source} mode`);
      toast.success(`Generated ${result.count} blocks`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate blocks');
    }
    setLoading(false);
  };

  const methodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-green-600 dark:text-green-400';
      case 'POST': return 'text-blue-600 dark:text-blue-400';
      case 'PUT': return 'text-orange-600 dark:text-orange-400';
      case 'DELETE': return 'text-red-600 dark:text-red-400';
      case 'PATCH': return 'text-purple-600 dark:text-purple-400';
      default: return '';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Recorder"
        subtitle="Capture HTTP traffic or browser sessions and convert to test blocks"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/correlation`, { state: { targetUrl: mode === 'playwright' ? pwTargetUrl : targetUrl } })} disabled={captured.length === 0}>
              <Target className="w-4 h-4" /> Auto-Correlate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${pid}/plans`)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>
        }
      />

      {/* Mode Toggle */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => { if (!recording) setMode('http-proxy'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'http-proxy'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Globe className="w-4 h-4" /> HTTP Proxy
        </button>
        <button
          onClick={() => { if (!recording) setMode('playwright'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'playwright'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Monitor className="w-4 h-4" /> Interactive Browser
        </button>
      </div>

      {/* HTTP Proxy Mode */}
      {mode === 'http-proxy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Proxy Target
            </h3>
            <div className="flex gap-2">
              <Input
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="http://localhost:3000"
                disabled={recording}
                className="flex-1"
              />
              {!recording ? (
                <Button size="sm" onClick={startProxyRecording} disabled={loading || !targetUrl.trim()}>
                  <Play className="w-4 h-4" /> Start
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={stopRec} disabled={loading}>
                  <Square className="w-4 h-4" /> Stop
                </Button>
              )}
            </div>
            {recording && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-green-600 dark:text-green-400">Recording</span>
                <span className="text-gray-400 ml-2">
                  Set your app proxy to <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">http://&lt;host&gt;:3001/api/v1/recording/proxy</code>
                </span>
              </div>
            )}

            {/* Filters */}
            <FilterSection
              showFilter={showFilter}
              setShowFilter={setShowFilter}
              filterInclude={filterInclude}
              setFilterInclude={setFilterInclude}
              filterExclude={filterExclude}
              setFilterExclude={setFilterExclude}
              filterMethods={filterMethods}
              setFilterMethods={setFilterMethods}
              disabled={recording}
            />
          </Card>

          {/* Side Panel */}
          <Card className="p-5 flex flex-col">
            <h3 className="text-sm font-medium mb-3">Controls</h3>
            <div className="space-y-2">
              <Button size="sm" variant="secondary" onClick={generateBlocks} disabled={loading || captured.length === 0} className="w-full">
                <Download className="w-4 h-4" /> Generate Blocks ({captured.length})
              </Button>
              <Button size="sm" variant="secondary" onClick={clearAll} disabled={captured.length === 0} className="w-full">
                <Trash2 className="w-4 h-4" /> Clear All
              </Button>
              <Button size="sm" variant="ghost" onClick={loadCaptured} className="w-full">
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>
            {generatedCount > 0 && (
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300 space-y-2">
                <div>Generated {generatedCount} blocks</div>
                <Button size="sm" onClick={() => setShowCreateDialog(true)} className="w-full">
                  <FileText className="w-3 h-3" /> Create Test Plan
                </Button>
              </div>
            )}
            {activityLog.length > 0 && (
              <div className="mt-4 flex-1 min-h-0">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Activity</h4>
                <div ref={activityRef} className="text-[11px] font-mono text-gray-500 dark:text-gray-400 space-y-0.5 max-h-32 overflow-y-auto">
                  {activityLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Playwright Mode */}
      {mode === 'playwright' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Browser View */}
            <div className="lg:col-span-2 space-y-4">
              {/* Launch / Stop bar */}
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Input
                    value={pwTargetUrl}
                    onChange={e => setPwTargetUrl(e.target.value)}
                    placeholder="https://example.com"
                    disabled={recording}
                    className="flex-1"
                  />
                  {!recording ? (
                    <>
                      <Select
                        value={browserType}
                        onChange={(v) => setBrowserType(v as BrowserType)}
                        options={['chromium', 'firefox', 'webkit']
                          .filter(b => availableBrowsers.some(bi => bi.name === b))
                          .map(b => ({ label: b, value: b }))}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                        <input type="checkbox" checked={headless} onChange={e => setHeadless(e.target.checked)} className="rounded" />
                        Headless
                      </label>
                      <Button size="sm" onClick={startPlaywrightRecording} disabled={loading || !pwTargetUrl.trim()}>
                        <Play className="w-4 h-4" /> Launch
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {browserInfo}
                      </span>
                      <Button size="sm" variant="secondary" onClick={stopRec} disabled={loading}>
                        <Square className="w-4 h-4" /> Stop
                      </Button>
                    </>
                  )}
                </div>
              </Card>

              {/* Filters */}
              <FilterSection
                showFilter={showFilter}
                setShowFilter={setShowFilter}
                filterInclude={filterInclude}
                setFilterInclude={setFilterInclude}
                filterExclude={filterExclude}
                setFilterExclude={setFilterExclude}
                filterMethods={filterMethods}
                setFilterMethods={setFilterMethods}
                disabled={recording}
              />

              {/* Live Browser Screenshot */}
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" />
                    Browser View
                    {screencastFrame && (
                      <span className="text-gray-400 font-normal">
                        — click to focus, then type to interact
                      </span>
                    )}
                  </span>
                  {screencastFrame && (
                    <span className="text-[10px] text-gray-400">
                      {screencastFrame.viewport.width}×{screencastFrame.viewport.height}
                    </span>
                  )}
                </div>
                <div
                  ref={browserViewRef}
                  tabIndex={0}
                  className="relative bg-white dark:bg-gray-900 cursor-crosshair outline-none"
                  style={{ minHeight: screencastFrame ? 'auto' : '300px' }}
                  onClick={handleBrowserClick}
                  onKeyDown={handleBrowserKeyDown}
                  onMouseDown={() => browserViewRef.current?.focus()}
                >
                  {screencastFrame ? (
                    <img
                      src={`data:${screencastFrame.mimeType};base64,${screencastFrame.data}`}
                      alt="Browser view"
                      className="w-full h-auto select-none"
                      draggable={false}
                    />
                  ) : recording ? (
                    <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-indigo-500"></div>
                        <span>Waiting for browser screenshot...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                      Launch a browser to start recording
                    </div>
                  )}
                </div>
              </Card>

              {/* Browser Commands */}
              {recording && (
                <Card className="p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" /> Browser Commands
                  </h4>

                  {/* Row 1: Navigate */}
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={commandUrl}
                      onChange={e => setCommandUrl(e.target.value)}
                      placeholder="URL to navigate..."
                      className="flex-1 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') sendCommand('navigate'); }}
                    />
                    <Button size="sm" onClick={() => sendCommand('navigate')} disabled={!commandUrl.trim()}>
                      <Globe className="w-3 h-3" /> Go
                    </Button>
                  </div>

                  {/* Row 2: Click / Hover by selector */}
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={commandSelector}
                      onChange={e => setCommandSelector(e.target.value)}
                      placeholder="CSS selector to click..." 
                      className="flex-1 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') sendCommand('click'); }}
                    />
                    <Button size="sm" variant="secondary" onClick={() => sendCommand('click')} disabled={!commandSelector.trim()}>
                      <MousePointer className="w-3 h-3" /> Click
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendCommand('hover')} disabled={!commandSelector.trim()}>
                      Hover
                    </Button>
                  </div>

                  {/* Row 3: Fill */}
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={commandSelector}
                      onChange={e => setCommandSelector(e.target.value)}
                      placeholder="Selector to fill..."
                      className="flex-1 text-xs"
                    />
                    <Input
                      value={commandValue}
                      onChange={e => setCommandValue(e.target.value)}
                      placeholder="Value..."
                      className="w-48 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') sendCommand('fill'); }}
                    />
                    <Button size="sm" variant="secondary" onClick={() => sendCommand('fill')} disabled={!commandSelector.trim()}>
                      <Type className="w-3 h-3" /> Fill
                    </Button>
                  </div>

                  {/* Row 4: Quick actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => sendWsCommand('typeText', { value: commandValue || ' ' })} disabled={!commandValue.trim()}>
                      <Type className="w-3 h-3" /> Type
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendWsCommand('pressKey', { key: 'Enter' })}>
                      <CornerDownLeft className="w-3 h-3" /> Enter
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendWsCommand('screenshot')}>
                      <Eye className="w-3 h-3" /> Screenshot
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendWsCommand('wait', { timeout: 2000 })}>
                      Wait 2s
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendWsCommand('close')}>
                      <XCircle className="w-3 h-3" /> Close Browser
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            {/* Right Side Panel */}
            <Card className="p-5 flex flex-col">
              <h3 className="text-sm font-medium mb-3">Controls</h3>
              <div className="space-y-2">
                <Button size="sm" variant="secondary" onClick={generateBlocks} disabled={loading || captured.length === 0} className="w-full">
                  <Download className="w-4 h-4" /> Generate Blocks ({captured.length})
                </Button>
                <Button size="sm" variant="secondary" onClick={clearAll} disabled={captured.length === 0} className="w-full">
                  <Trash2 className="w-4 h-4" /> Clear All
                </Button>
                <Button size="sm" variant="ghost" onClick={loadCaptured} className="w-full">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </Button>
              </div>

              {generatedCount > 0 && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300 space-y-2">
                  <div>Generated {generatedCount} blocks</div>
                  <Button size="sm" onClick={() => setShowCreateDialog(true)} className="w-full">
                    <FileText className="w-3 h-3" /> Create Test Plan
                  </Button>
                </div>
              )}

              {/* Activity log */}
              {activityLog.length > 0 && (
                <div className="mt-4 flex-1 min-h-0">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Activity</h4>
                  <div ref={activityRef} className="text-[11px] font-mono text-gray-500 dark:text-gray-400 space-y-0.5 max-h-32 overflow-y-auto">
                    {activityLog.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Captured Requests List */}
      <Card>
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <List className="w-4 h-4" /> Captured Requests
            <span className="text-xs text-gray-400">({captured.length})</span>
          </h3>
        </div>

        {captured.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {recording
              ? 'Waiting for requests...'
              : `No captured requests. Start ${mode === 'http-proxy' ? 'proxy' : 'interactive browser'} recording to capture traffic.`
            }
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700 max-h-[500px] overflow-y-auto">
            {captured.map((req, i) => (
              <details key={req.id || i} className="group">
                <summary className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-xs">
                  <span className={`font-mono font-bold ${methodColor(req.method)}`}>{req.method}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    req.statusCode < 300
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : req.statusCode < 400
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>{req.statusCode}</span>
                  <span className="text-gray-600 dark:text-gray-300 truncate flex-1">{decodeURIComponent(req.url)}</span>
                  <span className="text-gray-400">{req.durationMs}ms</span>
                  {req.source === 'playwright' && <span title="Captured via Interactive Browser Session"><Monitor className="w-3 h-3 text-gray-400" /></span>}
                </summary>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-xs space-y-2">
                  <div>
                    <span className="text-gray-400 font-medium">Headers:</span>
                    <pre className="mt-1 text-gray-600 dark:text-gray-300 overflow-x-auto max-h-32">{JSON.stringify(req.headers, null, 2)}</pre>
                  </div>
                  {req.body && (
                    <div>
                      <span className="text-gray-400 font-medium">Body:</span>
                      <pre className="mt-1 text-gray-600 dark:text-gray-300 overflow-x-auto max-h-32">{req.body}</pre>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 font-medium">Response Headers:</span>
                    <pre className="mt-1 text-gray-600 dark:text-gray-300 overflow-x-auto max-h-32">{JSON.stringify(req.responseHeaders, null, 2)}</pre>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">Response Body:</span>
                    <pre className="mt-1 text-gray-600 dark:text-gray-300 overflow-x-auto max-h-32 font-mono text-[11px]">
                      {(req.responseBody || '').substring(0, 2000)}{(req.responseBody || '').length > 2000 ? '... [truncated]' : ''}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      {/* Create Test Plan Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Create Test Plan from Recording</h3>
            <p className="text-xs text-gray-500 mb-4">{generatedCount} blocks will be saved as a visual test plan. You can open it in the editor to add assertions, correlations, and thresholds.</p>
            <Input
              value={scriptName}
              onChange={e => setScriptName(e.target.value)}
              placeholder="My API Test"
              className="w-full mb-4"
              onKeyDown={e => { if (e.key === 'Enter') createPlanFromRecording(); }}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={createPlanFromRecording} disabled={!scriptName.trim()}>
                <FileText className="w-3 h-3" /> Create Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Section Component ──

function FilterSection({
  showFilter, setShowFilter,
  filterInclude, setFilterInclude,
  filterExclude, setFilterExclude,
  filterMethods, setFilterMethods,
  disabled,
}: {
  showFilter: boolean;
  setShowFilter: (v: boolean) => void;
  filterInclude: string;
  setFilterInclude: (v: string) => void;
  filterExclude: string;
  setFilterExclude: (v: string) => void;
  filterMethods: string[];
  setFilterMethods: React.Dispatch<React.SetStateAction<string[]>>;
  disabled: boolean;
}) {
  const allMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const toggleMethod = (m: string) => {
    setFilterMethods((prev: string[]) =>
      prev.includes(m) ? prev.filter((x: string) => x !== m) : [...prev, m]
    );
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setShowFilter(!showFilter)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg className={`w-3 h-3 transition-transform ${showFilter ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        Filters
        {(filterInclude || filterExclude || filterMethods.length < 5) && (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
        )}
      </button>
      {showFilter && (
        <div className="mt-2 space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Include URLs (comma-separated, * wildcard)</label>
            <Input
              value={filterInclude}
              onChange={e => setFilterInclude(e.target.value)}
              placeholder="api.example.com/*, /api/v1/**"
              disabled={disabled}
              className="text-xs mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Exclude URLs</label>
            <Input
              value={filterExclude}
              onChange={e => setFilterExclude(e.target.value)}
              placeholder="*.css, *.js, *.png"
              disabled={disabled}
              className="text-xs mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Methods</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {allMethods.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMethod(m)}
                  disabled={disabled}
                  className={`text-[11px] px-2 py-0.5 rounded font-mono transition-colors ${
                    filterMethods.includes(m)
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
