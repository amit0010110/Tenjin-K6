import { TestBlock, createBlock } from './types';
import { convertEnterpriseElement } from './jmeter-enterprise-parsers';

function toBlock(t: string, overrides?: Partial<TestBlock>): TestBlock {
  return createBlock(t as any, overrides);
}

function getTestClass(el: Element): string {
  const tcAttr = el.getAttribute('testclass') || el.getAttribute('class') || el.tagName || '';
  const propClass = strProp(el, 'TestElement.test_class');
  const raw = propClass || tcAttr;
  const parts = raw.split('.');
  return parts[parts.length - 1] || raw;
}

function getTestName(el: Element): string {
  return el.getAttribute('testname') || strProp(el, 'TestElement.name') || el.getAttribute('name') || '';
}

function strProp(el: Element, name: string): string {
  // 1. Standard JMeter format: <stringProp name="name">value</stringProp>
  const standardProp = el.querySelector(`stringProp[name="${name}"], boolProp[name="${name}"], intProp[name="${name}"], longProp[name="${name}"]`);
  if (standardProp) {
    return standardProp.textContent || '';
  }

  // 2. TMeter / XStream map format: where <name>name</name> has sibling <value>value</value>
  const names = Array.from(el.querySelectorAll('name'));
  for (const n of names) {
    if (n.textContent === name) {
      const parent = n.parentElement;
      if (parent) {
        const valEl = parent.querySelector('value');
        if (valEl) return valEl.textContent || '';
      }
    }
  }

  return '';
}

function intProp(el: Element, name: string, def = 0): number {
  const v = strProp(el, name);
  return v ? parseInt(v, 10) : def;
}

function buildUrl(el: Element): string {
  const protocol = strProp(el, 'HTTPSampler.protocol') || 'https';
  const domain = strProp(el, 'HTTPSampler.domain') || 'localhost';
  const port = strProp(el, 'HTTPSampler.port');
  const path = strProp(el, 'HTTPSampler.path') || '/';
  return `${protocol}://${domain}${port && port !== '80' && port !== '443' ? `:${port}` : ''}${path}`;
}

function getHeaders(el: Element): { key: string; value: string }[] {
  const headers: { key: string; value: string }[] = [];
  for (const child of parseChildren(el)) {
    if (getTestClass(child) === 'HeaderManager') {
      for (const h of parseChildren(child)) {
        if (getTestClass(h) === 'Header' && h.getAttribute('testname') !== '') {
          const name = strProp(h, 'Header.name');
          const value = strProp(h, 'Header.value');
          if (name) headers.push({ key: name, value });
        }
      }
    }
  }
  return headers;
}

function parseChildren(parent: Element): Element[] {
  const ht = parent.nextElementSibling;
  if (!ht || (ht.tagName !== 'hashTree' && ht.tagName !== 'testPlan' && !ht.tagName.endsWith('HashTree') && !ht.tagName.endsWith('hashTree'))) {
    return [];
  }

  const identityMap = ht.querySelector('java\\.util\\.IdentityHashMap') || ht.getElementsByTagName('java.util.IdentityHashMap')[0];
  const container = identityMap || ht;

  const results: Element[] = [];
  const ignoreTags = new Set(['hashtree', 'org.apache.jorphan.collections.hashtree', 'default', 'data', 'unserializable-parents', 'java.util.identityhashmap', 'java.lang.integer', 'java.lang.string', 'size', 'order', 'mutex', 'propmap', 'version', 'testplan']);

  for (const child of Array.from(container.children)) {
    const tagLower = child.tagName.toLowerCase();
    if (!ignoreTags.has(tagLower) && !tagLower.endsWith('hashtree') && tagLower !== 'hashtree') {
      results.push(child);
    }
  }

  return results;
}

