import type { BlockTypeDefinition, BlockType } from '../types';

export const processors: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'pre-processor': {
    type: 'pre-processor',
    label: 'Pre Processor',
    icon: 'ArrowUp',
    description: 'Run custom JavaScript before the parent request or each child',
    color: 'violet',
    canHaveChildren: false,
    defaultProperties: { code: '' },
    fields: [
      { key: 'code', label: 'JavaScript Code', type: 'code', placeholder: '// Runs before each request', required: true },
    ],
  },
  'post-processor': {
    type: 'post-processor',
    label: 'Post Processor',
    icon: 'ArrowDown',
    description: 'Run custom JavaScript after the parent request or each child',
    color: 'violet',
    canHaveChildren: false,
    defaultProperties: { code: '' },
    fields: [
      { key: 'code', label: 'JavaScript Code', type: 'code', placeholder: '// Runs after each response', required: true },
    ],
  },
};
