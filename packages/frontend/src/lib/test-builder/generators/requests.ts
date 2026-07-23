import { TestBlock } from '../types';

export function genHttpRequest(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const method = p.method || 'GET';
  const url = p.url || '';
  const defaults = ctx?.pendingDefaults;
  const mergedHeaders = [
    ...(Array.isArray(defaults?.defaultHeaders) ? defaults.defaultHeaders : []),
    ...(Array.isArray(p.headers) ? p.headers : []),
    ...(ctx?.pendingHeaders || []),
  ];
  const tag = p.tag;
  ctx && (ctx.pendingHeaders = []);
  ctx && (ctx.pendingDefaults = null);
  const auth = ctx?.pendingAuth ?? null;
  ctx && (ctx.pendingAuth = null);
  const fullUrl = url.startsWith('http') ? url : (defaults?.baseUrl || '') + url;
  const params = genParams(mergedHeaders, tag, auth);
  if (method === 'GET') {
    lines.push(`${pad}var res = http.get(\`${url}\`${params});`);
  } else if (p.isMultipart && p.multipartBody) {
    lines.push(`${pad}var body = b64decode("${p.multipartBody}");`);
    lines.push(`${pad}var res = http.${method.toLowerCase()}(\`${url}\`, body${params});`);
  } else {
    const rawBody = p.body;
    if (rawBody) {
      const escaped = rawBody.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${').replace(/\n/g, '\\n');
      lines.push(`${pad}var res = http.${method.toLowerCase()}(\`${url}\`, \`${escaped}\`${params});`);
    } else {
      lines.push(`${pad}var res = http.${method.toLowerCase()}(\`${url}\`, null${params});`);
    }
  }
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("${method}", \`${url}\`, res.status, res.body, JSON.stringify(res.headers), res.timings.duration);`);
  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genHttpBatch(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const requests = block.children.filter(c => c.enabled && c.type === 'http-request');
  const postBlocks = block.children.filter(c => c.enabled && c.type !== 'http-request');
  if (requests.length > 0) {
    lines.push(`${pad}const responses = http.batch([`);
    for (const r of requests) {
      const rp = r.properties as Record<string, any>;
      lines.push(`${childPad}{ method: "${rp.method || 'GET'}", url: \`${rp.url || ''}\` },`);
    }
    lines.push(`${pad}]);`);
  }
  for (const child of postBlocks) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genGrpcCall(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const proto = p.protobuf ? `\n${childPad}client.load(null, \`${p.protobuf}\`);` : '';
  lines.push(`${pad}const client = new grpc.Client();${proto}`);
  lines.push(`${pad}client.connect(\`${p.service}\`);`);
  lines.push(`${pad}const res = client.invoke("${p.service}/${p.method}", ${p.body || '{}'});`);
  lines.push(`${pad}client.close();`);
  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genWebSocket(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const params = p.protocols ? `, { protocols: ['${p.protocols}'] }` : ', {}';
  const timeoutMs = parseInt(p.timeout) || 30000;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 2, ctx)).join('\n');
  let messagesOnOpen: string[] = [];
  try {
    const parsed = typeof p.messagesOnOpen === 'string' ? JSON.parse(p.messagesOnOpen) : p.messagesOnOpen;
    if (Array.isArray(parsed)) messagesOnOpen = parsed;
  } catch { /* ignore */ }
  let autoCloseCode = '';
  if (p.closeAfterMessages && p.closeAfterCount) {
    autoCloseCode = `\n${childPad}  socket.close();`;
  }
  const sendOnOpen = messagesOnOpen.length > 0
    ? messagesOnOpen.map((m: any) => `${childPad}  socket.send(JSON.stringify(${typeof m === 'string' ? `'${m}'` : JSON.stringify(m)}));`).join('\n')
    : `${childPad}  socket.send(JSON.stringify({ type: 'ping' }));`;
  const onMessageHandle = messagesOnOpen.length > 0 && p.closeAfterMessages && p.closeAfterCount
    ? `\n${childPad}  let _msgCount = 0;\n${childPad}  socket.on('message', function (data) {\n${childPad}    _msgCount++;\n${childPad}    if (_msgCount >= ${p.closeAfterCount}) {${autoCloseCode}\n${childPad}    }\n${childPad}  });`
    : `\n${childPad}  socket.on('message', function (data) {\n${childPad}    console.log('WS message: ' + data);\n${childPad}  });`;
  lines.push(`${pad}const res = ws.connect(\`${p.url}\`${params}, function (socket) {`);
  lines.push(`${childPad}socket.on('open', function () {`);
  lines.push(sendOnOpen);
  lines.push(`${childPad}});`);
  lines.push(onMessageHandle);
  if (childCode) {
    lines.push(`${childPad}socket.setTimeout(function () {`);
    lines.push(childCode.split('\n').map(l => `${childPad}  ${l.trim()}`).join('\n'));
    lines.push(`${childPad}}, ${timeoutMs});`);
  } else {
    lines.push(`${childPad}socket.setTimeout(function () {`);
    lines.push(`${childPad}  socket.close();`);
    lines.push(`${childPad}}, ${timeoutMs});`);
  }
  lines.push(`${childPad}socket.on('error', function (e) {`);
  lines.push(`${childPad}  console.log('WS error: ' + (e.error() || e));`);
  lines.push(`${childPad}});`);
  lines.push(`${childPad}socket.on('close', function () {});`);
  lines.push(`${pad}});`);
  return lines.join('\n');
}

export function genBrowserPage(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  lines.push(`${pad}const page = browser.newPage();`);
  lines.push(`${pad}page.goto(\`${p.url}\`);`);
  for (const child of block.children.filter(c => c.enabled)) {
    const cp = child.properties as Record<string, any>;
    if (child.type === 'http-request') {
      lines.push(`${pad}page.waitForNavigation();`);
    } else if (child.type === 'sleep') {
      lines.push(`${pad}page.waitForTimeout(${cp.duration || 1000});`);
    } else {
      lines.push(`${pad}${genBlock(child, indent + 1, ctx)}`);
    }
  }
  lines.push(`${pad}page.close();`);
  return lines.join('\n');
}

export function genSqlQuery(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const dbType = p.dbType || 'postgres';
  const query = p.query || '';
  const paramsVal = p.params || '[]';
  const connectStr = dbType === 'mysql'
    ? `const conn = mysql.connect(connConfig);`
    : `const pool = postgres.Pool(connString);\n${pad}const conn = pool.connect();`;
  const closeStr = dbType === 'mysql' ? `conn.close();` : `conn.close();\n${pad}pool.close();`;
  const configStr = dbType === 'mysql'
    ? `const connConfig = { host: 'localhost', port: 3306, db: 'mydb', user: 'user', password: 'pass' };`
    : `const connString = __ENV.DATABASE_URL || 'postgres://user:pass@localhost:5432/mydb';`;
  lines.push(`${pad}// DB Query: ${block.label}`);
  lines.push(`${pad}${configStr}`);
  lines.push(`${pad}${connectStr}`);
  lines.push(`${pad}try {`);
  lines.push(`${pad}  const result = conn.query(\`${query}\`${paramsVal !== '[]' ? `, ${paramsVal}` : ''});`);
  lines.push(`${pad}  check(result, { 'query succeeded': (r) => r !== undefined });`);
  lines.push(`${pad}} finally {`);
  lines.push(`${pad}  ${closeStr}`);
  lines.push(`${pad}}`);
  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genDummySampler(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const body = (p.responseBody || '{"status":"ok"}').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const rt = parseInt(p.responseTime) || 0;
  const sc = parseInt(p.statusCode) || 200;
  const lt = parseInt(p.latency) || 0;
  const msg = (p.responseMessage || 'OK').replace(/'/g, "\\'");
  const headers = Array.isArray(p.responseHeaders) ? p.responseHeaders : [];
  if (lt > 0) lines.push(`${pad}sleep(${lt / 1000});`);
  if (rt > lt) {
    lines.push(`${pad}sleep(${(rt - lt) / 1000});`);
  } else if (rt > 0 && lt === 0) {
    lines.push(`${pad}sleep(${rt / 1000});`);
  }
  const headersStr = headers.length > 0
    ? `{ ${headers.map((h: any) => `"${h.key.replace(/"/g, '\\"')}": "${h.value.replace(/"/g, '\\"')}"`).join(', ')} }`
    : '{}';
  lines.push(`${pad}var res = { status: ${sc}, status_text: "${msg}", body: '${body}', headers: ${headersStr}, timings: { duration: ${rt}, latency: ${lt} } };`);
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("DUMMY", "${block.label}", res.status, res.body, JSON.stringify(res.headers), res.timings.duration);`);
  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

function genHeaders(headers: unknown): string {
  if (!Array.isArray(headers) || headers.length === 0) return '{}';
  const entries = headers.map((h: any) => {
    const val = h.value;
    if (val.includes('${') || val.includes('`')) {
      return `    "${h.key}": \`${val}\``;
    }
    return `    "${h.key}": "${val.replace(/"/g, '\\"')}"`;
  });
  return `{\n${entries.join(',\n')}\n  }`;
}

function genParams(headers: unknown, tag?: string, auth?: { type: 'basic'; username: string; password: string } | null): string {
  const parts: string[] = [];
  if (Array.isArray(headers) && headers.length > 0) {
    parts.push(`headers: ${genHeaders(headers)}`);
  }
  if (tag) parts.push(`tags: { name: "${tag}" }`);
  if (auth) {
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\${/g, '\\${');
    parts.push(`auth: { username: "${esc(auth.username)}", password: "${esc(auth.password)}" }`);
  }
  return parts.length > 0 ? `, { ${parts.join(', ')} }` : '';
}
