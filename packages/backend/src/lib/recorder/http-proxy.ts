import httpProxy from 'http-proxy';
import { logger } from '../logger.js';
import { BaseRecorder } from './recorder.js';
import type { CapturedRequest, RecorderSession, RecorderOptions, Block, RecorderMode } from './types.js';

const RECORDING_LIMIT = 1000;

export class HttpProxyRecorder extends BaseRecorder {
  readonly mode: RecorderMode = 'http-proxy';

  private proxy: httpProxy;
  private activeTarget: string | null = null;
  private capturedRequests: CapturedRequest[] = [];

  constructor() {
    super();
    this.proxy = httpProxy.createProxyServer({ changeOrigin: true });
    this.setupProxyEvents();
  }

  private setupProxyEvents(): void {
    this.proxy.on('proxyReq', (proxyReq, req, _res) => {
      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(bodyChunks);
        const reqHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(proxyReq.getHeaders())) {
          if (v) reqHeaders[k] = String(v);
        }
        const contentType = (reqHeaders['content-type'] || '').toLowerCase();
        const isMultipart = contentType.includes('multipart/form-data');
        (req as any).__captureBody = isMultipart ? rawBody.toString('latin1') : rawBody.toString();
        (req as any).__captureMultipartBody = isMultipart ? rawBody.toString('base64') : undefined;
        (req as any).__captureHeaders = reqHeaders;
        (req as any).__captureStart = Date.now();
      });
    });

    (this.proxy as any).on('proxyRes', (proxyRes: any, req: any, _res: any) => {
      if (!req.__captureStart) return;
      const bodyChunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(bodyChunks).toString();
        const resHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v) resHeaders[k] = String(v);
        }
        const method = req.method || 'GET';
        const url = req.__targetPath || req.url || '';

        if (this.shouldCapture(url, method)) {
          const capture: CapturedRequest = {
            id: crypto.randomUUID(),
            method,
            url,
            headers: req.__captureHeaders || {},
            body: req.__captureBody || '',
            statusCode: proxyRes.statusCode,
            responseHeaders: resHeaders,
            responseBody,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - (req.__captureStart || Date.now()),
            source: 'http-proxy',
            multipartBody: req.__captureMultipartBody,
          };
          this.capturedRequests.push(capture);
          this.emit('request', capture);
        }
        if (this.capturedRequests.length > RECORDING_LIMIT) {
          this.capturedRequests.shift();
        }
      });
    });

    (this.proxy as any).on('error', (err: Error, _req: any, res: any) => {
      logger.error({ err }, 'Proxy error');
      if (res && !res.headersSent) {
        res.statusCode = 502;
        res.end(JSON.stringify({ message: 'Proxy error', error: err.message }));
      }
    });
  }

  async start(options: RecorderOptions): Promise<RecorderSession> {
    this.activeTarget = options.targetUrl;
    this.capturedRequests = [];
    const session = this.createSession(options);
    logger.info({ targetUrl: this.activeTarget }, 'HTTP proxy recording started');
    return session;
  }

  async stop(): Promise<RecorderSession> {
    this.activeTarget = null;
    const session = this.finalizeSession();
    logger.info({ count: this.capturedRequests.length }, 'HTTP proxy recording stopped');
    return session;
  }

  getCaptured(): CapturedRequest[] {
    return [...this.capturedRequests];
  }

  clear(): void {
    this.capturedRequests = [];
    if (this.session) {
      this.session.requests = [];
    }
  }

  getActiveTarget(): string | null {
    return this.activeTarget;
  }

  /** Handle an incoming proxy request. Returns true if recording is active. */
  handleProxyRequest(req: any, res: any): boolean {
    if (!this.activeTarget) return false;
    const targetPath = req.path.replace(/^\/api\/v1\/recording\/proxy/, '');
    req.__targetPath = targetPath;
    this.proxy.web(req, res, { target: this.activeTarget, toProxy: true });
    return true;
  }

  generateBlocks(): Block[] {
    return this.capturedRequests.map((c) => {
      const checks = [
        { label: `status is ${c.statusCode}`, expression: `response.status === ${c.statusCode}` },
      ];
      const children: Block[] = [];

      const setCookie = c.responseHeaders['set-cookie'] || c.responseHeaders['Set-Cookie'];
      if (setCookie) {
        const cookieMatch = setCookie.match(/^([^=]+)=([^;]+)/);
        if (cookieMatch) {
          children.push({
            type: 'extract-variable',
            label: `Extract cookie ${cookieMatch[1]}`,
            properties: { extractType: 'cookie', expression: cookieMatch[1], variableName: `cookie_${cookieMatch[1]}` },
          });
        }
      }

      if (c.responseBody) {
        const tokenMatch = c.responseBody.match(/["'](csrf_token|_csrf|csrf)["']\s*[:=]\s*["']([^"']+)["']/);
        if (tokenMatch) {
          children.push({
            type: 'extract-variable',
            label: `Extract ${tokenMatch[1]}`,
            properties: { extractType: 'jsonpath', expression: `$.${tokenMatch[1]}`, variableName: tokenMatch[1] },
          });
        }
      }

      const props: Record<string, any> = {
        method: c.method,
        url: c.url,
        headers: Object.entries(c.headers).map(([k, v]) => ({ key: k, value: v })),
        body: c.body || '',
        checks,
      };
      if (c.multipartBody) {
        props.multipartBody = c.multipartBody;
        props.isMultipart = true;
      }
      return {
        type: 'http-request',
        label: `${c.method} ${c.url}`,
        properties: props,
        children: children.length > 0 ? children : undefined,
      };
    });
  }
}
