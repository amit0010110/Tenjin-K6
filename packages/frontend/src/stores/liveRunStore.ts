import { create } from 'zustand';

export interface MetricPoint {
  timestamp: number;
  value: number;
  metric: string;
  tags?: Record<string, string>;
}

export interface SysStats {
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
}

interface LiveRunState {
  runId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'aborted';
  metrics: Record<string, MetricPoint[]>;
  log: string[];
  ws: WebSocket | null;
  sysStats: SysStats | null;

  connect: (runId: string) => void;
  disconnect: () => void;
  appendMetric: (point: MetricPoint) => void;
  appendLog: (line: string) => void;
  setStatus: (status: LiveRunState['status']) => void;
  setSysStats: (stats: SysStats) => void;
}

export const useLiveRunStore = create<LiveRunState>((set, get) => ({
  runId: null,
  status: 'idle',
  metrics: {},
  log: [],
  ws: null,
  sysStats: null,

  connect: (runId: string) => {
    const existing = get().ws;
    if (existing) existing.close();

    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    const protocol = (apiUrl ? apiUrl.startsWith('https') : window.location.protocol === 'https:') ? 'wss' : 'ws';
    const host = apiUrl ? apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/api/v1/ws?runId=${runId}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'metric') {
          const point: MetricPoint = {
            timestamp: Date.now(),
            value: msg.data?.data?.value ?? 0,
            metric: msg.data?.metric ?? 'unknown',
            tags: msg.data?.data?.tags,
          };
          get().appendMetric(point);
        } else if (msg.type === 'status') {
          get().setStatus(msg.status as LiveRunState['status']);
        } else if (msg.type === 'sys_stats') {
          get().setSysStats(msg.data as SysStats);
        }
      } catch (err) {
        console.error('LiveMonitor WS parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('LiveMonitor WS error:', err);
    };

    ws.onclose = () => {
      set({ ws: null });
    };

    set({ ws, runId, status: 'running', metrics: {}, log: [], sysStats: null });
  },

  disconnect: () => {
    const { ws } = get();
    ws?.close();
    set({ ws: null, runId: null, status: 'idle' });
  },

  appendMetric: (point: MetricPoint) => {
    set((state) => {
      const key = point.metric;
      const existing = state.metrics[key] || [];
      const updated = [...existing, point].slice(-400);
      return {
        metrics: { ...state.metrics, [key]: updated },
      };
    });
  },

  appendLog: (line: string) => {
    set((state) => ({
      log: [...state.log, line].slice(-500),
    }));
  },

  setStatus: (status) => {
    set({ status });
  },

  setSysStats: (stats) => {
    set({ sysStats: stats });
  },
}));
