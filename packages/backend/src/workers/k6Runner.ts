import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { K6OutputLine, OutputConfig, OUTPUT_TYPES } from '@tenjint6/shared';

interface RunRequest {
  runId: string;
  projectId?: string;
  scriptContent: string;
  options: Record<string, unknown>;
  prometheusPushUrl?: string;
  csvFiles?: { name: string; filename: string; content: string }[];
  outputs?: OutputConfig[];
}

interface RunningTest {
  runId: string;
  process: ChildProcess;
  status: 'running' | 'completed' | 'failed' | 'aborted';
}

export class K6Runner extends EventEmitter {
  private k6BinaryPath: string;
  private workDir: string;
  private active: Map<string, RunningTest> = new Map();
  private requestLogs: Map<string, any[]> = new Map();

  constructor(k6BinaryPath = process.env.K6_BINARY_PATH || 'k6') {
    super();
    this.k6BinaryPath = k6BinaryPath;
    this.workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-run-'));
  }

  private getBuildDir(): string {
    const cwd = process.cwd();
    const rootBuild = path.resolve(cwd, '../../.k6-build');
    if (fs.existsSync(rootBuild)) return rootBuild;
    const cwdBuild = path.join(cwd, '.k6-build');
    if (fs.existsSync(cwdBuild)) return cwdBuild;
    if (cwd.includes('/packages/')) {
      return path.resolve(cwd.substring(0, cwd.indexOf('/packages/')), '.k6-build');
    }
    return cwdBuild;
  }

  async start(req: RunRequest): Promise<void> {
    const scriptPath = path.join(this.workDir, `${req.runId}.js`);

    // Write script to temp file
    fs.writeFileSync(scriptPath, req.scriptContent, 'utf-8');

    // Write CSV files to workdir for k6 to read
    if (req.csvFiles) {
      for (const csv of req.csvFiles) {
        const filePath = path.join(this.workDir, csv.filename || csv.name);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, csv.content, 'utf-8');
      }
    }

    // Extract env vars defined in output configurations (like K6_INFLUXDB_TOKEN, K6_DATADOG_API_KEY)
    const outputEnv: Record<string, string> = {};
    const outputs = (req.options.outputs as OutputConfig[]) || [];
    const xk6OutputTypes = new Set(['influxdb-v2', 'elasticsearch', 'kafka', 'timescaledb', 'opentelemetry', 'cloudwatch', 'dynatrace']);
    let hasXk6Extension = false;
    let requiredXk6Type: string | null = null;
    for (const out of outputs) {
      if (!out.enabled) continue;
      if (xk6OutputTypes.has(out.type)) {
        hasXk6Extension = true;
        requiredXk6Type = out.type;
      }
      const info = OUTPUT_TYPES[out.type];
      if (info?.envMap) {
        for (const [key, envVarName] of Object.entries(info.envMap)) {
          if (out.config[key]) {
            outputEnv[envVarName] = out.config[key];
          }
        }
      }
    }

    // Build CLI args from options
    const args = this.buildArgs(scriptPath, req.options);

    let binaryToUse = this.k6BinaryPath;
    const buildDir = this.getBuildDir();
    const projectBinary = req.projectId ? path.join(buildDir, `k6-${req.projectId.slice(0, 8)}`) : null;
    const influxdbBinary = path.join(buildDir, 'k6-influxdb');
    const customBinary = path.join(buildDir, 'k6-custom');
    const typeSpecificBinary = requiredXk6Type ? path.join(buildDir, `k6-${requiredXk6Type}`) : null;

    if (projectBinary && fs.existsSync(projectBinary)) {
      binaryToUse = projectBinary;
    } else if (typeSpecificBinary && fs.existsSync(typeSpecificBinary)) {
      binaryToUse = typeSpecificBinary;
    } else if (fs.existsSync(customBinary)) {
      binaryToUse = customBinary;
    } else if ((hasXk6Extension || fs.existsSync(influxdbBinary)) && fs.existsSync(influxdbBinary)) {
      binaryToUse = influxdbBinary;
    }

    console.log(`[K6Runner] Spawning binary: ${binaryToUse} (exists: ${fs.existsSync(binaryToUse)}) with args:`, args);

