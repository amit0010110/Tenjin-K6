import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import { recorderManager } from '../lib/recorder/session.js';

export const correlationRoutes = Router();

interface CorrelationSuggestion {
  name: string;
  requestIndex: number;
  location: 'header' | 'body' | 'cookie' | 'json';
  extractPath: string;
  variableName: string;
  sampleValue: string;
  usedInRequests: number[];
  begin?: string;
  end?: string;
  score: number;
}

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

interface ExtractedValue {
  location: 'header' | 'json';
  extractPath: string;
  value: string;
  requestIndex: number;
}

const HIGH_PRIORITY_FIELDS = [
  'authorization', 'bearer', 'access.tok', 'refresh.tok', 'id.tok', 'token',
  'csrf', 'xsrf', 'nonce', 'session', 'jwt', 'auth',
  'cookie',
];
const MEDIUM_PRIORITY_FIELDS = [
  'id', 'uuid', 'guid', 'slug', 'key', 'secret',
  'email', 'username', 'account',
];

correlationRoutes.post('/correlation/analyze', async (req: Request, res: Response) => {
  const data: { requests?: CapturedRequest[] } = req.body;
  const defaultCaptured = (recorderManager.getRecorderForProject('default')?.getCaptured() || []) as CapturedRequest[];
  const requests = data.requests || defaultCaptured;

  if (requests.length === 0) {
    res.json({ suggestions: [], diffs: [], message: 'No requests to analyze' });
    return;
  }

  // Pass 1: collect all values per path across ALL responses to detect static vs dynamic
  const pathValueSets = new Map<string, Set<string>>();
  for (const req of requests) {
    const extracted = extractValuesFromResponse(req, -1);
    for (const ev of extracted) {
      const key = `${ev.location}:${ev.extractPath}`;
      if (!pathValueSets.has(key)) pathValueSets.set(key, new Set());
      pathValueSets.get(key)!.add(ev.value);
    }
  }

  const rawSuggestions: CorrelationSuggestion[] = [];

  // Pass 2: find values extracted from one response and reused in subsequent requests
  for (let i = 0; i < requests.length; i++) {
    const sourceReq = requests[i];
    const extracted = extractValuesFromResponse(sourceReq, i);

    for (const ev of extracted) {
      if (!ev.value || ev.value.length < 4) continue;

      const usedIn = findValueInSubsequentRequests(requests, ev.value, i);
      if (usedIn.length === 0) continue;

      const pathKey = `${ev.location}:${ev.extractPath}`;
      const isDynamic = (pathValueSets.get(pathKey)?.size ?? 0) > 1;

      const score = computeMockScore(ev, usedIn, requests, isDynamic);
      const fieldName = ev.location === 'header' ? `header:${ev.extractPath}` : `json:${ev.extractPath}`;

      rawSuggestions.push({
        name: formatFieldName(ev.extractPath),
        requestIndex: i,
        location: ev.location,
        extractPath: ev.extractPath,
        variableName: `corr_${ev.extractPath.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
        sampleValue: ev.value,
        usedInRequests: usedIn,
        begin: '',
        end: '',
        score,
      });
    }
  }

  // Deduplicate: keep the highest-scored suggestion per (location, extractPath)
  const seen = new Map<string, CorrelationSuggestion>();
  for (const s of rawSuggestions) {
    const key = `${s.location}:${s.extractPath}`;
    const existing = seen.get(key);
    if (!existing || s.score > existing.score) {
      seen.set(key, s);
    }
  }

  const suggestions = Array.from(seen.values()).sort((a, b) => b.score - a.score);

  // Merge usedInRequests across duplicates
  for (const s of suggestions) {
    const allUsed = new Set<number>();
    for (const raw of rawSuggestions) {
      if (raw.location === s.location && raw.extractPath === s.extractPath) {
        for (const idx of raw.usedInRequests) allUsed.add(idx);
      }
    }
    s.usedInRequests = Array.from(allUsed).sort((a, b) => a - b);
  }

  res.json({ suggestions, diffs: [], count: suggestions.length });
});

function extractValuesFromResponse(reqRecord: CapturedRequest, idx: number): ExtractedValue[] {
  const result: ExtractedValue[] = [];

  // Extract header values
  for (const [key, value] of Object.entries(reqRecord.responseHeaders || {})) {
    if (value && value.length >= 4) {
      result.push({ location: 'header', extractPath: key, value, requestIndex: idx });
    }
  }

  // Extract JSON string values
  if (reqRecord.responseBody) {
    try {
      const json = JSON.parse(reqRecord.responseBody);
      extractJsonValues(json, '', result, idx);
    } catch {
      // Not JSON — extract tokens using regex
      const tokenRegex = /["']([a-zA-Z0-9_\-./+]{8,})["']/g;
      let match: RegExpExecArray | null;
      while ((match = tokenRegex.exec(reqRecord.responseBody)) !== null) {
        const token = match[1];
        if (token.length >= 4) {
          result.push({ location: 'json', extractPath: `body_token_at_${match.index}`, value: token, requestIndex: idx });
        }
      }
    }
  }

  return result;
}

function extractJsonValues(obj: any, prefix: string, result: ExtractedValue[], idx: number): void {
  if (typeof obj === 'string') {
    if (obj.length >= 4) {
      result.push({ location: 'json', extractPath: prefix || 'value', value: obj, requestIndex: idx });
    }
    return;
  }
  if (typeof obj !== 'object' || obj === null) return;

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      if (value.length >= 4) {
        result.push({ location: 'json', extractPath: path, value, requestIndex: idx });
      }
    } else if (typeof value === 'object' && value !== null) {
      extractJsonValues(value, path, result, idx);
    }
  }
}

function findValueInSubsequentRequests(requests: CapturedRequest[], value: string, sourceIdx: number): number[] {
  const found: number[] = [];
  for (let i = sourceIdx + 1; i < requests.length; i++) {
    const r = requests[i];
    if (r.url.includes(value)) { found.push(i); continue; }
    if (Object.values(r.headers).some(h => h.includes(value))) { found.push(i); continue; }
    if (r.body && r.body.includes(value)) { found.push(i); continue; }
  }
  return found;
}

function computeMockScore(ev: ExtractedValue, usedIn: number[], requests: CapturedRequest[], isDynamic: boolean): number {
  let score = 0;

  // Used in subsequent requests = primary signal
  score += usedIn.length * 50;

  // Check which part of the request uses this value
  for (const idx of usedIn) {
    const r = requests[idx];
    if (r.url.includes(ev.value)) score += 20;
    for (const [hdr, hdrVal] of Object.entries(r.headers)) {
      if (hdrVal.includes(ev.value)) {
        score += 15;
        if (hdr.toLowerCase() === 'authorization') score += 100;
        if (hdr.toLowerCase() === 'cookie' || hdr.toLowerCase() === 'x-csrf-token') score += 60;
        if (hdr.toLowerCase() === 'x-api-key') score += 50;
      }
    }
    if (r.body && r.body.includes(ev.value)) score += 10;
  }

  // Field name matches priority keywords
  const lower = ev.extractPath.toLowerCase();
  for (const kw of HIGH_PRIORITY_FIELDS) {
    if (lower.includes(kw)) { score += 80; break; }
  }
  for (const kw of MEDIUM_PRIORITY_FIELDS) {
    if (lower.includes(kw)) { score += 40; break; }
  }

  // Token-like values are more likely correlation candidates
  if (ev.value.length >= 32) score += 30;
  else if (ev.value.length >= 16) score += 20;
  else if (ev.value.length >= 8) score += 10;

  if (/^[a-zA-Z0-9_\-./+]{16,}$/.test(ev.value)) score += 25;

  // Prefer JSON extraction over header extraction (more precise)
  if (ev.location === 'json') score += 10;

  // Dynamic check: if the same path in other responses has different values, it's a real correlation candidate
  // If it's static (same value everywhere), it's likely just coincidental reuse → heavily penalize
  if (isDynamic) {
    score += 100;
  } else {
    score -= 200;
  }

  return score;
}

function formatFieldName(path: string): string {
  const words = path.split(/[._]/).map(w =>
    w.replace(/([A-Z])/g, ' $1').trim()
  ).flatMap(w => w.split(/\s+/)).filter(Boolean);
  const capitalized = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return capitalized.join(' ');
}

correlationRoutes.post('/correlation/generate-blocks', (req: Request, res: Response) => {
  interface RuleInput {
    variableName: string;
    extractLocation: 'header' | 'json' | 'body';
    extractPath: string;
    extractType: 'begin-end' | 'regex' | 'jsonpath';
    begin?: string;
    end?: string;
    pattern?: string;
    requestIndex: number;
    sampleValue?: string;
    usedInRequests?: number[];
  }

  const { rules, requests: rawRequests }: { rules?: RuleInput[]; requests?: CapturedRequest[] } = req.body;

  if (!rules || rules.length === 0) {
    res.json({ blocks: [], count: 0 });
    return;
  }

  const captured = rawRequests || [];

  // Build extraction code from rule
  function buildExtractionCode(rule: RuleInput): string {
    if (rule.extractLocation === 'header') {
      return `const ${rule.variableName} = response.headers('${rule.extractPath}');`;
    }
    if (rule.extractType === 'jsonpath' || rule.extractLocation === 'json') {
      return `const ${rule.variableName} = response.json().${rule.extractPath};`;
    }
    if (rule.extractType === 'begin-end' && rule.begin && rule.end) {
      return `const ${rule.variableName} = extractBetween(response.body, '${rule.begin}', '${rule.end}');`;
    }
    if (rule.extractType === 'regex' && rule.pattern) {
      return `const ${rule.variableName} = response.body.match(/${rule.pattern}/)[1];`;
    }
    return `const ${rule.variableName} = response.body;`;
  }

  // Build flat block list: http-request blocks interleaved with extraction blocks as siblings
  // Group extractions by their source request index
  const extractionsByRequest = new Map<number, any[]>();
  for (const rule of rules) {
    const block = {
      type: 'extract-variable' as const,
      label: `Extract ${rule.extractPath || rule.variableName}`,
      properties: {
        extractType: rule.extractType,
        expression: rule.extractPath,
        variableName: rule.variableName,
        extractionCode: buildExtractionCode(rule),
      },
    };
    const existing = extractionsByRequest.get(rule.requestIndex) || [];
    existing.push(block);
    extractionsByRequest.set(rule.requestIndex, existing);
  }

  // Build block list — extractors are children of their source request
  const blocks: any[] = [];
  for (let i = 0; i < captured.length; i++) {
    const c = captured[i];
    const props: Record<string, any> = {
      method: c.method,
      url: c.url,
      headers: Object.entries(c.headers || {}).map(([k, v]) => ({ key: k, value: v })),
      body: c.body || '',
    };
    if ((c as any).multipartBody) {
      props.multipartBody = (c as any).multipartBody;
      props.isMultipart = true;
    }
    const reqBlock: any = {
      type: 'http-request',
      label: `${c.method} ${c.url}`,
      properties: props,
    };

    const inserts = extractionsByRequest.get(i);
    if (inserts) {
      reqBlock.children = inserts;
    }

    blocks.push(reqBlock);
  }

  // Inject variable references into subsequent request blocks that use the extracted value
  for (const rule of rules) {
    const sampleVal = rule.sampleValue;
    if (!sampleVal || sampleVal.length < 1) continue;

    // Map request index → block index (each request is exactly one block, children are nested)
    const requestToFlatIndex: number[] = captured.map((_, i) => i);

    const varRef = `\${${rule.variableName}}`;
    for (const useIdx of (rule.usedInRequests || [])) {
      const targetFlatIdx = requestToFlatIndex[useIdx];
      if (targetFlatIdx === undefined) continue;
      const targetBlock = blocks[targetFlatIdx];
      if (!targetBlock || targetBlock.type !== 'http-request') continue;
      const p = targetBlock.properties;

      if (typeof p.url === 'string' && p.url.includes(sampleVal)) {
        p.url = p.url.replace(sampleVal, varRef);
      }
      if (Array.isArray(p.headers)) {
        p.headers = p.headers.map((h: any) => ({
          key: h.key,
          value: typeof h.value === 'string' ? h.value.replace(sampleVal, varRef) : h.value,
        }));
      }
      if (typeof p.body === 'string' && p.body.includes(sampleVal)) {
        p.body = p.body.replaceAll(sampleVal, varRef);
      }
    }
  }

  res.json({ blocks, count: blocks.length });
});
