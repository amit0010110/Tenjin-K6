import { TestBlock, BlockType, createBlock } from './types';

function identifyType(line: string): BlockType | null {
  const trimmed = line.trim();
  if (/SharedArray/.test(trimmed) || /papaparse/.test(trimmed)) return 'data-file';
  if (/__ITER === 0/.test(trimmed)) return 'once-only';
  if (/const runtimeEnd = Date\.now/.test(trimmed)) return 'runtime';
  if (/const transStart = Date\.now/.test(trimmed)) return 'transaction';
  if (/\bhttp\.(get|post|put|delete|patch|head|options)\(/.test(trimmed)) return 'http-request';
  if (/\bhttp\.batch\(/.test(trimmed)) return 'http-batch';
  if (/^group\(/.test(trimmed)) return 'group';
  if (/^check\(/.test(trimmed)) return 'check';
  if (/\bws\.connect\(/.test(trimmed)) return 'websocket';
  if (/\bgrpc\./.test(trimmed)) return 'grpc-call';
  if (/\bbrowser\./.test(trimmed) || /\.goto\(/.test(trimmed)) return 'browser-page';
  if (/^sleep\(/.test(trimmed) && /Math\.random/.test(trimmed)) return 'wait';
  if (/^sleep\(/.test(trimmed) && !/Math\.random/.test(trimmed)) return 'sleep';
  if (/^const delay =/.test(trimmed)) return 'wait';
  if (/\.query\(/.test(trimmed)) return 'sql-query';
  if (/^console\./.test(trimmed)) return 'log';
  if (/^for\s*\(/.test(trimmed) || /^while\s*\(/.test(trimmed)) return 'loop';
  if (/^if\s*\(!\(?(res\.status|res\.timings|res\.headers|res\.body)/.test(trimmed)) return 'assertion';
  if (/^\s*fail\(/.test(trimmed)) return 'assertion';
  // Skip runtime logging infrastructure
  if (/__logRequest\("DUMMY"/.test(trimmed)) return 'dummy-sampler';
  if (/typeof __logRequest/.test(trimmed)) return null;
  if (/^if\s*\(/.test(trimmed)) return 'condition';
  if (/__ITER %/.test(trimmed) && /switch/.test(trimmed)) return 'interleave';
  if (/Math\.floor\(Math\.random/.test(trimmed) && /switch/.test(trimmed)) return 'random-controller';
  if (/Math\.random\(\)\s*\*\s*100\s*</.test(trimmed)) return 'throughput';
  if (/Math\.floor\(Math\.random/.test(trimmed) && !/switch/.test(trimmed)) return 'random-var';
  if (/typeof .* === 'undefined'/.test(trimmed) && /\+= /.test(trimmed)) return 'counter';
  if (/^\s*const\s+\w+\s*=\s*['"`]/.test(trimmed) && !/http\.|check\(|data;|SharedArray|\bws\.connect|\bgrpc|\bbrowser/.test(trimmed)) return 'set-variable';
  if (/^\s*const\s+\w+\s*=\s*[0-9]/.test(trimmed) && !/http\.|grpc|browser/.test(trimmed)) return 'set-variable';
  if (/\.forEach\(/.test(trimmed)) return 'for-each';
  if (/^switch\s*\(/.test(trimmed)) return 'switch';
  if (/(new|const\s+\w+\s*=\s*new)\s+(Trend|Rate|Counter|Gauge)\(/.test(trimmed)) return 'custom-metric';
  if (/\.\s*add\(/.test(trimmed) && !/forEach/.test(trimmed)) return 'custom-metric';
  if (/JSON\.parse\(res\.body\)/.test(trimmed) && !/fail\("JSON assertion/.test(trimmed)) return 'extract-variable';
  if (/res\.headers\[/.test(trimmed) || /res\.cookies\[/.test(trimmed) || /res\.body\.match\(/.test(trimmed)) return 'extract-variable';
  if (/DOMParser/.test(trimmed) || /XPathResult/.test(trimmed)) return 'extract-variable';
  if (/document\.querySelector/.test(trimmed)) return 'extract-variable';
  if (/^let _jsonVal_/.test(trimmed)) return 'json-assertion';
  if (/JSON\.assertion/.test(trimmed) || /fail\("JSON assertion/.test(trimmed)) return 'json-assertion';
  if (/http\.defaults\.headers/.test(trimmed)) return 'header-manager';
  if (/http\.cookieJar\(\)/.test(trimmed)) return 'cookie-manager';
  if (/Cache: disabled|Cache: force reload|Cache: default/.test(trimmed)) return 'cache-manager';
  if (/Synchronizing Timer/.test(trimmed) || /__VU %/.test(trimmed)) return 'synchronizing-timer';
  if (/\/\/ Pre-processor/.test(trimmed)) return 'pre-processor';
  if (/\/\/ Post-processor/.test(trimmed)) return 'post-processor';
  if (/\/\/ Auth:/.test(trimmed)) return 'auth-manager';
  if (/\/\/ HTTP Request Defaults/.test(trimmed)) return 'http-defaults';
  if (/iso8583|isoPayload|iso8583_/.test(trimmed)) return 'iso8583';
  if (/\/\/ iso20022/.test(trimmed)) return 'iso20022';
  return null;
}

function extractMethod(line: string): string {
  const m = line.trim().match(/http\.(\w+)\(/);
  return m ? m[1].toUpperCase() : 'GET';
}

function extractUrl(line: string): string {
  let m = line.trim().match(/http\.\w+\(`([^`]+)`/);
  if (m) return m[1];
  m = line.trim().match(/http\.\w+\(['"]([^'"]+)['"]/);
  return m ? m[1] : '';
}

function extractGroupName(line: string): string {
  const m = line.trim().match(/group\("([^"]+)"|group\('([^']+)'|group\(`([^`]+)`/);
  return m?.[1] || m?.[2] || m?.[3] || 'group';
}

function extractCheckLabels(code: string): { label: string; expression: string }[] {
  const checks: { label: string; expression: string }[] = [];
  const checkRegex = /["']([^"']+)["']:\s*\(?\w+\)?\s*=>\s*([^,}\n]+)/g;
  let m;
  while ((m = checkRegex.exec(code)) !== null) {
    checks.push({ label: m[1], expression: m[2].trim() });
  }
  return checks;
}

function parseCheckExpression(expr: string): { target: string; operator: string; expected: string } | null {
  const statusM = expr.match(/^r\.status\s*([=!<>]+)\s*(.+)$/);
  if (statusM) return { target: 'status', operator: statusM[1], expected: statusM[2].trim() };

  const timingM = expr.match(/^r\.timings\.duration\s*([=!<>]+)\s*(.+)$/);
  if (timingM) return { target: 'timing', operator: timingM[1], expected: timingM[2].trim() };

  const bodyContainsM = expr.match(/^r\.body\.includes\(["'](.+?)["']\)$/);
  if (bodyContainsM) return { target: 'body-contains', operator: '==', expected: bodyContainsM[1] };

  const bodyRegexM = expr.match(/^\/(.+)\/\.test\(r\.body\)$/);
  if (bodyRegexM) return { target: 'body-regex', operator: 'matches', expected: bodyRegexM[1] };

  const headerM = expr.match(/^r\.headers\[["'](.+?)["']\]\s*([=!<>]+)\s*undefined$/);
  if (headerM) return { target: 'header', operator: headerM[2], expected: headerM[1] };

  return null;
}

function extractSleepDuration(line: string): string {
  const m = line.trim().match(/sleep\(([^);]+)/);
  return m ? m[1].trim() : '1';
}

function extractLoopCount(line: string): string {
  const m = line.trim().match(/for\s*\([^;]*;\s*iter\s*<\s*(\d+)/);
  return m ? m[1] : '10';
}

function extractConditionExpression(line: string): string {
  const m = line.trim().match(/if\s*\(([^)]+)\)/);
  return m ? m[1].trim() : '';
}

function extractAssertionProps(line: string): { target: string; operator: string; expected: string; severity: string } {
  const trimmed = line.trim();
  const def = { target: 'status', operator: '==', expected: '200', severity: 'error' as const };
  if (/^fail\(/.test(trimmed)) {
    const m = trimmed.match(/expected\s+(\w+)\s+(==|!=|<|<=|>|>=)\s+([^")\]]+)/);
    if (m) return { target: m[1], operator: m[2], expected: m[3].trim().replace(/"$/, ''), severity: 'error' };
    return def;
  }
  return def;
}

function extractExtractVariableProps(line: string): Record<string, string> {
  const def: Record<string, string> = { extractType: 'jsonpath', expression: '', variableName: 'extracted' };
  const trimmed = line.trim();
  const varM = trimmed.match(/const\s+(\w+)\s*=/);
  if (varM) def.variableName = varM[1];
  if (/JSON\.parse\(res\.body\)/.test(trimmed)) {
    const expM = trimmed.match(/JSON\.parse\(res\.body\)([^;]+)/);
    if (expM) def.expression = expM[1].trim().replace(/^\$\.?/, '');
    def.extractType = 'jsonpath';
  } else if (/res\.headers\[/.test(trimmed)) {
    const expM = trimmed.match(/res\.headers\[['"]([^'"]+)['"]\]/);
    if (expM) def.expression = expM[1];
    def.extractType = 'header';
  } else if (/res\.cookies\[/.test(trimmed)) {
    const expM = trimmed.match(/res\.cookies\[['"]([^'"]+)['"]\]/);
    if (expM) def.expression = expM[1];
    def.extractType = 'cookie';
  } else if (/res\.body\.match\(/.test(trimmed)) {
    const expM = trimmed.match(/res\.body\.match\(\/([^/]+)\//);
    if (expM) def.expression = expM[1];
    def.extractType = 'regex';
  } else if (/DOMParser/.test(trimmed) || /XPathResult/.test(trimmed)) {
    const expM = trimmed.match(/evaluate\('([^']+)'/);
    if (expM) def.expression = expM[1];
    def.extractType = 'xpath';
  } else if (/\.match\(\/.*\\\(\[\\s\\S/.test(trimmed)) {
    const leftM = trimmed.match(/match\(\/([^[(]+)\(/);
    const rightM = trimmed.match(/\\]\(\[\\s\\S\*\\?\)([^(]+)\//);
    if (leftM) def.leftBoundary = leftM[1].replace(/\\/g, '');
    if (rightM) def.rightBoundary = rightM[1].replace(/\\/g, '');
    def.extractType = 'boundary';
  }
  return def;
}

function extractWaitProps(line: string): Record<string, unknown> {
  const trimmed = line.trim();
  if (/Math\.random/.test(trimmed)) {
    const maxM = trimmed.match(/Math\.random\s*\*\s*\(([^)]+)\)/);
    const minM = trimmed.match(/\)\s*\+\s*([\d.]+)/);
    const dirM = trimmed.match(/\/\s*3\s*\*\s*([\d.]+)/);
    if (dirM) return { type: 'gaussian', max: dirM[1], min: '0' };
    if (maxM && minM) return { type: 'uniform', duration: '1s', max: parseFloat(maxM[1]) + parseFloat(minM[1]) + '', min: minM[1] };
    return { type: 'uniform', duration: '1s', max: '3', min: '1' };
  }
  return { type: 'fixed', duration: '1s' };
}

function extractForEachArray(code: string): { array: string; itemVar: string; indexVar: string } {
  const m = code.match(/\(([^)]+)\)\.forEach\(\((\w+),\s*(\w+)\)/);
  return { array: m ? m[1] : '[]', itemVar: m ? m[2] : 'item', indexVar: m ? m[3] : 'index' };
}

function extractSetVariableProps(line: string): Record<string, unknown> {
  const trimmed = line.trim();
  const varM = trimmed.match(/const\s+(\w+)\s*=\s*(.+);/);
  if (!varM) return { varName: '', value: '', expression: 'string' };
  const val = varM[2].trim();
  if (/^['"]/.test(val)) return { varName: varM[1], value: val.replace(/^['"]|['"]$/g, ''), expression: 'string' };
  if (/^-?[\d.]+$/.test(val)) return { varName: varM[1], value: val, expression: 'number' };
  return { varName: varM[1], value: val, expression: 'expression' };
}

function extractCounterProps(lines: string[]): Record<string, unknown> {
  const props: Record<string, unknown> = { varName: 'counter', start: 0, increment: 1 };
  for (const l of lines) {
    const m = l.trim().match(/typeof\s+(\w+)/);
    if (m) props.varName = m[1];
    if (/^\s*\w+\s*\+=/.test(l.trim())) {
      const incM = l.trim().match(/\+=\s*(\d+)/);
      if (incM) props.increment = parseInt(incM[1]);
    }
  }
  return props;
}

function extractRandomVarProps(lines: string[]): Record<string, unknown> {
  const props: Record<string, unknown> = { varName: 'randomVal', type: 'integer', min: 0, max: 100 };
  for (const l of lines) {
    const trimmed = l.trim();
    const varM = trimmed.match(/const\s+(\w+)\s*=/);
    if (varM) props.varName = varM[1];
    if (/xxxxxxxx-xxxx/.test(trimmed)) { props.type = 'uuid'; }
    else if (/\.length\]/.test(trimmed)) { props.type = 'pick'; }
    else if (/Math\.random\(\)\s*\*/.test(trimmed) && /\+ /.test(trimmed) && !/floor/.test(trimmed)) { props.type = 'float'; }
    else if (/Math\.floor/.test(trimmed)) { props.type = 'integer'; }
  }
  return props;
}

function extractThroughtputProps(lines: string[]): Record<string, unknown> {
  const props: Record<string, unknown> = { mode: 'percent', percent: 50, totalExecutions: 0 };
  for (const l of lines) {
    const trimmed = l.trim();
    if (/__ITER/.test(trimmed)) {
      props.mode = 'total';
      const m = trimmed.match(/__ITER\s*<\s*(\d+)/);
      if (m) props.totalExecutions = parseInt(m[1]);
    } else if (/Math\.random/.test(trimmed)) {
      props.mode = 'percent';
      const m = trimmed.match(/Math\.random\(\)\s*\*\s*100\s*<\s*(\d+)/);
      if (m) props.percent = parseInt(m[1]);
    }
  }
  return props;
}

export function parseScriptToBlocks(code: string): TestBlock[] {
  const lines = code.split('\n');
  const blocks: TestBlock[] = [];
  const stack: { block: TestBlock; indent: number }[] = [];
  let defaultFnStarted = false;
  let inDefaultFn = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('export default function')) {
      defaultFnStarted = true;
      inDefaultFn = true;
      braceDepth = 1;
      continue;
    }

    if (!trimmed || trimmed.startsWith('import') || trimmed.startsWith('export const') || trimmed.startsWith('export let')) {
      continue;
    }

    if (!inDefaultFn && defaultFnStarted) {
      if (trimmed === '}') {
        inDefaultFn = false;
      }
      continue;
    }

    // Track brace depth to know when default function ends
    if (inDefaultFn) {
      for (const ch of trimmed) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) {
        // Remove the block that was added for this line (the closing brace line is not a real block)
        inDefaultFn = false;
        if (stack.length > 0 && stack[stack.length - 1].block.children.length > 0) {
          // Don't include the brace line itself
        }
        continue;
      }
    }

    if (!inDefaultFn) continue;

    // Skip pure brace lines (closing braces of containers)
    if (/^\s*\}[\s;]*$/.test(line)) continue;

    const currentIndent = line.search(/\S/);
    const type = identifyType(trimmed);

    if (!type) continue;

    while (stack.length > 0 && currentIndent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    let block: TestBlock;

    if (type === 'http-request') {
      block = createBlock('http-request', {
        label: `${extractMethod(trimmed)} ${extractUrl(trimmed)}`,
        properties: { method: extractMethod(trimmed), url: extractUrl(trimmed) },
      });
    } else if (type === 'check') {
      const checks = extractCheckLabels(lines.slice(i, i + 10).join('\n'));
      let checkProps: Record<string, unknown>;
      if (checks.length === 1) {
        const parsed = parseCheckExpression(checks[0].expression);
        if (parsed) {
          checkProps = { target: parsed.target, operator: parsed.operator, expected: parsed.expected, label: checks[0].label };
        } else {
          checkProps = { checks, target: 'status', operator: '==', expected: '200', label: checks[0].label || 'check' };
        }
      } else if (checks.length > 1) {
        checkProps = { checks, target: 'status', operator: '==', expected: '200', label: '' };
      } else {
        checkProps = { target: 'status', operator: '==', expected: '200', label: '' };
      }
      block = createBlock('check', { label: checks[0]?.label || 'Check Response', properties: checkProps });
    } else if (type === 'group') {
      block = createBlock('group', {
        label: extractGroupName(trimmed),
        properties: { name: extractGroupName(trimmed) },
      });
    } else if (type === 'sleep') {
      block = createBlock('sleep', {
        label: `Sleep ${extractSleepDuration(trimmed)}s`,
        properties: { duration: extractSleepDuration(trimmed) },
      });
    } else if (type === 'loop') {
      block = createBlock('loop', {
        label: `Loop ${extractLoopCount(trimmed)}x`,
        properties: { count: parseInt(extractLoopCount(trimmed)) || 10 },
      });
    } else if (type === 'condition') {
      block = createBlock('condition', {
        label: `If ${extractConditionExpression(trimmed)}`,
        properties: { expression: extractConditionExpression(trimmed) },
      });
    } else if (type === 'log') {
      block = createBlock('log', {
        label: 'Log Message',
        properties: { message: trimmed.replace(/^console\.\w+\(`/, '').replace(/`\)$/, '') },
      });
    } else if (type === 'assertion') {
      const props = extractAssertionProps(trimmed);
      block = createBlock('assertion', {
        label: `Assert ${props.target} ${props.operator} ${props.expected}`,
        properties: props,
      });
    } else if (type === 'extract-variable') {
      const props = extractExtractVariableProps(trimmed);
      block = createBlock('extract-variable', {
        label: `Extract ${props.variableName}`,
        properties: props,
      });
    } else if (type === 'custom-metric') {
      const m = trimmed.match(/(\w+)\.add\(/);
      block = createBlock('custom-metric', {
        label: `Metric ${m ? m[1] : 'unknown'}`,
        properties: { name: m ? m[1] : 'custom' },
      });
    } else if (type === 'sql-query') {
      block = createBlock('sql-query', {
        label: 'SQL Query',
        properties: { query: trimmed.replace(/^.*\.query\(`/, '').replace(/`\).*$/, '') },
      });
    } else if (type === 'http-batch') {
      block = createBlock('http-batch', { label: 'HTTP Batch', properties: {} });
    } else if (type === 'wait') {
      const waitProps = extractWaitProps(trimmed);
      block = createBlock('wait', {
        label: `Wait (${waitProps.type})`,
        properties: waitProps,
      });
    } else if (type === 'transaction') {
      const transM = trimmed.match(/'([^']+)'/,);
      const name = transM ? transM[1] : 'transaction';
      block = createBlock('transaction', {
        label: `Transaction: ${name}`,
        properties: { name },
      });
    } else if (type === 'throughput') {
      block = createBlock('throughput', {
        label: 'Throughput Controller',
        properties: extractThroughtputProps([trimmed]),
      });
    } else if (type === 'interleave') {
      block = createBlock('interleave', { label: 'Interleave Controller', properties: {} });
    } else if (type === 'random-controller') {
      block = createBlock('random-controller', { label: 'Random Controller', properties: {} });
    } else if (type === 'switch') {
      const selM = trimmed.match(/switch\s*\(([^)]+)/);
      block = createBlock('switch', {
        label: 'Switch',
        properties: { selector: selM ? selM[1].trim() : '' },
      });
    } else if (type === 'for-each') {
      const eachProps = extractForEachArray(trimmed);
      block = createBlock('for-each', {
        label: `For Each ${eachProps.itemVar} in ${eachProps.array.slice(0, 20)}`,
        properties: eachProps,
      });
    } else if (type === 'once-only') {
      block = createBlock('once-only', { label: 'Once Only', properties: {} });
    } else if (type === 'runtime') {
      const durM = trimmed.match(/\+ (\d+);/);
      block = createBlock('runtime', {
        label: `Runtime ${durM ? durM[1] : '5000'}ms`,
        properties: { durationMs: durM ? parseInt(durM[1]) : 5000 },
      });
    } else if (type === 'set-variable') {
      block = createBlock('set-variable', {
        label: 'Set Variable',
        properties: extractSetVariableProps(trimmed),
      });
    } else if (type === 'counter') {
      block = createBlock('counter', {
        label: 'Counter',
        properties: extractCounterProps([trimmed]),
      });
    } else if (type === 'random-var') {
      block = createBlock('random-var', {
        label: 'Random Variable',
        properties: extractRandomVarProps([trimmed]),
      });
    } else if (type === 'data-file') {
      const varM = trimmed.match(/const\s+(\w+)\s*=/);
      block = createBlock('data-file', {
        label: `Data: ${varM ? varM[1] : 'file'}`,
        properties: { variableName: varM ? varM[1] : 'data', format: 'csv' },
      });
    } else if (type === 'json-assertion') {
      const jpM = trimmed.match(/"([^"]+)"/);
      block = createBlock('json-assertion', {
        label: `JSON Assert ${jpM ? jpM[1] : '$.path'}`,
        properties: { jsonPath: jpM ? jpM[1] : '', expected: '', operator: '==', severity: 'error' },
      });
    } else if (type === 'header-manager') {
      block = createBlock('header-manager', { label: 'Header Manager', properties: { headers: [] } });
    } else if (type === 'cookie-manager') {
      const domainM = trimmed.match(/_jar\.set\(`([^`]+)`/);
      const cookieM = trimmed.match(/_jar\.set\(`[^`]+`,\s*`([^`]+)`,\s*`([^`]+)`/);
      block = createBlock('cookie-manager', {
        label: 'Cookie Manager',
        properties: {
          domain: domainM ? domainM[1] : '',
          cookies: cookieM ? [{ key: cookieM[1], value: cookieM[2], path: '/' }] : [],
        },
      });
    } else if (type === 'cache-manager') {
      const mode = trimmed.includes('disabled') ? 'disabled' : trimmed.includes('force reload') ? 'force-reload' : 'default';
      block = createBlock('cache-manager', { label: 'Cache Manager', properties: { mode } });
    } else if (type === 'auth-manager') {
      const authType = trimmed.includes('Bearer') ? 'bearer' : trimmed.includes('Basic') ? 'basic' : trimmed.includes('API Key') ? 'api-key' : trimmed.includes('OAuth2') ? 'oauth2' : 'bearer';
      block = createBlock('auth-manager', { label: 'Authorization Manager', properties: { authType, token: '', username: '', password: '', keyName: 'X-API-Key', keyValue: '', tokenUrl: '', clientId: '', clientSecret: '', scopes: '' } });
    } else if (type === 'http-defaults') {
      block = createBlock('http-defaults', { label: 'HTTP Request Defaults', properties: { baseUrl: '', defaultTimeout: '', defaultHeaders: [], defaultParams: '' } });
    } else if (type === 'synchronizing-timer') {
      block = createBlock('synchronizing-timer', { label: 'Synchronizing Timer', properties: { vuCount: 5, timeout: 30000 } });
    } else if (type === 'pre-processor') {
      block = createBlock('pre-processor', { label: 'Pre Processor', properties: { code: trimmed } });
    } else if (type === 'post-processor') {
      block = createBlock('post-processor', { label: 'Post Processor', properties: { code: trimmed } });
    } else if (type === 'dummy-sampler') {
      const scM = trimmed.match(/status: (\d+)/);
      const msgM = trimmed.match(/status_text: "([^"]+)"/);
      const bodyM = trimmed.match(/body: '([^']+)'/);
      const rtM = trimmed.match(/duration: (\d+)/);
      block = createBlock('dummy-sampler', {
        label: 'Dummy Sampler',
        properties: {
          statusCode: scM ? parseInt(scM[1]) : 200,
          responseMessage: msgM ? msgM[1] : 'OK',
          responseBody: bodyM ? bodyM[1] : '{"status":"ok"}',
          responseTime: rtM ? parseInt(rtM[1]) : 0,
          latency: 0,
          responseHeaders: [],
        },
      });
    } else if (type === 'iso8583') {
      const mtiM = trimmed.match(/mti:\s*'(\d+)'/);
      const epM = trimmed.match(/http\.post\(`([^`]+)`/);
      block = createBlock('iso8583', {
        label: `ISO 8583 ${mtiM ? mtiM[1] : ''}`,
        properties: {
          mti: mtiM ? mtiM[1] : '0200',
          pan: '',
          processingCode: '',
          amount: '',
          stan: '',
          transmissionDate: '',
          transmissionTime: '',
          customFields: '',
          endpoint: epM ? epM[1] : '',
          dataFormat: 'json',
        },
      });
    } else if (type === 'iso20022') {
      const mtM = trimmed.match(/iso20022|MessageType|xmlBody/);
      const epM = trimmed.match(/http\.post\(`([^`]+)`/);
      block = createBlock('iso20022', {
        label: 'ISO 20022',
        properties: {
          messageType: 'pain.001.001.03',
          xmlBody: '',
          endpoint: epM ? epM[1] : '',
          contentType: 'application/xml',
        },
      });
    } else {
      block = createBlock('script', {
        label: trimmed.slice(0, 40),
        properties: { code: trimmed },
      });
    }

    if (stack.length > 0) {
      stack[stack.length - 1].block.children.push(block);
    } else {
      blocks.push(block);
    }

    if (block.type === 'group' || block.type === 'loop' || block.type === 'condition' || block.type === 'http-batch' || block.type === 'websocket' || block.type === 'browser-page' || block.type === 'transaction' || block.type === 'throughput' || block.type === 'interleave' || block.type === 'random-controller' || block.type === 'switch' || block.type === 'for-each' || block.type === 'once-only' || block.type === 'runtime' || block.type === 'synchronizing-timer' || block.type === 'scenario' || block.type === 'stages-scenario' || block.type === 'arrivals-scenario' || block.type === 'http-request' || block.type === 'grpc-call' || block.type === 'sql-query' || block.type === 'dummy-sampler' || block.type === 'iso8583' || block.type === 'iso20022') {
      stack.push({ block, indent: currentIndent });
    }
  }

  return blocks.length > 0 ? blocks : [];
}
