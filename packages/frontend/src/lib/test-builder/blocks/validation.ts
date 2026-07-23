import type { BlockTypeDefinition, BlockType } from '../types';

export const validation: Partial<Record<BlockType, BlockTypeDefinition>> = {
  check: {
    type: 'check',
    label: 'Check',
    icon: 'CheckSquare',
    description: 'Check a response value against an expected result',
    color: 'green',
    canHaveChildren: false,
    defaultProperties: { target: 'status', operator: '==', expected: '200', label: '' },
    fields: [
      { key: 'label', label: 'Check Label', type: 'string', placeholder: 'e.g. status is 200 (auto if empty)' },
      { key: 'target', label: 'Target', type: 'select', options: [
        { label: 'HTTP Status', value: 'status' },
        { label: 'Response Time (ms)', value: 'timing' },
        { label: 'Body contains', value: 'body-contains' },
        { label: 'Body matches regex', value: 'body-regex' },
        { label: 'Header equals', value: 'header' },
      ]},
      { key: 'operator', label: 'Operator', type: 'select', options: [
        { label: '==', value: '==' }, { label: '!=', value: '!=' },
        { label: '<', value: '<' }, { label: '<=', value: '<=' },
        { label: '>', value: '>' }, { label: '>=', value: '>=' },
      ]},
      { key: 'expected', label: 'Expected Value', type: 'string', placeholder: '200', required: true },
    ],
  },
  assertion: {
    type: 'assertion',
    label: 'Assertion',
    icon: 'ShieldCheck',
    description: 'Assert a condition on the response (status, body, headers, timing)',
    color: 'red',
    canHaveChildren: false,
    defaultProperties: { target: 'status', operator: '==', expected: '200', severity: 'error' },
    fields: [
      { key: 'target', label: 'Target', type: 'select', options: [
        { label: 'HTTP Status', value: 'status' },
        { label: 'Response Time (ms)', value: 'timing' },
        { label: 'Body contains', value: 'body-contains' },
        { label: 'Body matches regex', value: 'body-regex' },
        { label: 'Header equals', value: 'header' },
      ]},
      { key: 'operator', label: 'Operator', type: 'select', options: [
        { label: '==', value: '==' }, { label: '!=', value: '!=' },
        { label: '<', value: '<' }, { label: '<=', value: '<=' },
        { label: '>', value: '>' }, { label: '>=', value: '>=' },
      ]},
      { key: 'expected', label: 'Expected Value', type: 'string', placeholder: '200', required: true },
      { key: 'severity', label: 'Severity', type: 'select', options: [
        { label: 'Error (fails test)', value: 'error' },
        { label: 'Warning (logs only)', value: 'warn' },
      ]},
    ],
  },
  'json-assertion': {
    type: 'json-assertion',
    label: 'JSON Assertion',
    icon: 'Braces',
    description: 'Assert a JSONPath expression evaluates to an expected value',
    color: 'rose',
    canHaveChildren: false,
    defaultProperties: { jsonPath: '', expected: '', operator: '==', severity: 'error' },
    fields: [
      { key: 'jsonPath', label: 'JSONPath', type: 'string', placeholder: '$.data.user.id', required: true },
      { key: 'expected', label: 'Expected Value', type: 'string', placeholder: 'e.g. 200 or "active"', required: true },
      { key: 'operator', label: 'Operator', type: 'select', options: [
        { label: '==', value: '==' }, { label: '!=', value: '!=' },
        { label: 'contains', value: 'contains' }, { label: 'exists', value: 'exists' },
      ]},
      { key: 'severity', label: 'Severity', type: 'select', options: [
        { label: 'Error (fails test)', value: 'error' },
        { label: 'Warning (logs only)', value: 'warn' },
      ]},
    ],
  },
  'extract-variable': {
    type: 'extract-variable',
    label: 'Extract Variable',
    icon: 'Variable',
    description: 'Extract a value from the last response (JSONPath, regex, header)',
    color: 'teal',
    canHaveChildren: false,
    defaultProperties: { source: 'body', expression: '', variableName: '', extractType: 'jsonpath' },
    fields: [
      { key: 'variableName', label: 'Variable Name', type: 'string', placeholder: 'e.g. userId', required: true },
      { key: 'extractType', label: 'Extract From', type: 'select', options: [
        { label: 'JSONPath (body)', value: 'jsonpath' },
        { label: 'Regex (body)', value: 'regex' },
        { label: 'XPath (body)', value: 'xpath' },
        { label: 'CSS Selector (body)', value: 'css' },
        { label: 'Boundary (body)', value: 'boundary' },
        { label: 'Response Header', value: 'header' },
        { label: 'Cookie', value: 'cookie' },
      ]},
      { key: 'expression', label: 'Expression', type: 'string', placeholder: '$.data.user.id', required: true },
      { key: 'leftBoundary', label: 'Left Boundary', type: 'string', placeholder: '<input value="' },
      { key: 'rightBoundary', label: 'Right Boundary', type: 'string', placeholder: '">' },
      { key: 'default', label: 'Default Value', type: 'string', placeholder: 'Default if not found' },
    ],
  },
};
