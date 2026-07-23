import { describe, it, expect } from 'vitest';
import { K6Runner } from '../k6Runner.js';

// Access private buildArgs via prototype
const runner = new K6Runner();
const buildArgs = (runner as any).buildArgs.bind(runner);

describe('K6Runner.buildArgs', () => {
  it('always includes --out json and run command', () => {
    const args = buildArgs('/tmp/test.js', {});
    expect(args[0]).toBe('run');
    expect(args[1]).toBe('/tmp/test.js');
    expect(args).toContain('--out');
    expect(args[args.indexOf('--out') + 1]).toBe('json');
  });

  it('adds --vus and --duration', () => {
    const args = buildArgs('/tmp/test.js', { vus: 10, duration: '30s' });
    expect(args).toContain('--vus');
    expect(args[args.indexOf('--vus') + 1]).toBe('10');
    expect(args).toContain('--duration');
    expect(args[args.indexOf('--duration') + 1]).toBe('30s');
  });

  it('adds --iterations when provided', () => {
    const args = buildArgs('/tmp/test.js', { iterations: 100 });
    expect(args).toContain('--iterations');
    expect(args[args.indexOf('--iterations') + 1]).toBe('100');
  });

  it('adds stages', () => {
    const args = buildArgs('/tmp/test.js', {
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 20 },
      ],
    });
    const stageIdx = args.indexOf('--stage');
    expect(stageIdx).toBeGreaterThanOrEqual(0);
    expect(args[stageIdx + 1]).toBe('30s:10');
    expect(args[stageIdx + 2]).toBe('--stage');
    expect(args[stageIdx + 3]).toBe('1m:20');
  });

  it('adds --env K6_BROWSER_ENABLED=true when browser is true', () => {
    const args = buildArgs('/tmp/test.js', { browser: true });
    const envIdx = args.indexOf('--env');
    expect(envIdx).toBeGreaterThanOrEqual(0);
    expect(args[envIdx + 1]).toBe('K6_BROWSER_ENABLED=true');
  });

  it('adds --out cloud when outputs include cloud enabled', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [{ type: 'cloud', enabled: true, config: {} }],
    });
    expect(args).toContain('--out');
    const outIdx = args.lastIndexOf('--out');
    expect(args[outIdx + 1]).toBe('cloud');
  });

  it('adds Prometheus flag from outputs array', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [{
        type: 'prometheus',
        enabled: true,
        config: { url: 'https://prom.example.com/api/v1/write' },
      }],
    });
    expect(args).toContain('--out');
    // The last --out should be for prometheus
    const typedArgs: string[] = args;
    const outIndices: number[] = [];
    typedArgs.forEach((a: string, i: number) => { if (a === '--out') outIndices.push(i); });
    const lastOut = outIndices[outIndices.length - 1];
    expect(args[lastOut + 1]).toBe('output-prometheus-remote=https://prom.example.com/api/v1/write');
  });

  it('adds --out influxdb for influxdb output', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [{
        type: 'influxdb',
        enabled: true,
        config: { url: 'http://localhost:8086/k6db' },
      }],
    });
    expect(args).toContain('influxdb=http://localhost:8086/k6db');
  });

  it('adds --out datadog for datadog output', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [{ type: 'datadog', enabled: true, config: { apiKey: 'xxx', site: 'datadoghq.com' } }],
    });
    expect(args).toContain('--out');
    const outIdx = args.lastIndexOf('--out');
    expect(args[outIdx + 1]).toBe('datadog');
  });

  it('skips disabled outputs', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [
        { type: 'cloud', enabled: false, config: {} },
        { type: 'prometheus', enabled: true, config: { url: 'http://example.com' } },
      ],
    });
    // Should NOT contain cloud (disabled)
    // Should contain prometheus (enabled)
    const cloudIdx = args.indexOf('cloud');
    const promIdx = args.indexOf('output-prometheus-remote=http://example.com');
    expect(cloudIdx).toBe(-1);
    expect(promIdx).toBeGreaterThanOrEqual(0);
  });

  it('handles backward compat prometheusPushUrl', () => {
    const args = buildArgs('/tmp/test.js', { prometheusPushUrl: 'http://legacy.example.com' });
    const outIdx = args.lastIndexOf('--out');
    expect(args[outIdx + 1]).toBe('output-prometheus-remote=http://legacy.example.com');
  });

  it('handles backward compat cloud flag', () => {
    const args = buildArgs('/tmp/test.js', { cloud: true });
    const outIdx = args.lastIndexOf('--out');
    expect(args[outIdx + 1]).toBe('cloud');
  });

  it('adds run_id tag', () => {
    const args = buildArgs('/tmp/my-run-id.js', {});
    const tagIdx = args.indexOf('--tag');
    expect(tagIdx).toBeGreaterThanOrEqual(0);
    expect(args[tagIdx + 1]).toBe('run_id=my-run-id');
  });

  it('handles multiple outputs simultaneously', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [
        { type: 'cloud', enabled: true, config: {} },
        { type: 'influxdb', enabled: true, config: { url: 'http://localhost:8086/k6' } },
        { type: 'csv', enabled: true, config: { path: '/tmp/results.csv' } },
      ],
    });
    expect(args).toContain('cloud');
    expect(args).toContain('influxdb=http://localhost:8086/k6');
    expect(args).toContain('csv=/tmp/results.csv');
  });

  it('handles empty outputs array', () => {
    const args = buildArgs('/tmp/test.js', { outputs: [] });
    // Should still work without error
    expect(args[0]).toBe('run');
  });

  it('handles unknown output type gracefully', () => {
    const args = buildArgs('/tmp/test.js', {
      outputs: [{ type: 'nonexistent', enabled: true, config: {} }],
    });
    // Should not crash, just skip unknown type
    expect(args[0]).toBe('run');
  });
});
