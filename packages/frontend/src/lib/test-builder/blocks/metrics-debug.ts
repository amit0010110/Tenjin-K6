import type { BlockTypeDefinition, BlockType } from '../types';

export const metricsDebug: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'custom-metric': {
    type: 'custom-metric',
    label: 'Custom Metric',
    icon: 'BarChart3',
    description: 'Add a custom k6 metric (Counter, Gauge, Rate, Trend)',
    color: 'violet',
    canHaveChildren: false,
    defaultProperties: { metricType: 'Trend', name: '', value: '' },
    fields: [
      { key: 'metricType', label: 'Metric Type', type: 'select', options: [
        { label: 'Counter', value: 'Counter' }, { label: 'Gauge', value: 'Gauge' },
        { label: 'Rate', value: 'Rate' }, { label: 'Trend', value: 'Trend' },
      ]},
      { key: 'name', label: 'Metric Name', type: 'string', placeholder: 'my_custom_metric', required: true },
      { key: 'value', label: 'Value Expression', type: 'code', placeholder: 'response.timings.duration' },
    ],
  },
  log: {
    type: 'log',
    label: 'Log / Debug',
    icon: 'Terminal',
    description: 'Log a message or variable value during test execution',
    color: 'stone',
    canHaveChildren: false,
    defaultProperties: { message: '', level: 'info' },
    fields: [
      { key: 'message', label: 'Message', type: 'code', placeholder: 'e.g. Response time: ${response.timings.duration}ms', required: true },
      { key: 'level', label: 'Level', type: 'select', options: [
        { label: 'Info', value: 'info' }, { label: 'Warn', value: 'warn' },
        { label: 'Error', value: 'error' },
      ]},
    ],
  },
  script: {
    type: 'script',
    label: 'Custom Script',
    icon: 'FileCode',
    description: 'Write arbitrary JavaScript/k6 code',
    color: 'zinc',
    canHaveChildren: false,
    defaultProperties: { code: '' },
    fields: [
      { key: 'code', label: 'JavaScript Code', type: 'code', placeholder: '// Write any k6 JavaScript code here', required: true },
    ],
  },
};
