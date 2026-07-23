import type { BlockTypeDefinition, BlockType } from '../types';

export const timing: Partial<Record<BlockType, BlockTypeDefinition>> = {
  sleep: {
    type: 'sleep',
    label: 'Sleep / Think Time',
    icon: 'Clock',
    description: 'Pause VU execution for a specified duration',
    color: 'gray',
    canHaveChildren: false,
    defaultProperties: { duration: '1' },
    fields: [
      { key: 'duration', label: 'Duration', type: 'string', placeholder: 'e.g. 1, 0.5, 2s', required: true },
    ],
  },
  wait: {
    type: 'wait',
    label: 'Wait / Timer',
    icon: 'Timer',
    description: 'Wait for a condition or fixed duration',
    color: 'slate',
    canHaveChildren: false,
    defaultProperties: { type: 'fixed', duration: '1s', min: '1s', max: '3s' },
    fields: [
      { key: 'type', label: 'Timer Type', type: 'select', options: [
        { label: 'Fixed', value: 'fixed' }, { label: 'Random Uniform', value: 'uniform' },
        { label: 'Gaussian', value: 'gaussian' },
      ]},
      { key: 'duration', label: 'Duration', type: 'string', placeholder: '1s' },
      { key: 'min', label: 'Min Duration', type: 'string', placeholder: '1s' },
      { key: 'max', label: 'Max Duration', type: 'string', placeholder: '3s' },
    ],
  },
};
