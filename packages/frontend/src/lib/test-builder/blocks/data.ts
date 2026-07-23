import type { BlockTypeDefinition, BlockType } from '../types';

export const data: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'data-file': {
    type: 'data-file',
    label: 'Data File Reference',
    icon: 'Table',
    description: 'Reference a CSV/JSON data file for data-driven testing (SharedArray)',
    color: 'teal',
    canHaveChildren: false,
    defaultProperties: { fileId: '', variableName: 'data', format: 'csv' },
    fields: [
      { key: 'variableName', label: 'Variable Name', type: 'string', placeholder: 'e.g. testData', required: true, defaultValue: 'data' },
      { key: 'format', label: 'File Format', type: 'select', options: [
        { label: 'CSV', value: 'csv' }, { label: 'JSON', value: 'json' }, { label: 'TSV', value: 'tsv' },
      ]},
      { key: 'fileId', label: 'File', type: 'data-file', required: true },
    ],
  },
  'set-variable': {
    type: 'set-variable',
    label: 'Set Variable',
    icon: 'Variable',
    description: 'Define or update a variable for use in subsequent blocks',
    color: 'sky',
    canHaveChildren: false,
    defaultProperties: { varName: '', value: '', expression: 'string' },
    fields: [
      { key: 'varName', label: 'Variable Name', type: 'string', placeholder: 'userId', required: true },
      { key: 'expression', label: 'Value Type', type: 'select', options: [
        { label: 'String literal', value: 'string' },
        { label: 'Number literal', value: 'number' },
        { label: 'Expression/Function', value: 'expression' },
      ]},
      { key: 'value', label: 'Value', type: 'string', placeholder: 'e.g. 42 or response.status', required: true },
    ],
  },
  counter: {
    type: 'counter',
    label: 'Counter',
    icon: 'Hash',
    description: 'Increment a counter variable each iteration',
    color: 'indigo',
    canHaveChildren: false,
    defaultProperties: { varName: 'counter', start: 0, increment: 1 },
    fields: [
      { key: 'varName', label: 'Variable Name', type: 'string', placeholder: 'counter', required: true },
      { key: 'start', label: 'Start Value', type: 'number', placeholder: '0' },
      { key: 'increment', label: 'Increment By', type: 'number', placeholder: '1' },
    ],
  },
  'random-var': {
    type: 'random-var',
    label: 'Random Variable',
    icon: 'Shuffle',
    description: 'Generate a random value and store it in a variable',
    color: 'fuchsia',
    canHaveChildren: false,
    defaultProperties: { varName: 'randomVal', type: 'integer', min: 0, max: 100 },
    fields: [
      { key: 'varName', label: 'Variable Name', type: 'string', placeholder: 'randomVal', required: true },
      { key: 'type', label: 'Type', type: 'select', options: [
        { label: 'Integer', value: 'integer' },
        { label: 'Float', value: 'float' },
        { label: 'String (UUID)', value: 'uuid' },
        { label: 'Pick from list', value: 'pick' },
      ]},
      { key: 'min', label: 'Min Value', type: 'number', placeholder: '0' },
      { key: 'max', label: 'Max Value', type: 'number', placeholder: '100' },
      { key: 'items', label: 'Items (for pick)', type: 'json', placeholder: '["red","green","blue"]' },
    ],
  },
};
