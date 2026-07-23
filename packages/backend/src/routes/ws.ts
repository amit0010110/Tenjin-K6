import { logger } from '../lib/logger.js';
import { recorderManager } from '../lib/recorder/session.js';
import { PlaywrightRecorder } from '../lib/recorder/playwright.js';
import type { Server as WSServer, WebSocket as WSConn } from 'ws';
import { IncomingMessage } from 'http';

let WebSocketServer: any;
let WS: any;

async function initWs(): Promise<void> {
  const mod = await import('ws') as any;
  const wsModule = mod.default || mod;
  WebSocketServer = wsModule.Server;
  WS = wsModule;
}

const subscriptions = new Map<string, Set<WSConn>>();
let runWss: any = null;
let pwWss: any = null;

export function broadcastMetric(runId: string, data: unknown): void {
  const clients = subscriptions.get(runId);
  if (!clients) return;
  for (const ws of clients) {
    if (ws.readyState === WS!.OPEN) {
      ws.send(JSON.stringify({ type: 'metric', data }));
    }
  }
}

export function broadcastStatus(runId: string, status: string): void {
  const clients = subscriptions.get(runId);
  if (!clients) return;
  for (const ws of clients) {
    if (ws.readyState === WS!.OPEN) {
      ws.send(JSON.stringify({ type: 'status', status }));
    }
  }
}

export function broadcastSysStats(stats: { cpuPercent: number; memoryMb: number; memoryPercent: number }): void {
  for (const clients of subscriptions.values()) {
    for (const ws of clients) {
      if (ws.readyState === WS!.OPEN) {
        ws.send(JSON.stringify({ type: 'sys_stats', data: stats }));
      }
    }
  }
}

export async function setupWebSocket(server: import('http').Server): Promise<void> {
  await initWs();

  // Create WebSocketServer without attaching to HTTP server directly
  runWss = new WebSocketServer({ noServer: true });
  pwWss = new WebSocketServer({ noServer: true });

  // --- Run metrics WS ---
  runWss.on('connection', (ws: WSConn, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'http://localhost');
    const runId = url.searchParams.get('runId');

    if (!runId) {
      ws.close(4001, 'runId query param required');
      return;
    }

    if (!subscriptions.has(runId)) {
      subscriptions.set(runId, new Set());
    }
    subscriptions.get(runId)!.add(ws);
    logger.debug({ runId }, 'WebSocket client connected');

    ws.on('close', () => {
      subscriptions.get(runId)?.delete(ws);
      if (subscriptions.get(runId)?.size === 0) {
        subscriptions.delete(runId);
      }
    });

    ws.on('error', (err) => {
      logger.error({ err, runId }, 'WebSocket error');
      subscriptions.get(runId)?.delete(ws);
      if (subscriptions.get(runId)?.size === 0) {
        subscriptions.delete(runId);
      }
    });
  });

  // --- Playwright WS ---
  pwWss.on('connection', (ws: WSConn, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'http://localhost');
    const projectId = url.searchParams.get('projectId') || 'default';

    logger.info({ projectId }, 'Playwright WebSocket connected');

    const recorder = recorderManager.getRecorderForProject(projectId);

    if (recorder && recorder instanceof PlaywrightRecorder) {
      recorder.onPageEvent = (event) => {
        if (ws.readyState === WS!.OPEN) {
          ws.send(JSON.stringify(event));
        }
      };

      ws.send(JSON.stringify({
        type: 'state',
        data: {
          mode: 'playwright',
          recording: recorder.isRecording(),
          browserType: recorder.getSession()?.browserType || null,
          wsEndpoint: recorder.getWsEndpoint(),
          capturedCount: recorder.getCaptured().length,
          actionCount: recorder.getActions().length,
        },
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'state',
        data: {
          mode: null,
          recording: false,
          message: 'No active Interactive Browser recording. Start one first.',
        },
      }));
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const recorder = recorderManager.getRecorderForProject(projectId);

        if (!recorder || !(recorder instanceof PlaywrightRecorder)) {
          ws.send(JSON.stringify({ type: 'error', data: { message: 'Interactive Browser not active' } }));
          return;
        }

        if (msg.type === 'command') {
          const result = await recorder.executeCommand(msg.data);
          ws.send(JSON.stringify({ type: 'result', data: { command: msg.data.type, result } }));
        }
      } catch (err: any) {
        logger.error({ err }, 'Playwright WS message error');
        ws.send(JSON.stringify({ type: 'error', data: { message: err.message } }));
      }
    });

    ws.on('close', () => {
      logger.info({ projectId }, 'Playwright WebSocket disconnected');
      const recorder = recorderManager.getRecorderForProject(projectId);
      if (recorder && recorder instanceof PlaywrightRecorder) {
        recorder.onPageEvent = null;
      }
    });

    ws.on('error', (err) => {
      logger.error({ err, projectId }, 'Playwright WS error');
    });
  });

  // Manual upgrade routing
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;

    if (pathname === '/api/v1/ws') {
      runWss.handleUpgrade(request, socket, head, (ws: WSConn) => {
        runWss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/v1/ws/playwright') {
      pwWss.handleUpgrade(request, socket, head, (ws: WSConn) => {
        pwWss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });
}

export function shutdownWebSocket(): void {
  for (const clients of subscriptions.values()) {
    for (const ws of clients) {
      try { ws.close(); } catch { /* ignore */ }
    }
    clients.clear();
  }
  subscriptions.clear();
  try { runWss?.close(); } catch { /* ignore */ }
  try { pwWss?.close(); } catch { /* ignore */ }
}
