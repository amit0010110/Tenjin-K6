import type { BlockTypeDefinition, BlockType } from '../types';

export const browser: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'browser-page': {
    type: 'browser-page',
    label: 'Browser Page',
    icon: 'Monitor',
    description: 'Open a browser page and interact with elements (k6/browser)',
    color: 'emerald',
    canHaveChildren: true,
    defaultProperties: { url: '', viewport: '1920x1080', actions: [] },
    fields: [
      { key: 'url', label: 'URL', type: 'string', placeholder: 'https://example.com', required: true },
      { key: 'viewport', label: 'Viewport', type: 'string', placeholder: '1920x1080' },
    ],
  },
};