    const proc = spawn(binaryToUse, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...outputEnv, ...(req.options.env as Record<string, string>) },
    });

    this.active.set(req.runId, { runId: req.runId, process: proc, status: 'running' });

    // Parse JSON output line-by-line
    const rl = createInterface({ input: proc.stdout! });
    const logs: any[] = [];
    const MAX_REQUEST_LOGS = 10000;
    this.requestLogs.set(req.runId, logs);
    rl.on('line', (line: string) => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.__requestLog) {
          const entries = parsed.__requestLog;
          if (Array.isArray(entries)) {
            for (const entry of entries) {
              if (logs.length < MAX_REQUEST_LOGS) {
                logs.push(entry);
              }
            }
          }
        } else {
          this.emit('metric', req.runId, parsed);
        }
      } catch {
        // skip non-JSON lines (k6 summary text)
      }
    });

    // Parse stderr — console.log() in k6 goes to stderr wrapped in k6 log format
    const stderrRl = createInterface({ input: proc.stderr! });
    let stderr = '';
    stderrRl.on('line', (line: string) => {
      stderr += line + '\n';
      const sourceMatch = line.match(/\bsource=console\b/);
      if (!sourceMatch) return;
      const msgMatch = line.match(/msg="((?:[^"\\]|\\.)*)"/);
      if (!msgMatch) return;
      try {
        const raw = msgMatch[1].replace(/\\(["\\/])/g, '$1');
        const inner = JSON.parse(raw);
        if (inner.__requestLog && Array.isArray(inner.__requestLog)) {
          for (const entry of inner.__requestLog) {
            if (logs.length < MAX_REQUEST_LOGS) {
              logs.push(entry);
            }
          }
        }
      } catch { /* skip unparseable console output */ }
    });

    proc.on('exit', (code) => {
      const running = this.active.get(req.runId);
      if (!running) return;

      running.status = code === 0 ? 'completed' : 'failed';

      // Parse stderr for k6 Cloud run URL
      const cloudMatch = stderr.match(/https:\/\/app\.k6\.io\/runs\/(\d+)/);
      const cloudRunUrl = cloudMatch?.[0] || null;
      const cloudRunId = cloudMatch?.[1] || null;

      this.emit('done', req.runId, { exitCode: code, stderr, cloudRunUrl, cloudRunId, requestLogs: logs });

      // Cleanup temp file
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }

      // Cleanup maps and readline interfaces to prevent memory leaks
      rl.close();
      stderrRl.close();
      this.active.delete(req.runId);
      this.requestLogs.delete(req.runId);
    });

    proc.on('error', (err) => {
      this.emit('error', req.runId, err);
    });
  }

  abortAll(): void {
    for (const [runId] of this.active) {
      this.abort(runId);
    }
  }

  abort(runId: string): void {
    const test = this.active.get(runId);
    if (test && test.status === 'running') {
      test.process.kill('SIGTERM');
      test.status = 'aborted';
      // Force kill after 5s
      setTimeout(() => {
        try { test.process.kill('SIGKILL'); } catch { /* ignore */ }
      }, 5000);
    }
  }

  private buildArgs(scriptPath: string, options: Record<string, unknown>): string[] {
    const args: string[] = ['run', scriptPath];

    // Output JSON to stdout for streaming
    args.push('--out', 'json=-');

    // Process explicit outputs array (from OutputsManager)
    const outputs = (options.outputs as OutputConfig[]) || [];
    for (const out of outputs) {
      if (!out.enabled) continue;
      const info = OUTPUT_TYPES[out.type];
      if (!info) continue;
      const flag = info.flag(out.config);
      if (flag) args.push(...flag.split(' '));
    }

    // Execution segment for distributed k6 partitioning
    if (typeof options.executionSegment === 'string') {
      args.push('--execution-segment', options.executionSegment);
    }

    // Backward compat: standalone prometheus URL
    if (options.prometheusPushUrl) {
      const pwUrl = options.prometheusPushUrl as string;
      if (pwUrl) args.push('--out', `output-prometheus-remote=${pwUrl}`);
    }

    // Backward compat: standalone cloud flag
    if (options.cloud) {
      args.push('--out', 'cloud');
    }

    // Browser module
    if (options.browser) {
      args.push('--env', 'K6_BROWSER_ENABLED=true');
    }

    // When scenarios are defined in the script, --vus/--duration/--iterations/--stage
    // conflict with the scenarios executor and will cause k6 to fail.
    let hasInlineScenarios = !!options.scenarios;
    try { if (fs.existsSync(scriptPath) && fs.readFileSync(scriptPath, 'utf-8').includes('scenarios:')) hasInlineScenarios = true; } catch {}
    if (hasInlineScenarios) {
      // scenarios are defined in the script — ignore load profile and scenario CLI overrides
    } else if (Array.isArray(options.stages) && options.stages.length > 0) {
      // stages define the load over time — do not pass conflicting --duration/--iterations
      for (const stage of options.stages) {
        args.push('--stage', `${stage.duration}:${stage.target}`);
      }
    } else {
      if (typeof options.vus === 'number') args.push('--vus', String(options.vus));
      if (typeof options.duration === 'string') args.push('--duration', options.duration);
      if (typeof options.iterations === 'number') args.push('--iterations', String(options.iterations));
    }

    // Tags for identification
    args.push('--tag', `run_id=${path.basename(scriptPath).replace('.js', '')}`);

    return args;
  }
}
