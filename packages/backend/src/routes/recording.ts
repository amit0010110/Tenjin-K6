import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { recorderManager } from '../lib/recorder/session.js';
import { HttpProxyRecorder } from '../lib/recorder/http-proxy.js';
import { PlaywrightRecorder } from '../lib/recorder/playwright.js';
import { playwrightLauncher, getInstalledBrowsers } from '../services/playwright-launcher.js';
import type { RecorderMode } from '../lib/recorder/types.js';

export const recordingRoutes = Router();

const startSchema = z.object({
  targetUrl: z.string().url(),
  mode: z.enum(['http-proxy', 'playwright']).optional().default('http-proxy'),
  browserType: z.enum(['chromium', 'firefox', 'webkit']).optional().default('chromium'),
  headless: z.boolean().optional().default(false),
  filter: z.object({
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    methods: z.array(z.string()).optional(),
  }).optional(),
});

function getProjectId(req: Request): string {
  return (req.query.projectId as string) || 'default';
}

// GET /recording/browsers — list installed Playwright browsers
recordingRoutes.get('/recording/browsers', async (_req: Request, res: Response) => {
  try {
    const browsers = await getInstalledBrowsers();
    res.json({ browsers, count: browsers.length });
  } catch {
    res.json({ browsers: [], count: 0 });
  }
});

// POST /recording/start — start a recording session (http-proxy or playwright)
recordingRoutes.post('/recording/start', async (req: Request, res: Response) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
    return;
  }

  const { mode, targetUrl, browserType, headless, filter } = parsed.data;
  const projectId = getProjectId(req);

  try {
    if (mode === 'playwright') {
      const recorder = recorderManager.getOrCreateRecorder('playwright') as PlaywrightRecorder;
      recorder.setLauncher(playwrightLauncher);
    }

    const session = await recorderManager.startSession(projectId, {
      mode,
      targetUrl,
      browserType,
      headless,
      filter,
    });

    res.status(201).json({
      mode: session.mode,
      targetUrl: session.targetUrl,
      status: session.status,
      sessionId: session.id,
      browserWsEndpoint: session.browserWsEndpoint || null,
      browserType: session.browserType || null,
      message: mode === 'http-proxy'
        ? 'Proxy recording started. Configure your app to use this server as HTTP proxy at /api/v1/recording/proxy'
        : `Interactive Browser (${browserType}) session started`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to start recording');
    res.status(500).json({ message: err.message || 'Failed to start recording' });
  }
});

// POST /recording/stop
recordingRoutes.post('/recording/stop', async (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  const session = recorderManager.getSession(projectId);

  if (!session || session.status !== 'recording') {
    res.status(400).json({ message: 'No active recording session' });
    return;
  }

  const stopped = await recorderManager.stopSession(projectId);
  res.json({
    message: 'Recording stopped',
    mode: stopped?.mode,
    captured: stopped?.requests?.length || 0,
    actions: stopped?.actions?.length || 0,
  });
});

// GET /recording/captured
recordingRoutes.get('/recording/captured', (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  const session = recorderManager.getSession(projectId);
  const recorder = recorderManager.getRecorderForProject(projectId);

  res.json({
    captured: recorder?.getCaptured() || [],
    actions: recorder instanceof PlaywrightRecorder ? recorder.getActions() : [],
    count: recorder?.getCaptured().length || 0,
    recording: session?.status === 'recording',
    mode: session?.mode || null,
    targetUrl: session?.targetUrl || null,
    browserType: session?.browserType || null,
  });
});

// POST /recording/clear
recordingRoutes.post('/recording/clear', (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  recorderManager.clearCaptured(projectId);
  res.json({ message: 'Captured requests cleared' });
});

// POST /recording/generate — generate script blocks from captured traffic
recordingRoutes.post('/recording/generate', (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  const recorder = recorderManager.getRecorderForProject(projectId);
  const session = recorderManager.getSession(projectId);

  if (!recorder) {
    res.status(400).json({ message: 'No recording data. Start a recording first.' });
    return;
  }

  const blocks = recorder.generateBlocks();
  res.json({
    blocks,
    count: blocks.length,
    targetUrl: session?.targetUrl || null,
    source: session?.mode || null,
  });
});

// ALL /recording/proxy/* — HTTP proxy handler
recordingRoutes.all('/recording/proxy/*', (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  const recorder = recorderManager.getRecorderForProject(projectId);

  if (!recorder || !(recorder instanceof HttpProxyRecorder)) {
    res.status(400).json({
      message: 'HTTP proxy recording not started. POST /recording/start with mode=http-proxy, or pass ?projectId=...',
    });
    return;
  }

  recorder.handleProxyRequest(req, res);
});

// POST /recording/command — execute a Playwright browser command
recordingRoutes.post('/recording/command', async (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  const recorder = recorderManager.getRecorderForProject(projectId);

  if (!recorder || !(recorder instanceof PlaywrightRecorder)) {
    res.status(400).json({ message: 'Interactive Browser recording not active' });
    return;
  }

  try {
    const result = await recorder.executeCommand(req.body);
    res.json({ success: true, result });
  } catch (err: any) {
    logger.error({ err }, 'Playwright command failed');
    res.status(500).json({ message: err.message || 'Command failed' });
  }
});

// Backward-compatible alias (default to http-proxy mode)
recordingRoutes.post('/recording/start-proxy', async (req: Request, res: Response) => {
  req.body.mode = 'http-proxy';
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
    return;
  }
  const { targetUrl } = parsed.data;
  const projectId = getProjectId(req);
  try {
    const recorder = recorderManager.getOrCreateRecorder('http-proxy') as HttpProxyRecorder;
    const session = await recorderManager.startSession(projectId, { mode: 'http-proxy', targetUrl });
    res.status(201).json({
      mode: session.mode,
      targetUrl: session.targetUrl,
      message: 'Proxy recording started. Configure your app to use this server as HTTP proxy at /api/v1/recording/proxy',
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
