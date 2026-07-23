export type RecorderMode = 'http-proxy' | 'playwright';

export interface CapturedRequest {
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
  /** Which mode captured this request */
  source: RecorderMode;
  /** Base64-encoded original body when Content-Type is multipart/form-data */
  multipartBody?: string;
}

export type ActionType = 'navigate' | 'click' | 'clickAt' | 'doubleClickAt' | 'typeText' | 'pressKey' | 'fill' | 'select' | 'hover' | 'wait' | 'screenshot' | 'evaluate' | 'close' | 'wheel';

export interface CapturedAction {
  id: string;
  type: ActionType;
  selector?: string;
  value?: string;
  url?: string;
  timestamp: string;
}

export interface RecorderSession {
  id: string;
  mode: RecorderMode;
  targetUrl: string;
  status: 'idle' | 'recording' | 'stopped';
  requests: CapturedRequest[];
  actions: CapturedAction[];
  startedAt: string;
  stoppedAt?: string;
  /** Playwright-specific: browser PID or WS endpoint */
  browserWsEndpoint?: string;
  browserType?: 'chromium' | 'firefox' | 'webkit';
}

export interface RecorderFilter {
  /** Glob-style URL patterns to include (e.g. "*.example.com/*", "/api/v1/**") */
  includePatterns?: string[];
  /** Glob-style URL patterns to exclude */
  excludePatterns?: string[];
  /** HTTP methods to capture (empty = all methods) */
  methods?: string[];
}

export interface RecorderOptions {
  targetUrl: string;
  mode: RecorderMode;
  /** Playwright-specific */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  /** Optional filter to control which requests are captured */
  filter?: RecorderFilter;
}

export interface Block {
  type: string;
  label: string;
  properties: Record<string, unknown>;
  children?: Block[];
}

export interface GenerateBlocksResult {
  blocks: Block[];
  count: number;
  targetUrl: string | null;
}
