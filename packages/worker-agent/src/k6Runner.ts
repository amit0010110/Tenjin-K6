import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import fs from 'fs';

interface RunRequest {
  runId: string;
  projectId?: string;
  scriptContent: string;
  options: Record<string, unknown>;
  csvFiles?: { name: string; filename: string; content: string }[];
}

interface RunningTest {
  runId: string;
  process: ChildProcess;
  status: 'running' | 'completed' | 'failed' | 'aborted';
}

export class K6Runner extends EventEmitter {
  private workDir: string;
  private active: Map<string, RunningTest> = new Map();
  private requestLogs: Map<string, any[]> = new Map();

  constructor(private k6BinaryPath = process.env.K6_BINARY_PATH || 'k6') {
    super();
    this.workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-agent-'));
  }

  activeCount(): number {
    return this.active.size;
  }

  async start(req: RunRequest): Promise<void> {
    const scriptPath = path.join(this.workDir, `${req.runId}.js`);
    fs.writeFileSync(scriptPath, req.scriptContent, 'utf-8');

    if (req.csvFiles) {
      for (const csv of req.csvFiles) {
        const csvPath = path.join(this.workDir, csv.filename);
        const dir = path.dirname(csvPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(csvPath, csv.content, 'utf-8');
      }
    }

    const args = this.buildArgs(scriptPath, req.options);

    let binaryToUse = this.k6BinaryPath;
    if (req.projectId) {
      const customBinary = path.join(process.cwd(), '.k6-build', `k6-${req.projectId.slice(0, 8)}`);
      if (fs.existsSync(customBinary)) {
        binaryToUse = customBinary;
      }
    }

    const proc = spawn(binaryToUse, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...(req.options.env as Record<string, string>) },
    });

    this.active.set(req.runId, { runId: req.runId, process: proc, status: 'running' });

    const rl = createInterface({ input: proc.stdout! });
    const logs: any[] = [];
    this.requestLogs.set(req.runId, logs);
    rl.on('line', (line: string) => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.__requestLog) {
          const entries = parsed.__requestLog;
          if (Array.isArray(entries)) {
            for (const entry of entries) logs.push(entry);
          }
        } else {
          this.emit('metric', req.runId, parsed);
        }
      } catch {
        // skip non-JSON lines
      }
    });

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
          for (const entry of inner.__requestLog) logs.push(entry);
        }
      } catch { /* skip unparseable console output */ }
    });

    proc.on('exit', (code) => {
      const running = this.active.get(req.runId);
      if (!running) return;
      running.status = code === 0 ? 'completed' : 'failed';

      const cloudMatch = stderr.match(/https:\/\/app\.k6\.io\/runs\/(\d+)/);
      this.emit('done', req.runId, {
        exitCode: code,
        stderr,
        cloudRunUrl: cloudMatch?.[0] || null,
        cloudRunId: cloudMatch?.[1] || null,
        requestLogs: logs,
      });

      rl.close();
      stderrRl.close();
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
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
      setTimeout(() => {
        try { test.process.kill('SIGKILL'); } catch { /* ignore */ }
      }, 5000);
    }
  }

  private buildArgs(scriptPath: string, options: Record<string, unknown>): string[] {
    const args: string[] = ['run', scriptPath, '--out', 'json=-'];

    // When scenarios are defined in the script, --vus/--duration/--iterations/--stage
    // conflict with the scenarios executor and will cause k6 to fail.
    if (options.scenarios) {
      // scenarios are defined inline in the script — no CLI flag overrides needed
    } else {
      if (typeof options.vus === 'number') args.push('--vus', String(options.vus));
      if (typeof options.duration === 'string') args.push('--duration', options.duration);
      if (typeof options.iterations === 'number') args.push('--iterations', String(options.iterations));

      if (Array.isArray(options.stages)) {
        for (const stage of options.stages) {
          args.push('--stage', `${stage.duration}:${stage.target}`);
        }
      }
    }

    if (typeof options.executionSegment === 'string') {
      args.push('--execution-segment', options.executionSegment);
    }
    if (options.prometheusPushUrl) {
      args.push('--out', `output-prometheus-remote=${options.prometheusPushUrl}`);
    }
    if (options.cloud) {
      args.push('--out', 'cloud');
    }
    if (options.browser) {
      args.push('--env', 'K6_BROWSER_ENABLED=true');
    }

    args.push('--tag', `worker_run=${path.basename(scriptPath).replace('.js', '')}`);
    return args;
  }
}
