import { TestBlock, BlockType, BLOCK_REGISTRY } from './types';
import { genHttpRequest, genHttpBatch, genGrpcCall, genWebSocket, genBrowserPage, genSqlQuery, genDummySampler } from './generators/requests';
import { genGroup, genLoop, genCondition, genTransaction, genThroughput, genInterleave, genRandomController, genSwitch, genForEach, genOnceOnly, genRuntime, genSynchronizingTimer } from './generators/flow';
import { TG_TYPES, generateOptionsForTg } from './generators/scenarios';
import { genIso8583, genIso20022 } from './generators/iso';
import { genFtp } from './generators/ftp';
import { genIbmmq } from './generators/ibmmq';
import { genKafka, genRedis, genMqtt } from './generators/extensions';

export interface GenContext {
  pendingHeaders: Array<{ key: string; value: string }>;
  pendingCookies: Array<{ domain: string; key: string; value: string; path?: string }>;
  pendingCache: { mode: string } | null;
  pendingAuth: { type: 'basic'; username: string; password: string } | null;
  pendingDefaults: { baseUrl?: string; defaultTimeout?: string; defaultHeaders?: Array<{ key: string; value: string }>; defaultParams?: string } | null;
}

function emptyCtx(): GenContext {
  return { pendingHeaders: [], pendingCookies: [], pendingCache: null, pendingAuth: null, pendingDefaults: null };
}

export function generateImports(blocks: TestBlock[]): Set<string> {
  const imports = new Set<string>();
  function walk(b: TestBlock[]) {
    for (const block of b) {
      if (block.type === 'http-request' || block.type === 'http-batch') imports.add("import http from 'k6/http';");
      if (block.type === 'check') imports.add("import { check } from 'k6';");
      if (block.type === 'assertion') imports.add("import { fail } from 'k6';");
      if (block.type === 'json-assertion') imports.add("import { fail } from 'k6';");
      if (block.type === 'grpc-call') imports.add("import grpc from 'k6/net/grpc';");
      if (block.type === 'websocket') imports.add("import ws from 'k6/ws';");
      if (block.type === 'browser-page') imports.add("import { browser } from 'k6/browser';");
      if (block.type === 'sql-query') {
        imports.add("import { check } from 'k6';");
        const p = block.properties as Record<string, any>;
        if (p.dbType === 'mysql') imports.add("import mysql from 'k6/experimental/mysql';");
        else imports.add("import { postgres } from 'k6/experimental/postgres';");
      }
      if (block.type === 'group') imports.add("import { group } from 'k6';");
      if (block.type === 'custom-metric') imports.add("import { Trend, Rate, Counter, Gauge } from 'k6/metrics';");
      if (block.type === 'extract-variable') imports.add("import { check } from 'k6';");
      if (block.type === 'data-file') {
        imports.add("import { SharedArray } from 'k6/data';");
        imports.add("import { papaparse } from 'https://jslib.k6.io/papaparse/5.1.1/index.js';");
      }
      if (block.type === 'transaction') imports.add("import { Trend } from 'k6/metrics';");
      if (block.type === 'once-only' || block.type === 'dummy-sampler') imports.add("import { sleep } from 'k6';");
      if (block.type === 'http-request' && (block.properties as any)?.isMultipart) imports.add("import { b64decode } from 'k6/encoding';");
      if (block.type === 'auth-manager' && (block.properties as any)?.authType === 'oauth2') imports.add("import http from 'k6/http';");
      if (block.type === 'iso8583') {
        const t = (block.properties as any)?.transport;
        if (t === 'tcp-binary') imports.add("import ISO8583 from 'k6/x/iso8583';");
        else imports.add("import http from 'k6/http';");
      }
      if (block.type === 'iso20022') imports.add("import http from 'k6/http';");
      if (block.type === 'ftp') imports.add("import ftp from 'k6/x/ftp';");
      if (block.type === 'ibmmq') {
        const ct = (block.properties as any)?.clientType;
        if (ct === 'amqp') imports.add("import amqp from 'k6/x/amqp';");
        else imports.add("import ibmmq from 'k6/x/ibmmq';");
      }
      if (block.type === 'kafka') imports.add("import kafka from 'k6/x/kafka';");
      if (block.type === 'redis') imports.add("import redis from 'k6/x/redis';");
      if (block.type === 'mqtt') imports.add("import mqtt from 'k6/x/mqtt';");
      walk(block.children);
    }
  }
  walk(blocks);
  return imports;
}

