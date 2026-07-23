export type BlockType =
  | 'http-request'
  | 'http-batch'
  | 'grpc-call'
  | 'websocket'
  | 'browser-page'
  | 'sql-query'
  | 'check'
  | 'group'
  | 'sleep'
  | 'wait'
  | 'loop'
  | 'condition'
  | 'custom-metric'
  | 'extract-variable'
  | 'assertion'
  | 'json-assertion'
  | 'data-file'
  | 'log'
  | 'script'
  | 'transaction'
  | 'throughput'
  | 'interleave'
  | 'random-controller'
  | 'switch'
  | 'for-each'
  | 'once-only'
  | 'runtime'
  | 'set-variable'
  | 'counter'
  | 'random-var'
  | 'header-manager'
  | 'cookie-manager'
  | 'cache-manager'
  | 'synchronizing-timer'
  | 'pre-processor'
  | 'post-processor'
  | 'dummy-sampler'
  | 'scenario'
  | 'stages-scenario'
  | 'arrivals-scenario'
  | 'auth-manager'
  | 'http-defaults'
  | 'iso8583'
  | 'iso20022'
  | 'ftp'
  | 'ibmmq'
  | 'kafka'
  | 'redis'
  | 'mqtt';

export interface TestBlock {
  id: string;
  type: BlockType;
  label: string;
  children: TestBlock[];
  properties: Record<string, unknown>;
  enabled: boolean;
  elseBlocks?: TestBlock[];
}

export interface BlockField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'code' | 'headers' | 'json' | 'env-var' | 'stages' | 'data-file';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: unknown;
  showIf?: { key: string; value: unknown };
}

export interface BlockTypeDefinition {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  color: string;
  canHaveChildren: boolean;
  rootOnly?: boolean;
  defaultProperties: Record<string, unknown>;
  fields: BlockField[];
}

export const SAMPLER_TYPES = new Set([
  'http-request', 'http-batch', 'grpc-call', 'websocket',
  'browser-page', 'sql-query', 'dummy-sampler',
  'iso8583', 'iso20022', 'ftp', 'ibmmq', 'kafka', 'redis', 'mqtt',
]);

export const POST_PROCESSOR_TYPES = new Set([
  'check', 'assertion', 'json-assertion', 'extract-variable',
  'post-processor', 'log', 'script', 'sleep', 'wait',
]);

import { BLOCK_REGISTRY } from './blocks/registry';

export { BLOCK_REGISTRY };

export function createBlock(type: BlockType, overrides?: Partial<TestBlock>): TestBlock {
  const def = BLOCK_REGISTRY[type];
  return {
    id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    type,
    label: overrides?.label ?? def.label,
    children: overrides?.children ?? [],
    properties: { ...def.defaultProperties, ...(overrides?.properties ?? {}) },
    enabled: overrides?.enabled ?? true,
    elseBlocks: overrides?.elseBlocks ?? [],
  };
}

export const DEFAULT_TEMPLATE_BLOCKS: TestBlock[] = [
  createBlock('group', { label: 'Main Flow', properties: { name: 'Main Flow' }, children: [
    createBlock('http-request', { label: 'GET /api/health', properties: { method: 'GET', url: '${__ENV.TARGET_URL}/api/health' } }),
    createBlock('check', { label: 'Health Check', properties: { target: 'status', operator: '==', expected: '200', label: 'status is 200' } }),
    createBlock('sleep', { label: 'Think Time', properties: { duration: '1' } }),
  ]}),
];

export interface BlockError {
  field: string;
  message: string;
}

