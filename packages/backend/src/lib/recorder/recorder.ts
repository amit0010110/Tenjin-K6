import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../logger.js';
import type { RecorderSession, CapturedRequest, RecorderOptions, RecorderFilter, Block, RecorderMode } from './types.js';

/** Convert a glob-style pattern to a RegExp */
function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      regexStr += '.*';
    } else if (ch === '?') {
      regexStr += '.';
    } else if (ch === '.' || ch === '+' || ch === '^' || ch === '$' || ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === '|' || ch === '[' || ch === ']' || ch === '\\') {
      regexStr += '\\' + ch;
    } else {
      regexStr += ch;
    }
  }
  return new RegExp('^' + regexStr + '$', 'i');
}

/** Strip query string from URL for pattern matching */
function stripQuery(url: string): string {
  const qIdx = url.indexOf('?');
  return qIdx >= 0 ? url.substring(0, qIdx) : url;
}

/** Check if a URL and method should be captured based on the filter */
function matchesFilter(url: string, method: string, filter?: RecorderFilter): boolean {
  if (!filter) return true;

  // Strip query string so patterns like *.css match style.css?v=2
  const cleanUrl = stripQuery(url);

  // Filter by method
  if (filter.methods && filter.methods.length > 0) {
    if (!filter.methods.includes(method.toUpperCase())) return false;
  }

  // Filter by exclude patterns (exclude takes precedence)
  if (filter.excludePatterns && filter.excludePatterns.length > 0) {
    for (const pattern of filter.excludePatterns) {
      if (globToRegex(pattern).test(cleanUrl)) return false;
    }
  }

  // Filter by include patterns
  if (filter.includePatterns && filter.includePatterns.length > 0) {
    for (const pattern of filter.includePatterns) {
      if (globToRegex(pattern).test(cleanUrl)) return true;
    }
    return false; // URL didn't match any include pattern
  }

  return true;
}

export abstract class BaseRecorder extends EventEmitter {
  abstract readonly mode: RecorderMode;

  protected session: RecorderSession | null = null;
  protected filter: RecorderFilter | null = null;

  getSession(): RecorderSession | null {
    return this.session;
  }

  isRecording(): boolean {
    return this.session?.status === 'recording';
  }

  abstract start(options: RecorderOptions): Promise<RecorderSession>;
  abstract stop(): Promise<RecorderSession>;
  abstract getCaptured(): CapturedRequest[];
  abstract clear(): void;
  abstract generateBlocks(): Block[];

  protected createSession(options: RecorderOptions): RecorderSession {
    this.filter = options.filter || null;
    if (this.filter) {
      logger.info({ excludePatterns: this.filter.excludePatterns }, 'Filter applied to recorder');
    } else {
      logger.warn('No filter applied — capturing all requests');
    }
    this.session = {
      id: crypto.randomUUID(),
      mode: this.mode,
      targetUrl: options.targetUrl,
      status: 'recording',
      requests: [],
      actions: [],
      startedAt: new Date().toISOString(),
      browserType: options.browserType,
    };
    return this.session;
  }

  protected finalizeSession(): RecorderSession {
    if (this.session) {
      this.session.status = 'stopped';
      this.session.stoppedAt = new Date().toISOString();
    }
    return this.session!;
  }

  /** Check if a request matches the active filter */
  protected shouldCapture(url: string, method: string): boolean {
    return matchesFilter(url, method, this.filter || undefined);
  }
}

export { globToRegex, matchesFilter };
