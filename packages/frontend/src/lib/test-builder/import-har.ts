import { TestBlock, createBlock } from './types';

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: { name: string; value: string }[];
    postData?: { text: string; mimeType?: string };
  };
  response: {
    status: number;
  };
}

export function parseHar(harContent: string): HarEntry[] {
  try {
    const har = JSON.parse(harContent);
    if (har.log?.entries) return har.log.entries;
    return [];
  } catch {
    return [];
  }
}

export function harToBlocks(harContent: string): TestBlock[] {
  const entries = parseHar(harContent);
  if (entries.length === 0) return [];

  const groupBlock = createBlock('group', {
    label: `HAR Import (${entries.length} requests)`,
    properties: { name: `HAR Import - ${entries.length} requests` },
  });

  for (const entry of entries) {
    const headers = entry.request.headers
      .filter(h => !['cookie', 'authorization'].includes(h.name.toLowerCase()))
      .map(h => ({ key: h.name, value: h.value }));

    const body = entry.request.postData?.text || '';

    const httpBlock = createBlock('http-request', {
      label: `${entry.request.method} ${entry.request.url}`,
      properties: {
        method: entry.request.method,
        url: entry.request.url,
        headers,
        body,
        tag: new URL(entry.request.url).pathname,
      },
    });

    const checkBlock = createBlock('check', {
      label: `Verify ${entry.request.method}`,
      properties: { target: 'status', operator: '==', expected: String(entry.response.status), label: 'status ok' },
    });

    groupBlock.children.push(httpBlock, checkBlock);
  }

  return [groupBlock];
}