function convertChild(el: Element): TestBlock | null {
  const tc = getTestClass(el);
  const name = getTestName(el);

  if (['HTTPSamplerProxy', 'HTTPSampler', 'HttpTestSample', 'HTTPSampler2', 'GraphQLHTTPSamplerProxy'].includes(tc)) {
    const method = strProp(el, 'HTTPSampler.method') || 'GET';
    const url = buildUrl(el);
    const headers = getHeaders(el);
    const rawBody = strProp(el, 'HTTPSampler.postBodyRaw');
    const body = rawBody && rawBody !== 'true' && rawBody !== 'false' ? rawBody : (strProp(el, 'HTTPSampler.xml_data') || '');
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];

    return toBlock('http-request', {
      label: `${method} ${url}`,
      properties: { method, url, headers, body },
      children,
    });
  }

  if (tc === 'DebugSampler') {
    return toBlock('log', {
      label: name || 'Debug Log',
      properties: { message: `JMeter Debug: ${name}`, level: 'info' },
    });
  }

  if (tc === 'TestAction' || tc === 'FlowControlAction') {
    const target = strProp(el, 'ActionProcessor.target');
    const duration = target === '0' ? '0' : '1';
    return toBlock('sleep', {
      label: name || 'Think Time',
      properties: { duration },
    });
  }

  if (tc === 'JSR223Sampler' || tc === 'BeanShellSampler') {
    const script = strProp(el, 'JSR223.script') || strProp(el, 'BeanShellSampler.script') || '';
    return toBlock('script', {
      label: name || 'Custom Script',
      properties: { code: script || '// Custom Sampler Script' },
    });
  }

  if (tc === 'DummySampler') {
    return toBlock('dummy-sampler', {
      label: name || 'Dummy Sampler',
      properties: {
        statusCode: intProp(el, 'DummySampler.responseCode') || 200,
        responseBody: strProp(el, 'DummySampler.data') || '{"status":"ok"}',
        responseTime: intProp(el, 'DummySampler.responseTime') || 0,
        latency: intProp(el, 'DummySampler.latency') || 0,
        responseMessage: strProp(el, 'DummySampler.responseMessage') || 'OK',
        responseHeaders: [],
      },
    });
  }

  if (tc === 'JDBCSampler') {
    return toBlock('sql-query', {
      label: name || 'JDBC Request',
      properties: {
        connectionId: strProp(el, 'JDBCSampler.dataSource') || '',
        query: strProp(el, 'JDBCSampler.query') || '',
        params: '',
        tag: '',
      },
    });
  }

  if (tc.endsWith('ThreadGroup') || tc === 'ThreadGroup' || tc === 'VirtualUserGroup' || tc.endsWith('UserGroup')) {
    const numThreads = intProp(el, 'ThreadGroup.num_threads', 1) || intProp(el, 'VirtualUserGroup.num_threads', 1) || intProp(el, 'ThreadGroup.threads_initial_delay', 10) || intProp(el, 'TargetLevel', 1) || 1;
    const rampTime = intProp(el, 'ThreadGroup.ramp_time', 0) || intProp(el, 'VirtualUserGroup.ramp_time', 0) || intProp(el, 'ThreadGroup.rampUp', 0) || intProp(el, 'RampUp', 0) || 0;
    const durationProp = intProp(el, 'ThreadGroup.duration', 0) || intProp(el, 'VirtualUserGroup.duration', 0) || intProp(el, 'ThreadGroup.flighttime', 0) || intProp(el, 'Hold', 0) || 0;
    const loopsStr = strProp(el, 'LoopController.loops') || strProp(el, 'ThreadGroup.main_controller.loops') || '';
    const loops = loopsStr && loopsStr !== '-1' ? loopsStr : '';
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    const tgName = name || (tc === 'VirtualUserGroup' ? 'Virtual User Group' : 'Thread Group');

    if (rampTime > 0 || tc.includes('Stepping')) {
      const holdTime = durationProp > 0 ? `${durationProp}s` : '60s';
      return toBlock('stages-scenario', {
        label: tgName,
        properties: {
          stages: [
            { duration: `${rampTime || 10}s`, target: numThreads },
            { duration: holdTime, target: numThreads },
            { duration: '10s', target: 0 },
          ],
          name: `${tgName} (VUs: ${numThreads}, ramp: ${rampTime}s)`,
        },
        children,
      });
    } else {
      const durationStr = durationProp > 0 ? `${durationProp}s` : '30s';
      return toBlock('scenario', {
        label: tgName,
        properties: {
          vus: numThreads,
          duration: durationStr,
          iterations: loops,
          name: `${tgName} (VUs: ${numThreads}, ramp: ${rampTime}s)`,
        },
        children,
      });
    }
  }

  if (tc === 'TransactionController' || ['RecordController', 'GenericController', 'TestFragmentController', 'CriticalSectionController', 'IncludeController', 'ModuleController'].includes(tc)) {
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    const label = name || (tc === 'RecordController' ? 'Recorded Flow' : tc.replace(/Controller$/, ' Controller'));
    return toBlock('transaction', {
      label,
      properties: { name: label },
      children,
    });
  }

  if (tc === 'LoopController') {
    const loops = intProp(el, 'LoopController.loops') || 1;
    const forever = strProp(el, 'LoopController.continue_forever') === 'true';
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('loop', {
      label: name || 'Loop',
      properties: { count: forever ? -1 : loops },
      children,
    });
  }

  if (tc === 'WhileController') {
    const condition = strProp(el, 'WhileController.condition') || '';
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('loop', {
      label: name || 'While Loop',
      properties: { count: -1, whileCondition: condition },
      children,
    });
  }

  if (tc === 'IfController') {
    const expression = strProp(el, 'IfController.condition') || '';
    const allChildren = parseChildren(el);
    const mainChildren: TestBlock[] = [];
    const elseChildren: TestBlock[] = [];
    let inElse = false;
    for (const c of allChildren) {
      if (getTestClass(c) === 'ElseController') { inElse = true; continue; }
      const block = convertChild(c);
      if (block) {
        if (inElse) elseChildren.push(block);
        else mainChildren.push(block);
      }
    }
    return toBlock('condition', {
      label: name || 'If Condition',
      properties: { expression, elseEnabled: elseChildren.length > 0 },
      children: mainChildren,
      elseBlocks: elseChildren,
    });
  }

  if (tc === 'InterleaveControl') {
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('interleave', { label: name || 'Interleave', children });
  }

  if (tc === 'RandomController') {
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('random-controller', { label: name || 'Random Controller', children });
  }

  if (tc === 'SwitchController') {
    const selector = strProp(el, 'SwitchController.value') || '0';
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('switch', {
      label: name || 'Switch Controller',
      properties: { selector },
      children,
    });
  }

  if (tc === 'ForeachControl') {
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('for-each', {
      label: name || 'ForEach Controller',
      properties: {
        array: strProp(el, 'ForeachControl.inputVal') || '',
        itemVar: strProp(el, 'ForeachControl.varName') || 'item',
        indexVar: 'index',
      },
      children,
    });
  }

  if (tc === 'OnceOnlyController') {
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('once-only', { label: name || 'Once Only', children });
  }

  if (tc === 'RuntimeController') {
    const duration = intProp(el, 'RuntimeController.duration') || 5000;
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('runtime', {
      label: name || 'Runtime Controller',
      properties: { durationMs: duration },
      children,
    });
  }

  if (tc === 'SynchronizingTimer') {
    const vuCount = intProp(el, 'SynchronizingTimer.numUsers') || 5;
    const timeout = intProp(el, 'SynchronizingTimer.timeoutInMs') || 30000;
    return toBlock('synchronizing-timer', {
      label: name || 'Sync Timer',
      properties: { vuCount, timeout },
    });
  }

  if (tc === 'ThroughputController') {
    const percent = intProp(el, 'ThroughputController.percent') || 50;
    const maxExec = intProp(el, 'ThroughputController.maxThroughput') || 0;
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('throughput', {
      label: name || 'Throughput Controller',
      properties: { mode: percent > 0 ? 'percent' : 'total', percent, totalExecutions: maxExec },
      children,
    });
  }

  if (tc === 'ResponseAssertion' || tc === 'Assertion') {
    const testField = intProp(el, 'Assertion.test_field');
    const testStrings = strProp(el, 'Assertion.test_strings') || '200';
    let target = 'status';
    if (testField === 1) target = 'body-contains';
    else if (testField === 2) target = 'body-regex';
    else if (testField === 3) target = 'header';
    return toBlock('check', {
      label: name || 'Response Assertion',
      properties: { target, operator: '==', expected: testStrings, label: name || '' },
    });
  }

  if (tc === 'JSONPathAssertion') {
    const jsonPath = strProp(el, 'JSON_PATH') || strProp(el, 'JSONAssertion.jsonPath') || '';
    const expected = strProp(el, 'JSONAssertion.expectedValue') || '';
    return toBlock('json-assertion', {
      label: name || 'JSON Assertion',
      properties: { jsonPath, expected, operator: '==', severity: 'error' },
    });
  }

  if (['RegexExtractor', 'XPathExtractor', 'BoundaryExtractor', 'CSSExtractor', 'JQueryExtractor', 'JSONPostProcessor'].includes(tc)) {
    const varName = strProp(el, 'RegexExtractor.refname') || strProp(el, 'XPathExtractor.refname') || strProp(el, 'BoundaryExtractor.refname') || strProp(el, 'CSSExtractor.refname') || strProp(el, 'JSONPostProcessor.referenceNames') || 'extracted';
    const extMap: Record<string, string> = {
      RegexExtractor: 'regex', XPathExtractor: 'xpath',
      BoundaryExtractor: 'boundary', CSSExtractor: 'css', JQueryExtractor: 'css',
      JSONPostProcessor: 'jsonpath',
    };
    let expression = '';
    let leftB = '';
    let rightB = '';
    if (tc === 'RegexExtractor') expression = strProp(el, 'RegexExtractor.regex') || '';
    else if (tc === 'XPathExtractor') expression = strProp(el, 'XPathExtractor.xpathQuery') || '';
    else if (tc === 'BoundaryExtractor') { leftB = strProp(el, 'BoundaryExtractor.lboundary') || ''; rightB = strProp(el, 'BoundaryExtractor.rboundary') || ''; }
    else if (tc === 'JSONPostProcessor') expression = strProp(el, 'JSONPostProcessor.jsonPathExprs') || '';
    else expression = strProp(el, 'CSSExtractor.cssQuery') || strProp(el, 'JQueryExtractor.cssQuery') || '';
    return toBlock('extract-variable', {
      label: name || 'Extract Variable',
      properties: { variableName: varName.split(';')[0]?.trim() || varName, extractType: extMap[tc] || 'regex', expression, leftBoundary: leftB, rightBoundary: rightB, default: '' },
    });
  }

  if (tc === 'HeaderManager') {
    const headers: { key: string; value: string }[] = [];
    for (const h of parseChildren(el)) {
      if (getTestClass(h) === 'Header') {
        const k = strProp(h, 'Header.name');
        const v = strProp(h, 'Header.value');
        if (k) headers.push({ key: k, value: v });
      }
    }
    return toBlock('header-manager', {
      label: name || 'Header Manager',
      properties: { headers: headers.length > 0 ? headers : [{ key: '', value: '' }] },
    });
  }

  if (tc === 'CookieManager') {
    const cookies: { key: string; value: string; path: string }[] = [];
    for (const c of parseChildren(el)) {
      if (getTestClass(c) === 'Cookie') {
        const k = strProp(c, 'Cookie.name');
        const v = strProp(c, 'Cookie.value');
        if (k) cookies.push({ key: k, value: v, path: strProp(c, 'Cookie.path') || '/' });
      }
    }
    return toBlock('cookie-manager', {
      label: name || 'Cookie Manager',
      properties: { domain: '', cookies: cookies.length > 0 ? cookies : [{ key: '', value: '', path: '/' }] },
    });
  }

  if (tc === 'CacheManager') {
    return toBlock('cache-manager', { label: name || 'Cache Manager', properties: { mode: 'default' } });
  }

  if (tc === 'AuthManager') {
    return toBlock('auth-manager', {
      label: name || 'Authorization',
      properties: { authType: 'basic', username: strProp(el, 'AuthManager.username') || '', password: strProp(el, 'AuthManager.password') || '' },
    });
  }

  if (tc === 'ConfigTestElement' || el.getAttribute('guiclass') === 'HttpDefaultsGui') {
    const protocol = strProp(el, 'HTTPSampler.protocol') || 'https';
    const domain = strProp(el, 'HTTPSampler.domain') || 'localhost';
    const port = strProp(el, 'HTTPSampler.port');
    const path = strProp(el, 'HTTPSampler.path') || '';
    const baseUrl = `${protocol}://${domain}${port && port !== '80' && port !== '443' ? `:${port}` : ''}${path}`;
    return toBlock('http-defaults', {
      label: name || 'HTTP Request Defaults',
      properties: { baseUrl, defaultTimeout: '', defaultHeaders: [], defaultParams: '' },
    });
  }

  if (['WebSocketRequestResponseSampler', 'WebSocketOpenSampler'].includes(tc)) {
    const url = strProp(el, 'WebSocketSampler.server') || strProp(el, 'WebSocketOpenSampler.connectURL') || '';
    const timeout = intProp(el, 'WebSocketSampler.timeout') || 30000;
    return toBlock('websocket', {
      label: name || 'WebSocket',
      properties: { url, protocols: '', timeout: String(timeout), autoReconnect: false, messagesOnOpen: '[]', closeAfterMessages: false, closeAfterCount: 1 },
    });
  }

  if (tc === 'CSVDataSetConfig' || tc === 'CSVDataSet') {
    const filePath = strProp(el, 'CSVDataSet.filename') || '';
    const varNames = strProp(el, 'CSVDataSet.variableNames') || 'data';
    const delim = strProp(el, 'CSVDataSet.delimiter') || ',';
    return toBlock('data-file', {
      label: name || 'CSV Data',
      properties: {
        fileId: filePath,
        variableName: varNames.split(',')[0]?.trim() || 'data',
        format: delim === '\t' ? 'tsv' : 'csv',
      },
    });
  }

  if (['ConstantTimer', 'UniformRandomTimer', 'GaussianRandomTimer'].includes(tc)) {
    const delay = intProp(el, 'ConstantTimer.delay') || intProp(el, 'UniformRandomTimer.delay') || intProp(el, 'GaussianRandomTimer.delay') || 1000;
    if (tc === 'ConstantTimer') {
      return toBlock('sleep', {
        label: name || 'Timer',
        properties: { duration: String(Math.max(1, Math.round(delay / 1000))) },
      });
    }
    const range = intProp(el, 'UniformRandomTimer.range') || 1000;
    const minS = `${Math.round(delay / 1000)}s`;
    const maxS = `${Math.round((delay + range) / 1000)}s`;
    return toBlock('wait', {
      label: name || (tc === 'UniformRandomTimer' ? 'Random Timer' : 'Gaussian Timer'),
      properties: { type: tc === 'GaussianRandomTimer' ? 'gaussian' : 'uniform', duration: minS, min: minS, max: maxS },
    });
  }

  if (tc === 'ConstantThroughputTimer') {
    const tp = parseFloat(strProp(el, 'ConstantThroughputTimer.throughput') || '0');
    return toBlock('throughput', {
      label: name || 'Throughput Timer',
      properties: { mode: 'percent', percent: 100, totalExecutions: Math.max(1, Math.round(tp)) },
    });
  }

  if (tc === 'PreProcessor' || tc === 'JSR223PreProcessor' || tc === 'BeanShellPreProcessor') {
    return toBlock('pre-processor', {
      label: name || 'Pre Processor',
      properties: { code: strProp(el, 'JSR223.script') || strProp(el, 'BeanShellPreProcessor.script') || '// Pre-processor' },
    });
  }

  if (tc === 'PostProcessor' || tc === 'JSR223PostProcessor' || tc === 'BeanShellPostProcessor') {
    return toBlock('post-processor', {
      label: name || 'Post Processor',
      properties: { code: strProp(el, 'JSR223.script') || strProp(el, 'BeanShellPostProcessor.script') || '// Post-processor' },
    });
  }

  if (tc === 'UniformRandomVariable' || tc === 'RandomVariableConfig') {
    return toBlock('random-var', {
      label: name || 'Random Variable',
      properties: { varName: strProp(el, 'RandomVariableConfig.variableName') || 'randomVal', type: 'integer', min: intProp(el, 'RandomVariableConfig.minimumValue') || 0, max: intProp(el, 'RandomVariableConfig.maximumValue') || 100 },
    });
  }

  if (tc === 'CounterConfig' || tc === 'Counter') {
    return toBlock('counter', {
      label: name || 'Counter',
      properties: { varName: strProp(el, 'CounterConfig.name') || strProp(el, 'CounterConfig.variableName') || 'counter', start: intProp(el, 'CounterConfig.start') || 0, increment: intProp(el, 'CounterConfig.incr') || intProp(el, 'CounterConfig.inc') || 1 },
    });
  }

  if (tc === 'UserDefinedVariables' || tc === 'Arguments') {
    return toBlock('set-variable', {
      label: name || 'Set Variable',
      properties: { varName: 'var', value: '', expression: 'string' },
    });
  }

  // Check enterprise elements (ISO 8583 banking sockets, JMS messaging, and script assertions)
  const enterpriseBlock = convertEnterpriseElement(el, tc, name, parseChildren, convertChild, strProp, intProp, toBlock);
  if (enterpriseBlock) return enterpriseBlock;

  if (tc.endsWith('Sampler') || ['JavaSampler', 'TCPSampler', 'SMTPSampler', 'LDAPSampler', 'FTPSampler', 'SystemSampler', 'JUnitSampler'].includes(tc)) {
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];
    return toBlock('script', {
      label: name || tc,
      properties: { code: `// Sampler: ${name || tc} (${tc})` },
      children,
    });
  }

  return null;
}

