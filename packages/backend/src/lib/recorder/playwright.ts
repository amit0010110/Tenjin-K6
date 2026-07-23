import { v4 as uuid } from 'uuid';
import { logger } from '../logger.js';
import { BaseRecorder } from './recorder.js';
import type { CapturedRequest, CapturedAction, RecorderSession, RecorderOptions, Block, RecorderMode } from './types.js';

export type PageEventType = 'request' | 'response' | 'action' | 'screencast' | 'state';

export interface PageEvent {
  type: PageEventType;
  data: unknown;
}

export type BrowserLauncher = (options: {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
}) => Promise<{
  browser: any;
  page: any;
  wsEndpoint: string;
  server: any;
}>;

export class PlaywrightRecorder extends BaseRecorder {
  readonly mode: RecorderMode = 'playwright';

  private browser: any = null;
  private page: any = null;
  private server: any = null;
  private wsEndpoint: string | null = null;
  private capturedRequests: CapturedRequest[] = [];
  private capturedActions: CapturedAction[] = [];
  private requestStartMap = new Map<string, number>();
  private requestBodyMap = new Map<string, string>();
  private requestMultipartMap = new Map<string, string>();

  /** Screencast interval handle */
  private screencastTimer: ReturnType<typeof setInterval> | null = null;

  /** Viewport dimensions for coordinate mapping */
  private viewport: { width: number; height: number } = { width: 1280, height: 720 };

  /** External launcher function — injected to avoid hard dependency on playwright */
  private launcher: BrowserLauncher | null = null;

  /** Callbacks registered by the WebSocket controller */
  onPageEvent: ((event: PageEvent) => void) | null = null;

  setLauncher(launcher: BrowserLauncher): void {
    this.launcher = launcher;
  }

  async start(options: RecorderOptions): Promise<RecorderSession> {
    if (!this.launcher) {
      throw new Error('Playwright launcher not set. Install playwright or inject a launcher.');
    }

    const browserType = options.browserType || 'chromium';
    const headless = options.headless ?? false;

    this.capturedRequests = [];
    this.capturedActions = [];
    this.requestStartMap = new Map();
    this.requestBodyMap = new Map();
    this.requestMultipartMap = new Map();

    const { browser, page, wsEndpoint, server } = await this.launcher({
      browserType,
      headless,
    });

    this.browser = browser;
    this.page = page;
    this.server = server;
    this.wsEndpoint = wsEndpoint;

    // Capture viewport for coordinate mapping
    try {
      const vp = page.viewportSize();
      if (vp) {
        this.viewport = vp;
      }
    } catch { /* ignore */ }

    // Set filter and session BEFORE navigation so initial page resources are filtered
    const session = this.createSession(options);

    this.setupPageListeners(page);
    this.startScreencast();

    // Navigate to the target URL
    if (options.targetUrl) {
      try {
        await page.goto(options.targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        const action: CapturedAction = {
          id: uuid(),
          type: 'navigate',
          url: options.targetUrl,
          timestamp: new Date().toISOString(),
        };
        this.capturedActions.push(action);
        this.onPageEvent?.({ type: 'action', data: action });
      } catch (err) {
        logger.warn({ err, url: options.targetUrl }, 'Initial navigation failed, continuing anyway');
      }
    }

    session.browserWsEndpoint = wsEndpoint;
    session.browserType = browserType;

    logger.info({ browserType, headless, wsEndpoint }, 'Playwright recording started');
    return session;
  }

  /** Start periodic screencast — emits base64 screenshots via onPageEvent */
  private startScreencast(): void {
    this.stopScreencast();
    const interval = 2000; // ms between frames
    this.screencastTimer = setInterval(async () => {
      if (!this.page || this.page.isClosed()) {
        this.stopScreencast();
        return;
      }
      try {
        const buffer = await this.page.screenshot({ type: 'jpeg', quality: 60 });
        this.onPageEvent?.({
          type: 'screencast',
          data: {
            data: buffer.toString('base64'),
            mimeType: 'image/jpeg',
            viewport: this.viewport,
            timestamp: Date.now(),
          },
        });
      } catch {
        this.stopScreencast();
      }
    }, interval);
  }

  private stopScreencast(): void {
    if (this.screencastTimer) {
      clearInterval(this.screencastTimer);
      this.screencastTimer = null;
    }
  }

  private setupPageListeners(page: any): void {
    // Network request capture
    page.on('request', (request: any) => {
      const reqId = request.url();
      this.requestStartMap.set(reqId, Date.now());

      const headers = request.headers();
      const contentType = (headers['content-type'] || '').toLowerCase();
      const isMultipart = contentType.includes('multipart/form-data');

      let postData = '';
      let multipartBody: string | undefined;
      if (isMultipart) {
        try {
          const buf: Buffer = request.postDataBuffer();
          if (buf) {
            multipartBody = buf.toString('base64');
            postData = buf.toString('latin1');
          }
        } catch { /* ignore */ }
      } else {
        try { postData = request.postData() || ''; } catch { /* ignore */ }
      }
      this.requestBodyMap.set(reqId, postData);
      if (multipartBody) this.requestMultipartMap.set(reqId, multipartBody);

      const event = {
        type: 'request' as const,
        data: {
          id: uuid(),
          method: request.method(),
          url: request.url(),
          headers,
          body: postData,
          source: 'playwright' as const,
        },
      };
      this.onPageEvent?.(event);
    });

    // Network response capture
    page.on('response', async (response: any) => {
      const reqId = response.url();
      const startTime = this.requestStartMap.get(reqId) || Date.now();
      const body = this.requestBodyMap.get(reqId) || '';

      let responseBody = '';
      try { responseBody = await response.text(); } catch { /* ignore */ }

      // Limit response body size to avoid memory issues
      if (responseBody.length > 1_000_000) {
        responseBody = responseBody.substring(0, 1_000_000) + '... [truncated]';
      }

      const method = response.request().method();
      const url = response.url();

      // Apply filter
      if (this.shouldCapture(url, method)) {
        const multipartBody = this.requestMultipartMap.get(reqId);
        const capture: CapturedRequest = {
          id: uuid(),
          method,
          url,
          headers: response.request().headers(),
          body,
          statusCode: response.status(),
          responseHeaders: response.headers(),
          responseBody,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          source: 'playwright',
          multipartBody,
        };

        this.capturedRequests.push(capture);
        if (this.capturedRequests.length > 1000) this.capturedRequests.shift();
        this.onPageEvent?.({
          type: 'response',
          data: capture,
        });
      }

      this.requestStartMap.delete(reqId);
      this.requestBodyMap.delete(reqId);
      this.requestMultipartMap.delete(reqId);
    });

    // Action capture
    page.on('framenavigated', (frame: any) => {
      if (frame === page.mainFrame()) {
        const action: CapturedAction = {
          id: uuid(),
          type: 'navigate',
          url: frame.url(),
          timestamp: new Date().toISOString(),
        };
        this.capturedActions.push(action);
        this.onPageEvent?.({
          type: 'action',
          data: action,
        });
      }
    });

    page.on('console', (msg: any) => {
      logger.debug({ text: msg.text(), type: msg.type() }, 'Playwright console');
    });

    page.on('pageerror', (err: Error) => {
      logger.error({ err }, 'Playwright page error');
    });

    page.on('close', () => {
      logger.info('Playwright page closed');
      if (this.session) {
        this.session.status = 'stopped';
      }
    });
  }

  /** Click at specific viewport coordinates (used by screencast click forwarding) */
  async clickAt(x: number, y: number): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.mouse.click(x, y);
    const action: CapturedAction = {
      id: uuid(),
      type: 'click',
      selector: `[viewport ${Math.round(x)},${Math.round(y)}]`,
      value: `${Math.round(x)},${Math.round(y)}`,
      timestamp: new Date().toISOString(),
    };
    this.capturedActions.push(action);
    this.onPageEvent?.({ type: 'action', data: action });
  }

