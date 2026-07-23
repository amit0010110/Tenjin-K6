import { TestBlock } from '../types';

export function genGroup(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  return `${pad}group("${p.name || 'group'}", function () {\n${childCode}\n${pad}});`;
}

function cleanJMeterExpr(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'true';
  let expr = raw.trim();

  // 1. Check for JMeterThread.last_sample_ok == false / 'false' / "false"
  if (/^\$\{\s*JMeterThread\.last_sample_ok\s*\}\s*===\?\s*(false|['"]false['"])$/i.test(expr) || /^!\s*\$\{\s*JMeterThread\.last_sample_ok\s*\}$/i.test(expr)) {
    return "(typeof res !== 'undefined' ? (res.status >= 400 || res.status === 0) : false)";
  }

  // 2. Check for JMeterThread.last_sample_ok == true or just ${JMeterThread.last_sample_ok}
  if (/^\$\{\s*JMeterThread\.last_sample_ok\s*\}\s*===\?\s*(true|['"]true['"])$/i.test(expr) || /^\$\{\s*JMeterThread\.last_sample_ok\s*\}$/i.test(expr)) {
    return "(typeof res !== 'undefined' ? (res.status >= 200 && res.status < 400) : true)";
  }

  // 3. Replace any other ${VAR_NAME} with k6 variable lookup
  expr = expr.replace(/\$\{\s*([a-zA-Z0-9_.-]+)\s*\}/g, (_, varName) => {
    const cleanVar = varName.replace(/[^a-zA-Z0-9_]/g, '_');
    return `(typeof ${cleanVar} !== 'undefined' ? ${cleanVar} : __ENV.${cleanVar})`;
  });

  return expr;
}

export function genLoop(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  if (p.whileCondition) {
    const cond = cleanJMeterExpr(String(p.whileCondition));
    return `${pad}let iter = 0;\n${pad}while (${cond}) {\n${childCode}\n${pad}  iter++;\n${pad}}`;
  }
  return `${pad}for (let iter = 0; iter < ${p.count || 1}; iter++) {\n${childCode}\n${pad}}`;
}

export function genCondition(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  const cond = cleanJMeterExpr(String(p.expression || 'true'));
  let result = `${pad}if (${cond}) {\n${childCode}`;
  if (p.elseEnabled && block.elseBlocks) {
    const elseCode = block.elseBlocks.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
    if (elseCode) result += `\n${pad}} else {\n${elseCode}`;
  }
  result += `\n${pad}}`;
  return result;
}

export function genTransaction(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const name = p.name || 'transaction';
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  return `${pad}if (typeof transDuration === 'undefined') {\n${pad}  const transDuration = new Trend('${name}_duration');\n${pad}}\n${pad}const transStart = Date.now();\n${childCode}\n${pad}transDuration.add(Date.now() - transStart);`;
}

export function genThroughput(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  if (p.mode === 'total') {
    return `${pad}if (__ITER < ${parseInt(p.totalExecutions) || 10}) {\n${childCode}\n${pad}}`;
  }
  return `${pad}if (Math.random() * 100 < ${parseInt(p.percent) || 50}) {\n${childCode}\n${pad}}`;
}

export function genInterleave(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const children = block.children.filter(c => c.enabled);
  if (children.length === 0) return '';
  const idx = `__ITER % ${children.length}`;
  const cases = children.map((c, i) => {
    const code = genBlock(c, indent + 2, ctx);
    return `${pad}  case ${i}:\n${code}\n${pad}    break;`;
  }).join('\n');
  return `${pad}switch (${idx}) {\n${cases}\n${pad}}`;
}

export function genRandomController(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const children = block.children.filter(c => c.enabled);
  if (children.length === 0) return '';
  const idx = `Math.floor(Math.random() * ${children.length})`;
  const cases = children.map((c, i) => {
    const code = genBlock(c, indent + 2, ctx);
    return `${pad}  case ${i}:\n${code}\n${pad}    break;`;
  }).join('\n');
  return `${pad}switch (${idx}) {\n${cases}\n${pad}}`;
}

export function genSwitch(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const children = block.children.filter(c => c.enabled);
  if (children.length === 0) return '';
  const cases = children.map((c, i) => {
    const code = genBlock(c, indent + 2, ctx);
    return `${pad}  case ${i}:\n${code}\n${pad}    break;`;
  }).join('\n');
  return `${pad}switch (${p.selector || 0}) {\n${cases}\n${pad}}`;
}

export function genForEach(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  const itemVar = p.itemVar || 'item';
  const indexVar = p.indexVar || 'index';
  return `${pad}(${p.array || '[]'}).forEach((${itemVar}, ${indexVar}) => {\n${childCode}\n${pad}});`;
}

export function genOnceOnly(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  return `${pad}if (__ITER === 0) {\n${childCode}\n${pad}}`;
}

export function genRuntime(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const durationMs = parseInt(p.durationMs) || 5000;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  return `${pad}{\n${pad}  const runtimeEnd = Date.now() + ${durationMs};\n${pad}  while (Date.now() < runtimeEnd) {\n${childCode}\n${pad}    sleep(0.1);\n${pad}  }\n${pad}}`;
}

export function genSynchronizingTimer(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const vc = parseInt(p.vuCount) || 5;
  const to = parseInt(p.timeout) || 30000;
  const childCode = block.children.filter(c => c.enabled).map(c => genBlock(c, indent + 1, ctx)).join('\n');
  let result = `${pad}// Synchronizing Timer: wait for ${vc} VUs (max ${to}ms timeout)\n${pad}// k6 does not have cross-VU synchronization; using staggered sleep\n${pad}if (__VU % ${vc} === 1) { sleep(${Math.min(1, to / 1000)}); }`;
  if (childCode) result += `\n${childCode}`;
  return result;
}
