import { TestBlock, createBlock } from './types';

interface CurlParseResult {
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  cookies: { key: string; value: string }[];
}

export function parseCurl(curlCommand: string): CurlParseResult | null {
  try {
    let cmd = curlCommand.trim();
    if (!cmd.toLowerCase().startsWith('curl ')) return null;

    const result: CurlParseResult = {
      method: 'GET',
      url: '',
      headers: [],
      body: '',
      cookies: [],
    };

    cmd = cmd.replace(/\\\n/g, ' ').replace(/\s+/g, ' ');

    const urlMatch = cmd.match(/(?:^curl\s+)(?:-[^\s]+\s+)*['"]?((?:https?:\/\/|localhost)[^\s'"]+)['"]?/);
    if (urlMatch) result.url = urlMatch[1];

    const dataMatches = cmd.matchAll(/--data(?:-raw)?\s+['"]([^'"]*)['"]/g);
    for (const m of dataMatches) {
      result.body = m[1];
      if (result.method === 'GET') result.method = 'POST';
    }

    const headerMatches = cmd.matchAll(/-H\s+['"]([^'"]+)['"]/g);
    for (const m of headerMatches) {
      const parts = m[1].split(/:\s*/);
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(': ').trim();
        result.headers.push({ key, value });
        if (key.toLowerCase() === 'content-type' && value.toLowerCase().includes('application/json') && result.body) {
          try { JSON.parse(result.body); } catch { /* not json */ }
        }
        if (key.toLowerCase() === 'cookie') {
          value.split(';').forEach(c => {
            const [k, ...v] = c.trim().split('=');
            if (k) result.cookies.push({ key: k.trim(), value: v.join('=').trim() });
          });
        }
      }
    }

    const methodMatch = cmd.match(/-X\s+(\w+)/);
    if (methodMatch) result.method = methodMatch[1].toUpperCase();

    return result;
  } catch {
    return null;
  }
}

export function curlToBlocks(curlCommand: string): TestBlock[] {
  const parsed = parseCurl(curlCommand);
  if (!parsed) return [];

  const blocks: TestBlock[] = [];
  const children: TestBlock[] = [];

  if (parsed.cookies.length > 0) {
    parsed.cookies.forEach(c =>
      children.push(createBlock('extract-variable', {
        label: `Extract cookie: ${c.key}`,
        properties: { variableName: `cookie_${c.key}`, extractType: 'cookie', expression: c.key },
      }))
    );
  }

  children.push(createBlock('check', {
    label: `Verify ${parsed.method} response`,
    properties: { target: 'status', operator: '==', expected: '200', label: '' },
  }));

  const httpBlock = createBlock('http-request', {
    label: `${parsed.method} ${parsed.url}`,
    properties: {
      method: parsed.method,
      url: parsed.url,
      headers: parsed.headers,
      body: parsed.body,
    },
  });
  httpBlock.children = children;
  blocks.push(httpBlock);

  return blocks;
}
