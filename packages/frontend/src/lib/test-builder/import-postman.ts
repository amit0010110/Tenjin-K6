import { TestBlock, createBlock } from './types';

interface PostmanCollection {
  info: { name?: string; schema?: string };
  item: PostmanItem[];
  auth?: PostmanAuth;
  variable?: { key: string; value: string }[];
}

interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  response?: unknown[];
}

interface PostmanRequest {
  method?: string;
  url?: PostmanUrl | string;
  header?: { key: string; value: string; disabled?: boolean }[];
  body?: {
    mode?: string;
    raw?: string;
    options?: { raw?: { language?: string } };
    urlencoded?: { key: string; value: string }[];
    formdata?: { key: string; value: string; type?: string; src?: string }[];
  };
  auth?: PostmanAuth;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: (string | { type?: string; value?: string })[];
  query?: { key: string; value: string; disabled?: boolean }[];
  variable?: { key: string; value: string }[];
}

interface PostmanAuth {
  type?: string;
  bearer?: { key: string; value: string }[];
  basic?: { key: string; value: string }[];
  apikey?: { key: string; value: string; in?: string }[];
  oauth2?: { key: string; value: string }[];
}

function reconstructUrl(url: PostmanUrl | string | undefined): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;

  const protocol = url.protocol || 'https';
  const host = Array.isArray(url.host) ? url.host.join('.') : '';
  const path = Array.isArray(url.path)
    ? '/' + url.path.map(p => (typeof p === 'object' ? p.value || '' : p)).filter(Boolean).join('/')
    : '';
  const query = Array.isArray(url.query)
    ? '?' + url.query.filter(q => !q.disabled).map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`).join('&')
    : '';
  return `${protocol}://${host}${path}${query}`;
}

function parseAuth(auth: PostmanAuth | undefined): TestBlock | null {
  if (!auth?.type) return null;
  const props: Record<string, unknown> = { authType: auth.type };

  switch (auth.type) {
    case 'bearer': {
      const token = auth.bearer?.find(t => t.key === 'token')?.value || '';
      props.token = token;
      break;
    }
    case 'basic': {
      const username = auth.basic?.find(t => t.key === 'username')?.value || '';
      const password = auth.basic?.find(t => t.key === 'password')?.value || '';
      props.username = username;
      props.password = password;
      break;
    }
    case 'apikey': {
      const key = auth.apikey?.find(t => t.key === 'key')?.value || '';
      const value = auth.apikey?.find(t => t.key === 'value')?.value || '';
      const inp = auth.apikey?.find(t => t.key === 'in')?.value || 'header';
      props.keyName = key;
      props.keyValue = value;
      props.addTo = inp;
      break;
    }
    case 'oauth2': {
      const tokenUrl = auth.oauth2?.find(t => t.key === 'tokenUrl')?.value || '';
      const clientId = auth.oauth2?.find(t => t.key === 'clientId')?.value || '';
      const clientSecret = auth.oauth2?.find(t => t.key === 'clientSecret')?.value || '';
      const scopes = auth.oauth2?.find(t => t.key === 'scopes')?.value || '';
      props.tokenUrl = tokenUrl;
      props.clientId = clientId;
      props.clientSecret = clientSecret;
      props.scopes = scopes;
      props.grantType = 'client_credentials';
      break;
    }
  }

  return createBlock('auth-manager', {
    label: `Auth: ${auth.type}`,
    properties: props,
  });
}

function extractVariables(url: PostmanUrl | string | undefined): string[] {
  if (!url) return [];
  const raw = typeof url === 'string' ? url : url.raw || '';
  const matches = raw.match(/\{\{(\w+)\}\}/g);
  return matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))] : [];
}

function requestToBlocks(
  req: PostmanRequest,
  name: string | undefined,
  collectionAuth?: PostmanAuth,
): TestBlock[] {
  const blocks: TestBlock[] = [];
  const requestAuth = req.auth || collectionAuth;
  const authBlock = requestAuth ? parseAuth(requestAuth) : null;
  if (authBlock) blocks.push(authBlock);

  const method = req.method || 'GET';
  const url = reconstructUrl(req.url);
  const headers = (req.header || [])
    .filter(h => !h.disabled)
    .filter(h => h.key.toLowerCase() !== 'authorization')
    .map(h => ({ key: h.key, value: h.value }));

  let body = '';
  if (req.body) {
    if (req.body.mode === 'raw') {
      body = req.body.raw || '';
    } else if (req.body.mode === 'urlencoded' && req.body.urlencoded) {
      body = req.body.urlencoded.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
    } else if (req.body.mode === 'formdata' && req.body.formdata) {
      const parts: string[] = [];
      for (const fd of req.body.formdata) {
        parts.push(`${encodeURIComponent(fd.key)}=${encodeURIComponent(fd.value)}`);
      }
      body = parts.join('&');
      headers.push({ key: 'Content-Type', value: 'multipart/form-data' });
    }
  }

  const vars = extractVariables(req.url);
  for (const v of vars) {
    blocks.push(createBlock('extract-variable', {
      label: `Var: ${v}`,
      properties: { variableName: v, extractType: 'regex', expression: `\\{\\{${v}\\}\\}` },
    }));
  }

  const httpBlock = createBlock('http-request', {
    label: `${method} ${name || url}`,
    properties: { method, url, headers, body },
  });

  const checkBlock = createBlock('check', {
    label: `Verify ${method}`,
    properties: { target: 'status', operator: '==', expected: '200', label: 'status ok' },
  });

  httpBlock.children = [checkBlock];
  blocks.push(httpBlock);
  return blocks;
}

function walkItems(
  items: PostmanItem[],
  collectionAuth?: PostmanAuth,
): TestBlock[] {
  const blocks: TestBlock[] = [];

  for (const item of items) {
    if (item.item) {
      const folderBlock = createBlock('group', {
        label: item.name || 'Folder',
        properties: { name: item.name || 'Folder' },
      });
      folderBlock.children = walkItems(item.item, collectionAuth);
      blocks.push(folderBlock);
    } else if (item.request) {
      const reqBlocks = requestToBlocks(item.request, item.name, collectionAuth);
      blocks.push(...reqBlocks);
    }
  }

  return blocks;
}

export function postmanToBlocks(postmanContent: string): TestBlock[] {
  try {
    const collection: PostmanCollection = JSON.parse(postmanContent);
    if (!collection.item) return [];

    const blocks = walkItems(collection.item, collection.auth);

    if (blocks.length === 0) return [];

    const groupBlock = createBlock('group', {
      label: collection.info?.name || 'Postman Import',
      properties: { name: collection.info?.name || `Postman Import - ${blocks.length} steps` },
    });
    groupBlock.children = blocks;
    return [groupBlock];
  } catch {
    return [];
  }
}
