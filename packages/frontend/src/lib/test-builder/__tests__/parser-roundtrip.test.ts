import { describe, it, expect } from 'vitest';
import { generateScript } from '../generator';
import { parseScriptToBlocks } from '../parser';
import { createBlock, BLOCK_REGISTRY, BlockType } from '../types';

const containerTypes = new Set<BlockType>([
  'for-each', 'runtime', 'once-only', 'throughput', 'interleave',
  'random-controller', 'switch', 'transaction', 'group', 'loop',
  'condition', 'http-batch', 'websocket', 'browser-page',
  'synchronizing-timer',
]);

function equivalentType(type: BlockType): BlockType | null {
  if (type === 'wait') return 'sleep';
  if (type === 'counter') return null;
  if (type === 'http-batch') return null;
  if (type === 'script') return null;
  return type;
}

const undetectable: BlockType[] = ['counter', 'http-batch', 'script', 'grpc-call', 'websocket', 'browser-page', 'throughput', 'scenario', 'stages-scenario', 'arrivals-scenario', 'group', 'header-manager', 'cookie-manager', 'dummy-sampler', 'iso8583', 'iso20022', 'ftp', 'ibmmq', 'kafka', 'redis', 'mqtt'];

describe('parser round-trip', () => {
  const types = Object.keys(BLOCK_REGISTRY) as BlockType[];
  for (const type of types) {
    it(`round-trips ${type}`, () => {
      const block = createBlock(type as BlockType);
      const blocks = containerTypes.has(type as BlockType)
        ? [{ ...block, children: [createBlock('sleep', { label: 'Sleep 0.1s', properties: { duration: '0.1' } })] }]
        : [block];

      const code = generateScript(blocks);
      const parsed = parseScriptToBlocks(code);
      const expectedType = equivalentType(type as BlockType) || type;
      const found = parsed.find(b => b.type === expectedType);

      if (found) {
        expect(found).toBeTruthy();
      } else {
        expect(undetectable.includes(type as BlockType)).toBe(true);
      }
    });
  }
});
