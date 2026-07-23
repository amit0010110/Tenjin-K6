import type { BlockTypeDefinition, BlockType } from '../types';

export const scenarios: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'scenario': {
    type: 'scenario',
    label: 'Scenario',
    icon: 'Users',
    description: 'Basic scenario with virtual users, duration, and optional iterations',
    color: 'blue',
    canHaveChildren: true,
    rootOnly: true,
    defaultProperties: { vus: 1, duration: '30s', iterations: '' },
    fields: [
      { key: 'vus', label: 'Virtual Users', type: 'number', placeholder: '1', defaultValue: 1 },
      { key: 'duration', label: 'Duration', type: 'string', placeholder: '30s', defaultValue: '30s' },
      { key: 'iterations', label: 'Iterations (optional)', type: 'string', placeholder: 'Leave empty for duration-based', defaultValue: '' },
    ],
  },
  'stages-scenario': {
    type: 'stages-scenario',
    label: 'Stages Scenario',
    icon: 'TrendingUp',
    description: 'Scenario with a ramping load profile using multiple stages',
    color: 'indigo',
    canHaveChildren: true,
    rootOnly: true,
    defaultProperties: { stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 10 }, { duration: '30s', target: 0 }] },
    fields: [
      { key: 'stages', label: 'Stages', type: 'stages', placeholder: 'Add stage...' },
    ],
  },
  'arrivals-scenario': {
    type: 'arrivals-scenario',
    label: 'Arrival Rate Scenario',
    icon: 'Zap',
    description: 'Scenario with an arrival-rate executor (constant or ramping)',
    color: 'violet',
    canHaveChildren: true,
    rootOnly: true,
    defaultProperties: { executor: 'constant-arrival-rate', startRate: 10, timeUnit: '1s', preAllocatedVUs: 5, maxVUs: 20, stages: [] },
    fields: [
      { key: 'executor', label: 'Executor', type: 'select', options: [
        { label: 'Constant Arrival Rate', value: 'constant-arrival-rate' },
        { label: 'Ramping Arrival Rate', value: 'ramping-arrival-rate' },
      ]},
      { key: 'startRate', label: 'Start Rate (iterations/s)', type: 'number', placeholder: '10', defaultValue: 10 },
      { key: 'timeUnit', label: 'Time Unit', type: 'string', placeholder: '1s', defaultValue: '1s' },
      { key: 'preAllocatedVUs', label: 'Pre-allocated VUs', type: 'number', placeholder: '5', defaultValue: 5 },
      { key: 'maxVUs', label: 'Max VUs', type: 'number', placeholder: '20', defaultValue: 20 },
      { key: 'stages', label: 'Ramping Stages', type: 'stages', placeholder: 'Add stage...' },
    ],
  },
};
