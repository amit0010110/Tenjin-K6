import { TestBlock } from '../types';

function collectFields(p: Record<string, any>): Record<string, string> {
  const fields: Record<string, string> = {};
  if (p.pan) fields['2'] = p.pan;
  if (p.processingCode) fields['3'] = p.processingCode;
  if (p.amount) fields['4'] = p.amount;
  if (p.stan) fields['11'] = p.stan;
  if (p.transmissionDate) fields['12'] = p.transmissionDate;
  if (p.transmissionTime) fields['13'] = p.transmissionTime;
  if (p.customFields) {
    let extra: Record<string, string> = {};
    try {
      extra = typeof p.customFields === 'string' ? JSON.parse(p.customFields) : p.customFields;
    } catch { /* ignore */ }
    Object.assign(fields, extra);
  }
  return fields;
}

function genFieldLines(pad: string, fields: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [de, val] of Object.entries(fields)) {
    out.push(`${pad}msg.setField('${de}', '${val}');`);
  }
  return out;
}

export function genIso8583(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const mti = p.mti || '0200';
  const transport = p.transport || 'http-json';
  const fields = collectFields(p);

  if (transport === 'tcp-binary') {
    const host = p.tcpHost || '192.168.1.100';
    const port = p.tcpPort || '5000';
    lines.push(`${pad}var client = new ISO8583.Client({ host: '${host}', port: ${port} });`);
    lines.push(`${pad}var msg = new ISO8583.Message({ mti: '${mti}' });`);
    lines.push(...genFieldLines(pad, fields));
    lines.push(`${pad}var res = client.send(msg);`);
    lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("ISO8583", '${host}:${port}', res.status, JSON.stringify(res.data), '{}', res.timing);`);
  } else {
    const endpoint = p.endpoint || '${__ENV.TARGET_URL}/iso8583';
    const format = p.dataFormat || 'json';

    if (format === 'hex') {
      let hexPayload = mti;
      const bitmap = '20' + '0'.repeat(14);
      hexPayload += bitmap;
      for (const de of ['2', '3', '4', '11', '12', '13'].sort()) {
        const val = fields[de];
        if (val) hexPayload += val;
      }
      lines.push(`${pad}var isoPayload = '${hexPayload}';`);
      lines.push(`${pad}var res = http.post(\`${endpoint}\`, isoPayload, {`);
      lines.push(`${pad}  headers: { 'Content-Type': 'application/octet-stream' },`);
      lines.push(`${pad}});`);
    } else {
      lines.push(`${pad}var isoPayload = JSON.stringify({`);
      lines.push(`${pad}  mti: '${mti}',`);
      lines.push(`${pad}  bitmap: '2000000000000000',`);
      for (const [de, val] of Object.entries(fields)) {
        lines.push(`${pad}  de${de}: '${val}',`);
      }
      lines.push(`${pad}});`);
      lines.push(`${pad}var res = http.post(\`${endpoint}\`, isoPayload, {`);
      lines.push(`${pad}  headers: { 'Content-Type': 'application/json' },`);
      lines.push(`${pad}});`);
    }
    lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("POST", \`${endpoint}\`, res.status, res.body, JSON.stringify(res.headers), res.timings.duration);`);
  }

  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genIso20022(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const endpoint = p.endpoint || '${__ENV.TARGET_URL}/payments';
  const contentType = p.contentType || 'application/xml';
  const xmlBody = p.xmlBody || '';

  const escaped = xmlBody.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${').replace(/\n/g, '\\n');

  lines.push(`${pad}// iso20022`);
  lines.push(`${pad}var xmlBody = \`${escaped}\`;`);
  lines.push(`${pad}var res = http.post(\`${endpoint}\`, xmlBody, {`);
  lines.push(`${pad}  headers: { 'Content-Type': '${contentType}' },`);
  lines.push(`${pad}});`);
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("POST", \`${endpoint}\`, res.status, res.body, JSON.stringify(res.headers), res.timings.duration);`);
  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}
