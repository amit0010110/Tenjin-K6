import { BlockType, BLOCK_REGISTRY } from '../../lib/test-builder/types';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const INDENT = 20;
export const PADDING_LEFT = 16;

export const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
  indigo: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20',
  purple: 'border-purple-400 bg-purple-50 dark:bg-purple-950/20',
  cyan: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20',
  emerald: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20',
  green: 'border-green-400 bg-green-50 dark:bg-green-950/20',
  amber: 'border-amber-400 bg-amber-50 dark:bg-amber-950/20',
  orange: 'border-orange-400 bg-orange-50 dark:bg-orange-950/20',
  rose: 'border-rose-400 bg-rose-50 dark:bg-rose-950/20',
  violet: 'border-violet-400 bg-violet-50 dark:bg-violet-950/20',
  teal: 'border-teal-400 bg-teal-50 dark:bg-teal-950/20',
  red: 'border-red-400 bg-red-50 dark:bg-red-950/20',
};

export function getIcon(name: string): LucideIcon {
  return (Icons as any)[name] || Icons.Box;
}

export const BLOCK_CATEGORIES: { name: string; types: { type: BlockType; label: string }[] }[] = [
  {
    name: 'Scenarios',
    types: [
      { type: 'scenario', label: 'Scenario' },
      { type: 'stages-scenario', label: 'Stages Scenario' },
      { type: 'arrivals-scenario', label: 'Arrival Rate Scenario' },
    ],
  },
  {
    name: 'Requests',
    types: [
      { type: 'http-request', label: 'HTTP Request' },
      { type: 'http-batch', label: 'HTTP Batch' },
      { type: 'grpc-call', label: 'gRPC Call' },
      { type: 'websocket', label: 'WebSocket' },
      { type: 'sql-query', label: 'SQL Query' },
      { type: 'dummy-sampler', label: 'Dummy Sampler' },
    ],
  },
  {
    name: 'Browser',
    types: [
      { type: 'browser-page', label: 'Browser Page' },
    ],
  },
  {
    name: 'Flow Control',
    types: [
      { type: 'group', label: 'Group' },
      { type: 'loop', label: 'Loop' },
      { type: 'condition', label: 'Conditional' },
      { type: 'transaction', label: 'Transaction' },
      { type: 'for-each', label: 'For Each' },
      { type: 'interleave', label: 'Interleave' },
      { type: 'random-controller', label: 'Random' },
      { type: 'switch', label: 'Switch' },
      { type: 'once-only', label: 'Once Only' },
      { type: 'throughput', label: 'Throughput' },
      { type: 'runtime', label: 'Runtime' },
    ],
  },
  {
    name: 'Timing',
    types: [
      { type: 'sleep', label: 'Sleep / Think Time' },
      { type: 'wait', label: 'Wait / Timer' },
      { type: 'synchronizing-timer', label: 'Sync Timer' },
    ],
  },
  {
    name: 'Variables',
    types: [
      { type: 'extract-variable', label: 'Extract Variable' },
      { type: 'set-variable', label: 'Set Variable' },
      { type: 'counter', label: 'Counter' },
      { type: 'random-var', label: 'Random Variable' },
    ],
  },
  {
    name: 'Assertions',
    types: [
      { type: 'check', label: 'Check' },
      { type: 'assertion', label: 'Assertion' },
      { type: 'json-assertion', label: 'JSON Assertion' },
    ],
  },
  {
    name: 'Data & Headers',
    types: [
      { type: 'data-file', label: 'Data File Reference' },
      { type: 'header-manager', label: 'Header Manager' },
      { type: 'cookie-manager', label: 'Cookie Manager' },
      { type: 'cache-manager', label: 'Cache Manager' },
      { type: 'auth-manager', label: 'Authorization Manager' },
      { type: 'http-defaults', label: 'HTTP Request Defaults' },
    ],
  },
  {
    name: 'Processors',
    types: [
      { type: 'pre-processor', label: 'Pre Processor' },
      { type: 'post-processor', label: 'Post Processor' },
    ],
  },
  {
    name: 'Metrics',
    types: [
      { type: 'custom-metric', label: 'Custom Metric' },
    ],
  },
  {
    name: 'Debug',
    types: [
      { type: 'log', label: 'Log / Debug' },
      { type: 'script', label: 'Custom Script' },
    ],
  },
];