  /** Double-click at specific viewport coordinates */
  async doubleClickAt(x: number, y: number): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.mouse.dblclick(x, y);
  }

  /** Scroll by delta pixels */
  async wheel(deltaX: number, deltaY: number): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.mouse.wheel(deltaX, deltaY);
  }

  /** Type text at current focus */
  async typeText(text: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.keyboard.type(text);
  }

  /** Press a key */
  async pressKey(key: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.keyboard.press(key);
  }

  /** Get the current viewport */
  getViewport(): { width: number; height: number } {
    return { ...this.viewport };
  }

  /** Execute a browser command sent from the frontend via WebSocket */
  async executeCommand(command: {
    type: 'navigate' | 'click' | 'clickAt' | 'doubleClickAt' | 'typeText' | 'pressKey' | 'fill' | 'select' | 'hover' | 'wait' | 'screenshot' | 'evaluate' | 'close' | 'wheel';
    url?: string;
    selector?: string;
    value?: string;
    script?: string;
    timeout?: number;
    x?: number;
    y?: number;
    key?: string;
    deltaX?: number;
    deltaY?: number;
  }): Promise<unknown> {
    if (!this.page) throw new Error('Browser not launched');

    const action: CapturedAction = {
      id: uuid(),
      type: command.type,
      selector: command.selector,
      value: command.value,
      url: command.url,
      timestamp: new Date().toISOString(),
    };

    let result: unknown;

    switch (command.type) {
      case 'navigate': {
        if (!command.url) throw new Error('URL required for navigate');
        await this.page.goto(command.url, { waitUntil: 'networkidle', timeout: command.timeout || 30000 });
        action.url = command.url;
        result = { url: this.page.url() };
        break;
      }
      case 'click': {
        if (!command.selector) throw new Error('Selector required for click');
        await this.page.click(command.selector, { timeout: command.timeout || 5000 });
        result = { clicked: command.selector };
        break;
      }
      case 'fill': {
        if (!command.selector || command.value === undefined) throw new Error('Selector and value required for fill');
        await this.page.fill(command.selector, command.value, { timeout: command.timeout || 5000 });
        result = { filled: command.selector, value: command.value };
        break;
      }
      case 'select': {
        if (!command.selector || command.value === undefined) throw new Error('Selector and value required for select');
        await this.page.selectOption(command.selector, command.value);
        result = { selected: command.selector, value: command.value };
        break;
      }
      case 'hover': {
        if (!command.selector) throw new Error('Selector required for hover');
        await this.page.hover(command.selector, { timeout: command.timeout || 5000 });
        result = { hovered: command.selector };
        break;
      }
      case 'wait': {
        const ms = command.timeout || 2000;
        await this.page.waitForTimeout(ms);
        result = { waited: ms };
        break;
      }
      case 'clickAt': {
        if (command.x === undefined || command.y === undefined) throw new Error('x and y required for clickAt');
        await this.clickAt(command.x, command.y);
        result = { clickedAt: { x: command.x, y: command.y } };
        break;
      }
      case 'doubleClickAt': {
        if (command.x === undefined || command.y === undefined) throw new Error('x and y required for doubleClickAt');
        await this.doubleClickAt(command.x, command.y);
        result = { doubleClickedAt: { x: command.x, y: command.y } };
        break;
      }
      case 'typeText': {
        if (command.value === undefined) throw new Error('value required for typeText');
        await this.typeText(command.value);
        result = { typed: command.value };
        break;
      }
      case 'pressKey': {
        if (!command.key) throw new Error('key required for pressKey');
        await this.pressKey(command.key);
        result = { pressed: command.key };
        break;
      }
      case 'screenshot': {
        const buffer = await this.page.screenshot({ type: 'png' });
        result = { data: buffer.toString('base64'), mimeType: 'image/png' };
        break;
      }
      case 'evaluate': {
        if (!command.script) throw new Error('Script required for evaluate');
        result = await this.page.evaluate(command.script);
        break;
      }
      case 'wheel': {
        await this.wheel(command.deltaX || 0, command.deltaY || 0);
        result = { scrolled: { deltaX: command.deltaX, deltaY: command.deltaY } };
        break;
      }
      case 'close': {
        await this.stop();
        result = { closed: true };
        break;
      }
      default: {
        throw new Error(`Unknown command: ${(command as any).type}`);
      }
    }

    this.capturedActions.push(action);
    this.onPageEvent?.({ type: 'action', data: action });
    return result;
  }

  async stop(): Promise<RecorderSession> {
    this.stopScreencast();
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }
      if (this.server) {
        await this.server.close().catch(() => {});
      }
    } catch (err) {
      logger.error({ err }, 'Error closing Playwright browser');
    }

    this.browser = null;
    this.page = null;
    this.server = null;
    this.wsEndpoint = null;

    const session = this.finalizeSession();
    session.actions = [...this.capturedActions];
    logger.info({ count: this.capturedRequests.length }, 'Playwright recording stopped');
    return session;
  }

  getCaptured(): CapturedRequest[] {
    return [...this.capturedRequests];
  }

  getActions(): CapturedAction[] {
    return [...this.capturedActions];
  }

  clear(): void {
    this.capturedRequests = [];
    this.capturedActions = [];
    this.requestStartMap.clear();
    this.requestBodyMap.clear();
    if (this.session) {
      this.session.requests = [];
      this.session.actions = [];
    }
  }

  getPage(): any {
    return this.page;
  }

  getBrowser(): any {
    return this.browser;
  }

  getWsEndpoint(): string | null {
    return this.wsEndpoint;
  }

  generateBlocks(): Block[] {
    // Generate blocks from both actions (browser steps) and network requests
    const blocks: Block[] = [];

    // First pass: browser actions become script blocks
    for (const action of this.capturedActions) {
      if (action.type === 'navigate') {
        blocks.push({
          type: 'browser-navigate',
          label: `Navigate to ${action.url || ''}`,
          properties: { url: action.url || '' },
        });
      }
    }

    // Second pass: network requests become HTTP blocks
    for (const req of this.capturedRequests) {
      const checks = [
        { label: `status is ${req.statusCode}`, expression: `response.status === ${req.statusCode}` },
      ];
      const props: Record<string, any> = {
        method: req.method,
        url: req.url,
        headers: Object.entries(req.headers).map(([k, v]) => ({ key: k, value: v })),
        body: req.body || '',
        checks,
      };
      if (req.multipartBody) {
        props.multipartBody = req.multipartBody;
        props.isMultipart = true;
      }
      blocks.push({
        type: 'http-request',
        label: `${req.method} ${req.url}`,
        properties: props,
      });
    }

    return blocks;
  }
}