function hasRequestInTree(blocks: TestBlock[]): boolean {
  return blocks.some(blk => {
    if (blk.type === 'http-request' || blk.type === 'dummy-sampler') return true;
    if (blk.children.length > 0) return hasRequestInTree(blk.children);
    return false;
  });
}

function collectDataFilesRecursive(blocks: TestBlock[], out: string[]) {
  for (const block of blocks) {
    if (block.type === 'data-file' && block.enabled) {
      const p = block.properties as Record<string, any>;
      const varName = p.variableName || 'data';
      const filename = p.fileId ? `data/${p.fileId}.csv` : 'data.csv';
      out.push(`const ${varName} = new SharedArray('${varName}', function () {
  return papaparse.parse(open('./${filename}'), { header: true }).data;
});`);
    }
    collectDataFilesRecursive(block.children, out);
  }
}

function genBlock(block: TestBlock, indent: number, ctx?: GenContext): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];

  if (!block.enabled) {
    return `${pad}/* disabled: ${block.label} */`;
  }

  switch (block.type) {
    case 'http-request':
      return genHttpRequest(block, indent, ctx, genBlock);
    case 'http-batch':
      return genHttpBatch(block, indent, ctx, genBlock);
    case 'grpc-call':
      return genGrpcCall(block, indent, ctx, genBlock);
    case 'websocket':
      return genWebSocket(block, indent, ctx, genBlock);
    case 'browser-page':
      return genBrowserPage(block, indent, ctx, genBlock);
    case 'sql-query':
      return genSqlQuery(block, indent, ctx, genBlock);
    case 'dummy-sampler':
      return genDummySampler(block, indent, ctx, genBlock);
    case 'iso8583':
      return genIso8583(block, indent, ctx, genBlock);
    case 'iso20022':
      return genIso20022(block, indent, ctx, genBlock);
    case 'ftp':
      return genFtp(block, indent, ctx, genBlock);
    case 'ibmmq':
      return genIbmmq(block, indent, ctx, genBlock);
    case 'kafka':
      return genKafka(block, indent, ctx, genBlock);
    case 'redis':
      return genRedis(block, indent, ctx, genBlock);
    case 'mqtt':
      return genMqtt(block, indent, ctx, genBlock);
    case 'group':
      return genGroup(block, indent, ctx, genBlock);
    case 'loop':
      return genLoop(block, indent, ctx, genBlock);
    case 'condition':
      return genCondition(block, indent, ctx, genBlock);
    case 'transaction':
      return genTransaction(block, indent, ctx, genBlock);
    case 'throughput':
      return genThroughput(block, indent, ctx, genBlock);
    case 'interleave':
      return genInterleave(block, indent, ctx, genBlock);
    case 'random-controller':
      return genRandomController(block, indent, ctx, genBlock);
    case 'switch':
      return genSwitch(block, indent, ctx, genBlock);
    case 'for-each':
      return genForEach(block, indent, ctx, genBlock);
    case 'once-only':
      return genOnceOnly(block, indent, ctx, genBlock);
    case 'runtime':
      return genRuntime(block, indent, ctx, genBlock);
    case 'synchronizing-timer':
      return genSynchronizingTimer(block, indent, ctx, genBlock);
    case 'check': {
      const checksArr = Array.isArray(p.checks) ? p.checks : [p];
      const entries = checksArr.map((c: any) => {
        const target = c.target || 'status';
        const op = c.operator || '==';
        const expected = c.expected || '200';
        const expr = c.expression || buildCheckExpr(target, op, expected);
        const label = c.label || genCheckLabel(target, op, expected);
        return `    "${label}": (r) => ${expr}`;
      });
      lines.push(`${pad}check(res, {\n${entries.join(',\n')}\n  });`);
      break;
    }
    case 'sleep':
      lines.push(`${pad}sleep(${p.duration || 1});`);
      break;
    case 'wait': {
      if (p.type === 'uniform') {
        lines.push(`${pad}sleep(Math.random() * (${parseFloat(p.max || '3')} - ${parseFloat(p.min || '1')}) + ${parseFloat(p.min || '1')});`);
      } else if (p.type === 'gaussian') {
        lines.push(`${pad}// Gaussian random sleep (approximation)`);
        lines.push(`${pad}const delay = (Math.random() + Math.random() + Math.random()) / 3 * ${parseFloat(p.max || '3')};`);
        lines.push(`${pad}sleep(delay);`);
      } else {
        lines.push(`${pad}sleep(${parseFloat(p.duration || '1')});`);
      }
      break;
    }
    case 'set-variable': {
      const vn = p.varName || 'myVar';
      const val = p.value || '';
      const typ = p.expression || 'string';
      if (typ === 'number') {
        lines.push(`${pad}const ${vn} = ${parseFloat(val) || 0};`);
      } else if (typ === 'expression') {
        lines.push(`${pad}const ${vn} = ${val};`);
      } else {
        lines.push(`${pad}const ${vn} = '${val}';`);
      }
      break;
    }
    case 'counter': {
      const cn = p.varName || 'counter';
      const start = parseInt(p.start) || 0;
      const inc = parseInt(p.increment) || 1;
      lines.push(`${pad}if (typeof ${cn} === 'undefined') { let ${cn} = ${start}; }`);
      lines.push(`${pad}${cn} += ${inc};`);
      break;
    }
    case 'random-var': {
      const rvn = p.varName || 'randomVal';
      const rtype = p.type || 'integer';
      const min = parseInt(p.min) || 0;
      const max = parseInt(p.max) || 100;
      if (rtype === 'uuid') {
        lines.push(`${pad}const ${rvn} = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (c === 'x' ? Math.random() * 16 | 0 : (Math.random() * 16 | 0) & 0x3 | 0x8).toString(16));`);
      } else if (rtype === 'pick') {
        const items = p.items ? JSON.stringify(JSON.parse(p.items || '[]')) : '[]';
        lines.push(`${pad}const ${rvn} = ${items}[Math.floor(Math.random() * ${items}.length)];`);
      } else if (rtype === 'float') {
        lines.push(`${pad}const ${rvn} = Math.random() * (${max} - ${min}) + ${min};`);
      } else {
        lines.push(`${pad}const ${rvn} = Math.floor(Math.random() * (${max} - ${min} + 1)) + ${min};`);
      }
      break;
    }
    case 'data-file':
      lines.push(`${pad}// Data from file will be available via SharedArray`);
      lines.push(`${pad}const ${p.variableName || 'data'} = data; // Referenced via SharedArray`);
      break;
    case 'custom-metric': {
      const type = p.metricType || 'Trend';
      const name = p.name || `my_${type.toLowerCase()}`;
      lines.push(`${pad}if (typeof ${name} === 'undefined') {`);
      lines.push(`${pad}  const ${name} = new ${type}('${name}');`);
      lines.push(`${pad}}`);
      lines.push(`${pad}${name}.add(${p.value || '1'});`);
      break;
    }
    case 'extract-variable': {
      const varName = p.variableName || 'extractedValue';
      const expr = p.expression || '';
      const fallback = p.default ? ` || '${p.default}'` : '';
      if (p.extractType === 'jsonpath') {
        lines.push(`${pad}const ${varName} = JSON.parse(res.body)${expr.replace(/^\$\.?/, '').split('.').map((s: string) => s.includes('[') ? s : `['${s}']`).join('')}${fallback};`);
      } else if (p.extractType === 'header') {
        lines.push(`${pad}const ${varName} = res.headers['${expr}']${fallback};`);
      } else if (p.extractType === 'cookie') {
        lines.push(`${pad}const ${varName} = res.cookies['${expr}']${fallback};`);
      } else if (p.extractType === 'xpath') {
        lines.push(`${pad}const ${varName} = (() => { try { const p = new DOMParser().parseFromString(res.body, 'text/html'); const r = p.evaluate('${expr}', p, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null); return r.singleNodeValue?.textContent${fallback}; } catch { return undefined; } })();`);
      } else if (p.extractType === 'boundary') {
        const left = (p.leftBoundary || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const right = (p.rightBoundary || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        lines.push(`${pad}const ${varName} = (res.body.match(/${left}([\\s\\S]*?)${right}/) || [])[1]${fallback};`);
      } else {
        lines.push(`${pad}const ${varName} = res.body.match(/${expr}/)?.[1]${fallback};`);
      }
      break;
    }
    case 'assertion': {
      const target = p.target || 'status';
      const op = p.operator || '==';
      const expected = p.expected || '200';
      const severity = p.severity || 'error';
      const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
      let expr = '';
      if (target === 'status') expr = `res.status ${op} ${expected}`;
      else if (target === 'timing') expr = `res.timings.duration ${op} ${expected}`;
      else if (target === 'header') expr = `res.headers["${esc(expected)}"] ${op} undefined`;
      else if (target === 'body-contains') expr = `res.body.includes("${esc(expected)}")`;
      else if (target === 'body-regex') expr = `/${esc(expected)}/.test(res.body)`;
      else expr = `res.status ${op} ${expected}`;
      if (severity === 'error') {
        lines.push(`${pad}if (!(${expr})) {`);
        lines.push(`${pad}  fail("Assertion failed: ${block.label} - expected ${target} ${op} ${expected}");`);
        lines.push(`${pad}}`);
      } else {
        lines.push(`${pad}if (!(${expr})) {`);
        lines.push(`${pad}  console.warn("Warning: ${block.label} - expected ${target} ${op} ${expected}");`);
        lines.push(`${pad}}`);
      }
      break;
    }
    case 'log':
      lines.push(`${pad}console.${p.level || 'info'}(\`${p.message || ''}\`);`);
      break;
    case 'script':
      lines.push(`${pad}${(p.code || '// empty custom script').split('\n').join('\n' + pad)}`);
      break;
    case 'json-assertion': {
      const jp = p.jsonPath || '$.';
      const exp = p.expected || '';
      const jaOp = p.operator || '==';
      const sev = p.severity || 'error';
      const extracted = `_jsonVal_${block.id.replace(/-/g, '_')}`;
      lines.push(`${pad}let ${extracted};`);
      lines.push(`${pad}try { ${extracted} = JSON.parse(res.body); } catch { ${extracted} = null; }`);
      let cond = '';
      if (jaOp === 'exists') cond = `${extracted} !== null && ${jp.replace(/^\$\.?/, '').split('.').map((s: string) => s.includes('[') ? s : `['${s}']`).join('')} !== undefined`;
      else if (jaOp === 'contains') cond = `JSON.stringify(${extracted}).includes("${exp}")`;
      else cond = `${jp.replace(/^\$\.?/, '').split('.').map((s: string) => s.includes('[') ? s : `['${s}']`).join('')} ${jaOp} ${exp}`;
      if (sev === 'error') {
        lines.push(`${pad}if (!(${cond})) { fail("JSON assertion failed: ${jp} ${jaOp} ${exp}"); }`);
      } else {
        lines.push(`${pad}if (!(${cond})) { console.warn("JSON assertion warning: ${jp} ${jaOp} ${exp}"); }`);
      }
      break;
    }
    case 'header-manager': {
      const hdrs = p.headers || [];
      if (Array.isArray(hdrs) && ctx) ctx.pendingHeaders.push(...hdrs.filter((h: any) => h.key));
      break;
    }
    case 'cookie-manager': {
      const domain = p.domain || '';
      const cookies = p.cookies || [];
      if (domain && Array.isArray(cookies) && ctx) {
        const valid = cookies.filter((c: any) => c.key);
        if (valid.length > 0) {
          lines.push(`${pad}{`);
          lines.push(`${pad}  const _jar = http.cookieJar();`);
          for (const c of valid) {
            const val = c.value;
            const path = c.path || '/';
            lines.push(`${pad}  _jar.set(\`${domain}\`, \`${c.key}\`, \`${val}\`, { path: \`${path}\` });`);
          }
          lines.push(`${pad}}`);
        }
      }
      break;
    }
    case 'cache-manager': {
      const mode = p.mode || 'default';
      if (ctx) ctx.pendingCache = { mode };
      if (mode === 'disabled') {
        ctx?.pendingHeaders.push({ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' });
        ctx?.pendingHeaders.push({ key: 'Pragma', value: 'no-cache' });
        lines.push(`${pad}// Cache: disabled`);
      } else if (mode === 'force-reload') {
        ctx?.pendingHeaders.push({ key: 'Cache-Control', value: 'no-cache' });
        ctx?.pendingHeaders.push({ key: 'Pragma', value: 'no-cache' });
        lines.push(`${pad}// Cache: force reload`);
      } else {
        lines.push(`${pad}// Cache: default`);
      }
      break;
    }
    case 'http-defaults': {
      const baseUrl = p.baseUrl || '';
      const defaultTimeout = p.defaultTimeout || '';
      const defaultHeaders = Array.isArray(p.defaultHeaders) ? p.defaultHeaders : [];
      const defaultParams = p.defaultParams || '';
      if (ctx) ctx.pendingDefaults = { baseUrl, defaultTimeout, defaultHeaders, defaultParams };
      lines.push(`${pad}// HTTP Request Defaults: ${baseUrl || '(no base URL)'}`);
      break;
    }
    case 'auth-manager': {
      const authType = p.authType || 'bearer';
      if (authType === 'basic') {
        if (ctx) ctx.pendingAuth = { type: 'basic', username: p.username || '', password: p.password || '' };
        lines.push(`${pad}// Auth: Basic`);
      } else if (authType === 'bearer') {
        const token = p.token || '';
        if (token) ctx?.pendingHeaders.push({ key: 'Authorization', value: `Bearer ${token}` });
        lines.push(`${pad}// Auth: Bearer Token`);
      } else if (authType === 'api-key') {
        const keyName = p.keyName || 'X-API-Key';
        const keyValue = p.keyValue || '';
        if (keyValue) ctx?.pendingHeaders.push({ key: keyName, value: keyValue });
        lines.push(`${pad}// Auth: API Key (${keyName})`);
      } else if (authType === 'oauth2') {
        const tokenUrl = p.tokenUrl || '';
        const clientId = p.clientId || '';
        const clientSecret = p.clientSecret || '';
        const scopes = p.scopes || '';
        if (tokenUrl && clientId) {
          const scopeParam = scopes ? `, { scopes: '${scopes}' }` : '';
          lines.push(`${pad}// Auth: OAuth2 Client Credentials`);
          lines.push(`${pad}const _tokenRes = http.post(\`${tokenUrl}\`, {`);
          lines.push(`${pad}  grant_type: 'client_credentials',`);
          lines.push(`${pad}  client_id: '${clientId}',`);
          lines.push(`${pad}  client_secret: '${clientSecret}',`);
          if (scopes) lines.push(`${pad}  scope: '${scopes}',`);
          lines.push(`${pad}}${scopeParam});`);
          lines.push(`${pad}const _accessToken = JSON.parse(_tokenRes.body).access_token;`);
          ctx?.pendingHeaders.push({ key: 'Authorization', value: 'Bearer ${_accessToken}' });
        } else {
          lines.push(`${pad}// Auth: OAuth2 (incomplete config — token URL and Client ID required)`);
        }
      }
      break;
    }
    case 'pre-processor':
      lines.push(`${pad}// Pre-processor: ${block.label}`);
      lines.push(`${pad}${(p.code || '').split('\n').join('\n' + pad)}`);
      break;
    case 'post-processor':
      lines.push(`${pad}// Post-processor: ${block.label}`);
      lines.push(`${pad}${(p.code || '').split('\n').join('\n' + pad)}`);
      break;
  }

  return lines.join('\n');
}

function buildCheckExpr(target: string, op: string, expected: string): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
  if (target === 'status') return `r.status ${op} ${expected}`;
  if (target === 'timing') return `r.timings.duration ${op} ${expected}`;
  if (target === 'header') return `r.headers["${esc(expected)}"] ${op} undefined`;
  if (target === 'body-contains') return `r.body.includes("${esc(expected)}")`;
  if (target === 'body-regex') return `/${esc(expected)}/.test(r.body)`;
  return `r.status ${op} ${expected}`;
}

function genCheckLabel(target: string, op: string, expected: string): string {
  const labels: Record<string, string> = {
    status: 'status', timing: 'response time', 'body-contains': 'body contains', 'body-regex': 'body matches', header: 'header',
  };
  return `${labels[target] || target} ${op} ${expected}`;
}

export function generateScript(blocks: TestBlock[], options?: {
  vus?: number;
  duration?: string;
  iterations?: number;
  thresholds?: Record<string, string[]>;
  env?: Record<string, string>;
  tags?: Record<string, string>;
}): string {
  const tgBlocks = blocks.filter(b => TG_TYPES.includes(b.type) && b.enabled);
  const mergedImports = new Set<string>();
  let hasHttpRequest = false;
  const dataFileDeclarations: string[] = [];
  const optionsLines: string[] = [];
  const functions: { name: string; body: string; isDefault: boolean }[] = [];

  if (tgBlocks.length === 0) {
    const enabledBlocks = blocks.filter(b => b.enabled);
    const ctx = emptyCtx();
    const body = enabledBlocks.map(b => genBlock(b, 0, ctx)).join('\n\n');
    const imp = generateImports(enabledBlocks);
    imp.forEach(i => mergedImports.add(i));
    hasHttpRequest = hasRequestInTree(enabledBlocks);
    collectDataFilesRecursive(enabledBlocks, dataFileDeclarations);
    functions.push({ name: 'default', body, isDefault: true });
    if (options?.vus) optionsLines.push(`    vus: ${options.vus},`);
    if (options?.duration) optionsLines.push(`    duration: '${options.duration}',`);
    if (options?.iterations) optionsLines.push(`    iterations: ${options.iterations},`);
  } else if (tgBlocks.length === 1) {
    const tg = tgBlocks[0];
    const children = tg.children.filter(c => c.enabled);
    const ctx = emptyCtx();
    const body = children.map(b => genBlock(b, 0, ctx)).join('\n\n');
    const imp = generateImports(children);
    imp.forEach(i => mergedImports.add(i));
    hasHttpRequest = hasRequestInTree(children);
    collectDataFilesRecursive(children, dataFileDeclarations);
    functions.push({ name: 'default', body, isDefault: true });
    generateOptionsForTg(tg, optionsLines, options, 0, false);
  } else {
    const scenarioLines: string[] = [];
    for (let i = 0; i < tgBlocks.length; i++) {
      const tg = tgBlocks[i];
      const children = tg.children.filter(c => c.enabled);
      const ctx = emptyCtx();
      const body = children.map(b => genBlock(b, 0, ctx)).join('\n\n');
      const funcName = `flow_${sanitizeLabel(tg.label)}_${i}`;
      const imp = generateImports(children);
      imp.forEach(i => mergedImports.add(i));
      if (hasRequestInTree(children)) hasHttpRequest = true;
      collectDataFilesRecursive(children, dataFileDeclarations);
      functions.push({ name: funcName, body, isDefault: false });
      generateOptionsForTg(tg, scenarioLines, options, i, true, funcName);
    }
    functions.push({ name: 'default', body: '', isDefault: true });
    if (scenarioLines.length > 0) {
      optionsLines.push('    scenarios: {');
      for (const l of scenarioLines) optionsLines.push(`  ${l}`);
      optionsLines.push('    },');
    }
  }

  if (options?.thresholds && Object.keys(options.thresholds).length > 0) {
    optionsLines.push('    thresholds: {');
    for (const [metric, rules] of Object.entries(options.thresholds)) {
      optionsLines.push(`      '${metric}': [${rules.map(r => `'${r}'`).join(', ')}],`);
    }
    optionsLines.push('    },');
  }

  let code = mergedImports.size > 0 ? `${Array.from(mergedImports).join('\n')}\n\n` : '';

  if (hasHttpRequest) {
    code += `function __logRequest(method, url, status, body, headers, timing) {
  console.log(JSON.stringify({
    __requestLog: [{
      method, url: String(url), status,
      body: String(body).slice(0, 2000),
      headers,
      timing,
      timestamp: Date.now()
    }]
  }));
}

`;
  }

  if (dataFileDeclarations.length > 0) {
    code += dataFileDeclarations.join('\n\n') + '\n\n';
  }

  if (optionsLines.length > 0) {
    code += `export const options = {\n${optionsLines.join('\n')}\n};\n\n`;
  }

  for (const fn of functions) {
    if (code) code += '\n\n';
    if (fn.isDefault) {
      code += `export default function () {\n${fn.body ? fn.body.split('\n').map(l => `  ${l}`).join('\n') : ''}\n}`;
    } else {
      code += `export function ${fn.name}() {\n${fn.body.split('\n').map(l => `  ${l}`).join('\n')}\n}`;
    }
  }

  if (hasHttpRequest) {
    code += `

export function teardown() {
  // request logs emitted inline during execution
}`;
  }

  return code;
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
}