export function validateBlock(block: TestBlock): BlockError[] {
  const def = BLOCK_REGISTRY[block.type];
  if (!def) return [];
  const p = block.properties as Record<string, any>;
  const errors: BlockError[] = [];

  for (const field of def.fields) {
    if (field.type === 'headers') continue;
    const val = p[field.key];
    if (field.required && (val === undefined || val === null || val === '')) {
      errors.push({ field: field.key, message: `${field.label} is required` });
    }
  }

  // Type-specific validations
  switch (block.type) {
    case 'http-request':
      if (!p.url) errors.push({ field: 'url', message: 'URL is required' });
      break;
    case 'check': {
      const checks = p.checks || [];
      if (checks.length === 0) errors.push({ field: 'checks', message: 'At least one check is required' });
      break;
    }
    case 'sleep':
      if (!p.duration || Number(p.duration) <= 0) errors.push({ field: 'duration', message: 'Duration must be > 0' });
      break;
    case 'loop':
      if (!p.count || Number(p.count) <= 0) errors.push({ field: 'count', message: 'Count must be > 0' });
      break;
    case 'json-assertion':
      if (!p.jsonPath) errors.push({ field: 'jsonPath', message: 'JSON path is required' });
      break;
    case 'extract-variable':
      if (!p.variableName) errors.push({ field: 'variableName', message: 'Variable name is required' });
      if (!p.expression) errors.push({ field: 'expression', message: 'Extraction expression is required' });
      break;
    case 'set-variable':
      if (!p.variableName) errors.push({ field: 'variableName', message: 'Variable name is required' });
      break;
    case 'http-batch':
      if (!p.url && !p.requests) errors.push({ field: 'url', message: 'URL or requests list is required' });
      break;
    case 'grpc-call':
      if (!p.url) errors.push({ field: 'url', message: 'gRPC endpoint is required' });
      break;
    case 'websocket':
      if (!p.url) errors.push({ field: 'url', message: 'WebSocket URL is required' });
      break;
    case 'sql-query':
      if (!p.query) errors.push({ field: 'query', message: 'SQL query is required' });
      break;
    case 'condition':
      if (!p.expression) errors.push({ field: 'expression', message: 'Condition expression is required' });
      break;
    case 'for-each':
      if (!p.collection && !p.array) errors.push({ field: 'collection', message: 'Array/collection is required' });
      break;
    case 'data-file':
      if (!p.fileId) errors.push({ field: 'fileId', message: 'File is required' });
      break;
    case 'counter':
      if (!p.name) errors.push({ field: 'name', message: 'Counter name is required' });
      break;
    case 'random-var':
      if (!p.variableName) errors.push({ field: 'variableName', message: 'Variable name is required' });
      break;
    case 'browser-page':
      if (!p.url) errors.push({ field: 'url', message: 'Page URL is required' });
      break;
    case 'transaction':
      if (!p.name) errors.push({ field: 'name', message: 'Transaction name is required' });
      break;
    case 'auth-manager':
      if (p.authType === 'bearer' && !p.token) errors.push({ field: 'token', message: 'Token is required' });
      if (p.authType === 'basic' && !p.username) errors.push({ field: 'username', message: 'Username is required' });
      if (p.authType === 'api-key' && !p.keyValue) errors.push({ field: 'keyValue', message: 'API key is required' });
      if (p.authType === 'oauth2' && !p.tokenUrl) errors.push({ field: 'tokenUrl', message: 'Token URL is required' });
      break;
    case 'iso8583':
      if (!p.endpoint) errors.push({ field: 'endpoint', message: 'Endpoint URL is required' });
      break;
    case 'iso20022':
      if (!p.endpoint) errors.push({ field: 'endpoint', message: 'Endpoint URL is required' });
      if (!p.xmlBody) errors.push({ field: 'xmlBody', message: 'XML body is required' });
      break;
    case 'ftp':
      if (!p.host) errors.push({ field: 'host', message: 'FTP Host is required' });
      if (!p.remotePath) errors.push({ field: 'remotePath', message: 'Remote Path is required' });
      break;
    case 'ibmmq':
      if (!p.queueName) errors.push({ field: 'queueName', message: 'Queue/Topic name is required' });
      if (!p.qMgrName) errors.push({ field: 'qMgrName', message: 'Queue Manager name is required' });
      break;
  }

  // Check children recursively
  for (const child of block.children) {
    errors.push(...validateBlock(child));
  }

  return errors;
}
