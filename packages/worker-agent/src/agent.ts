import express from 'express';
import { createServer } from 'http';
import os from 'os';
import { K6Runner } from './k6Runner.js';

interface AgentConfig {
  name: string;
  centralApiUrl: string;
  heartbeatIntervalMs: number;
  port: number;
}

interface RunPayload {
  runId: string;
  scriptContent: string;
  options: Record<string, unknown>;
  csvFiles?: { name: string; filename: string; content: string }[];
  authToken?: string;
}

export function createAgent(config: AgentConfig) {
  const app = express();
  const server = createServer(app);
  const runner = new K6Runner();
  let authToken = '';

  runner.on('metric', async (runId, point) => {
    if (point.type === 'Point') {
      await pushMetric(config.centralApiUrl, runId, point, authToken);
    }
  });

  runner.on('done', async (runId, result) => {
    console.log(`[${config.name}] Run ${runId} finished (exit=${result.exitCode})`);
    await pushDone(config.centralApiUrl, runId, result, authToken);
  });

  runner.on('error', async (runId, err) => {
    console.error(`[${config.name}] Run ${runId} error:`, err.message);
    await updateStatus(config.centralApiUrl, runId, 'failed', authToken);
  });

  app.use(express.json());

  // POST /run — execute a distributed run slice
  app.post('/run', async (req, res) => {
    const payload = req.body as RunPayload;
    if (!payload.runId || !payload.scriptContent) {
      res.status(400).json({ error: 'runId and scriptContent are required' });
      return;
    }

    if (payload.authToken) {
      authToken = payload.authToken;
    }

    console.log(`[${config.name}] Starting run ${payload.runId}...`);

    // Mark assignment as running on the central API
    await updateStatus(config.centralApiUrl, payload.runId, 'running', authToken);

    res.json({ accepted: true, runId: payload.runId });

    try {
      await runner.start({
        runId: payload.runId,
        scriptContent: payload.scriptContent,
        options: payload.options,
        csvFiles: payload.csvFiles,
      });
    } catch (err: any) {
      console.error(`[${config.name}] Failed to start k6 for ${payload.runId}:`, err.message);
      await updateStatus(config.centralApiUrl, payload.runId, 'failed', authToken);
    }
  });

  // POST /abort — abort a running test
  app.post('/abort', (req, res) => {
    const { runId } = req.body;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    runner.abort(runId);
    res.json({ aborted: runId });
  });

  // POST /shutdown — gracefully shut down worker agent
  app.post('/shutdown', (_req, res) => {
    res.json({ message: 'Shutting down' });
    setTimeout(() => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      server.close();
      process.exit(0);
    }, 100);
  });

  // GET /health — liveness check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      name: config.name,
      uptime: process.uptime(),
      activeRuns: runner.activeCount(),
    });
  });

  // Send heartbeat to central API every N ms
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  async function heartbeat() {
    try {
      const mem = process.memoryUsage();
      const cpu = process.cpuUsage();
      const cpus = os.cpus();
      const cpuPercent = Math.min(100, Math.round((cpu.user + cpu.system) / 1000 / cpus.length) / 10);
      const res = await fetch(`${config.centralApiUrl}/api/v1/workers/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          status: 'online',
          activeRuns: runner.activeCount(),
          cpuPercent,
          memoryMb: Math.round(mem.heapUsed / 1024 / 1024),
          memoryPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
        }),
      });
      if (!res.ok) {
        console.warn(`[${config.name}] Heartbeat failed: ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[${config.name}] Heartbeat error:`, err.message);
    }
  }

  return {
    async start() {
      return new Promise<void>((resolve) => {
        server.listen(config.port, '::', () => {
          heartbeatTimer = setInterval(heartbeat, config.heartbeatIntervalMs);
          resolve();
        });
      });
    },

    async stop() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function pushMetric(
  centralUrl: string,
  runId: string,
  point: any,
  token: string,
) {
  try {
    await fetch(`${centralUrl}/api/v1/runs/${runId}/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(point),
    });
  } catch {
    // silently drop — metrics are best-effort
  }
}

async function pushDone(
  centralUrl: string,
  runId: string,
  result: { exitCode: number | null; requestLogs?: any[] },
  token: string,
) {
  try {
    await fetch(`${centralUrl}/api/v1/runs/${runId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(result),
    });
  } catch (err: any) {
    console.error(`[agent] Failed to report completion for ${runId}:`, err.message);
  }
}

async function updateStatus(
  centralUrl: string,
  runId: string,
  status: string,
  token: string,
) {
  try {
    await fetch(`${centralUrl}/api/v1/runs/${runId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
  } catch {
    // best-effort
  }
}