function simplify(blocks: TestBlock[]): TestBlock[] {
  return blocks.filter(b => {
    if (b.children) b.children = simplify(b.children);
    return !(b.type === 'group' && b.children.length === 0);
  });
}

export function parseJmx(jmxContent: string): TestBlock[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(jmxContent, 'text/xml');
    const root = doc.documentElement;
    if (!root) return [];
    if (doc.querySelector('parsererror')) return [];

    const testPlans = Array.from(doc.querySelectorAll('*')).filter(el => {
      const tc = getTestClass(el);
      return tc === 'TestPlan';
    });

    const blocks: TestBlock[] = [];

    if (testPlans.length > 0) {
      for (const tp of testPlans) {
        blocks.push(...parseChildren(tp).map(convertChild).filter(Boolean) as TestBlock[]);
      }
    } else {
      // Fallback: Check root wrappers (<jmeterTestPlan> or <ScriptWrapper>) for direct <hashTree> children
      const rootTestPlans = Array.from(doc.querySelectorAll('*')).filter(el => {
        const tc = getTestClass(el);
        return el.tagName.endsWith('TestPlan') || tc === 'jmeterTestPlan' || el.tagName.includes('ScriptWrapper');
      });

      if (rootTestPlans.length > 0) {
        for (const rtp of rootTestPlans) {
          const topHashTree = rtp.querySelector(':scope > hashTree') || rtp.getElementsByTagName('hashTree')[0];
          if (topHashTree && (topHashTree.parentElement === rtp || topHashTree.parentElement?.parentElement === rtp)) {
            for (const el of Array.from(topHashTree.children)) {
              if (el.tagName.toLowerCase().endsWith('hashtree') || el.tagName === 'hashTree') continue;
              const block = convertChild(el);
              if (block) blocks.push(block);
            }
          }
        }
      } else {
        const threadGroups = Array.from(doc.querySelectorAll('*')).filter(el => {
          const tc = getTestClass(el);
          return tc.endsWith('ThreadGroup') || tc === 'ThreadGroup' || tc === 'VirtualUserGroup' || tc.endsWith('UserGroup');
        });
        for (const tg of threadGroups) {
          const block = convertChild(tg);
          if (block) blocks.push(block);
        }
      }
    }

    return simplify(blocks);
  } catch {
    return [];
  }
}

export function jmeterToScript(blocks: TestBlock[]): string {
  return `// Imported from JMeter (.jmx) - ${blocks.length} block(s)
// Review before running: URLs, auth, data file paths, assertions
`;
}
