#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

const CONFIG_PATH = resolve(homedir(), '.t6rc.json');
const API_BASE = process.env.T6_API_URL || 'http://localhost:3001/api/v1';

interface Config {
  token?: string;
  project?: string;
}

function loadConfig(): Config {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveConfig(config: Config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function api(method: string, path: string, body?: any): Promise<any> {
  const config = loadConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${err}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function printRun(run: any) {
  const d = run.finishedAt && run.startedAt
    ? ((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1) + 's'
    : '—';
  console.log(`${run.id.slice(0, 8)}  ${(run.status || '').padEnd(10)}  ${(run.script?.name || '—').padEnd(25)}  ${d}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
t6 — TenjinT6 CLI

Usage:
  t6 login <token>              Save API token
  t6 use <project-id>           Set default project
  t6 run  [--config <id>]       Trigger a test run (uses default project)
  t6 runs list [--limit N]      List recent runs
  t6 runs get <run-id>          Get run details
  t6 runs results <run-id>      Get run results (JSON)
   t6 runs junit <run-id>        Download JUnit XML report
   t6 budget list                List budget rules for project
   t6 budget check <run-id>      Check performance budgets against a run
   t6 config                     Show current config
    `);
    return;
  }

  try {
    switch (command) {
      case 'login': {
        const token = args[1];
        if (!token) throw new Error('Usage: t6 login <token>');
        saveConfig({ ...loadConfig(), token });
        console.log('Token saved to ~/.t6rc.json');
        break;
      }

      case 'use': {
        const projectId = args[1];
        if (!projectId) throw new Error('Usage: t6 use <project-id>');
        saveConfig({ ...loadConfig(), project: projectId });
        console.log(`Default project set to ${projectId}`);
        break;
      }

      case 'config': {
        const config = loadConfig();
        console.log(`API URL:    ${API_BASE}`);
        console.log(`Token:      ${config.token ? config.token.slice(0, 16) + '...' : 'Not set'}`);
        console.log(`Project:    ${config.project || 'Not set'}`);
        break;
      }

      case 'run': {
        const config = loadConfig();
        const pid = config.project;
        if (!pid) throw new Error('No default project. Set one with: t6 use <project-id>');

        const configIdx = args.indexOf('--config');
        const configId = configIdx !== -1 ? args[configIdx + 1] : undefined;

        if (!configId) {
          // List available configs
          console.log('Available configs:\n');
          const configs = await api('GET', `/projects/${pid}/configs`);
          for (const c of configs) {
            console.log(`  ${c.id.slice(0, 8)}  ${c.name}  (script: ${c.scriptId ? c.scriptId.slice(0, 8) : '—'})`);
          }
          console.log('\nRun with: t6 run --config <config-id>');
          return;
        }

        const run = await api('POST', `/configs/${configId}/run`);
        console.log(`Run triggered: ${run.id}`);
        console.log(`View at:       ${API_BASE.replace('/api/v1', '').replace(':3001', ':5173')}/projects/${pid}/runs/${run.id}/live`);
        break;
      }

      case 'runs': {
        const sub = args[1];
        if (sub === 'list') {
          const config = loadConfig();
          const pid = config.project;
          if (!pid) throw new Error('No default project');

          const limitIdx = args.indexOf('--limit');
          const limit = limitIdx !== -1 ? args[limitIdx + 1] : '10';

          const runs = await api('GET', `/projects/${pid}/runs?limit=${limit}`);
          console.log('ID        STATUS      SCRIPT                    DURATION');
          console.log('─'.repeat(60));
          for (const r of (runs.runs || runs)) printRun(r);
        } else if (sub === 'get') {
          const runId = args[2];
          if (!runId) throw new Error('Usage: t6 runs get <run-id>');
          const run = await api('GET', `/runs/${runId}`);
          console.log(JSON.stringify(run, null, 2));
        } else if (sub === 'results') {
          const runId = args[2];
          if (!runId) throw new Error('Usage: t6 runs results <run-id>');
          const results = await api('GET', `/runs/${runId}/results`);
          console.log(JSON.stringify(results, null, 2));
        } else if (sub === 'junit') {
          const runId = args[2];
          if (!runId) throw new Error('Usage: t6 runs junit <run-id>');
          const res = await fetch(`${API_BASE}/runs/${runId}/export/junit`, {
            headers: loadConfig().token ? { Authorization: `Bearer ${loadConfig().token}` } : {},
          });
          if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
          const xml = await res.text();
          const filename = `run-${runId.slice(0, 8)}-junit.xml`;
          writeFileSync(filename, xml);
          console.log(`JUnit report saved to ${filename}`);
        } else {
          console.log('Usage: t6 runs list|get|results|junit');
        }
        break;
      }

      case 'budget': {
        const sub = args[1];
        if (sub === 'list') {
          const config = loadConfig();
          const pid = config.project;
          if (!pid) throw new Error('No default project. Set one with: t6 use <project-id>');
          const result = await api('GET', `/projects/${pid}/budget`);
          const rules = result.rules || [];
          if (rules.length === 0) {
            console.log('No budget rules defined.');
          } else {
            console.log('NAME                  METRIC                 EXPRESSION    SEVERITY  ENABLED');
            console.log('─'.repeat(85));
            for (const r of rules) {
              console.log(`${(r.name || '').padEnd(22).slice(0, 22)} ${(r.metric || '').padEnd(22).slice(0, 22)} ${(r.expression || '').padEnd(13).slice(0, 13)} ${(r.severity || '').padEnd(9)} ${r.enabled ? '✓' : '✗'}`);
            }
          }
        } else if (sub === 'check') {
          const runId = args[2];
          if (!runId) throw new Error('Usage: t6 budget check <run-id>');
          const result = await api('POST', `/runs/${runId}/budget-check`);
          console.log(`\nRun: ${result.runId.slice(0, 8)}  ${result.passed ? 'PASSED' : 'FAILED'}  ${result.timestamp}\n`);
          console.log('RULE                  METRIC                 EXPRESSION    ACTUAL    SEVERITY  RESULT');
          console.log('─'.repeat(95));
          for (const r of result.rules) {
            const passedStr = r.passed ? '✓ PASS' : '✗ FAIL';
            const actualStr = r.actual !== null ? r.actual.toFixed(2) : '—';
            console.log(`${(r.name || '').padEnd(22).slice(0, 22)} ${(r.metric || '').padEnd(22).slice(0, 22)} ${(r.expression || '').padEnd(13).slice(0, 13)} ${actualStr.padEnd(9)} ${(r.severity || '').padEnd(9)} ${passedStr}`);
          }
          if (!result.passed) process.exit(1);
        } else {
          console.log('Usage: t6 budget list|check');
        }
        break;
      }

      default:
        console.log(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
