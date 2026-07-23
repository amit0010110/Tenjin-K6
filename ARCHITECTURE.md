# TenjinT6 — Performance Testing Platform Architecture

## Overview

A web-based performance testing platform that uses **k6 binary** as the execution engine. Users define tests, manage scripts, configure thresholds/scenarios, trigger runs, and visualize results — all through a UI.

---

# HIGH-LEVEL DESIGN (HLD)

## 1. System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PERFORMANCE TESTING PLATFORM                     │
│                                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
 │  │  Browser  │◄──►│  Frontend    │◄──►│  Backend API │◄──►│  k6 CLI   │  │
 │  │  (User)   │    │  (React/TS)  │    │  (Node.js/TS)│    │  (Binary) │  │
│  └──────────┘    └──────────────┘    └──────┬───────┘    └───────────┘  │
│                                             │                           │
│                                             ▼                           │
│                                      ┌──────────────┐                  │
│                                      │  Database     │                  │
│                                      │  (PostgreSQL) │                  │
│                                      └──────────────┘                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Supporting Services                                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  MinIO    │  │  Redis   │  │  RabbitMQ │  │  Grafana/Prome   │  │  │
│  │  │ (Scripts) │  │ (Queue)  │  │  (Jobs)   │  │  (Monitoring)   │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| k6 Engine | **k6 binary** (via CLI subprocess) | Mature, Go-based, JS-scripted, low overhead, rich API |
| Test Script Format | **JavaScript (ES modules)** | Native k6 format, supports all k6 APIs |
| Result Storage | **k6 JSON output → PostgreSQL** | Structured, queryable, enables historical analysis |
| Job Execution | **Async via RabbitMQ** | Decouples UI from test execution, supports queues |
| Script Storage | **MinIO (S3-compatible)** | Version-controlled script artifacts |
| Caching | **Redis** | Session cache, active test state, rate limiting |
| Monitoring | **Prometheus + Grafana** | Real-time metrics visualization (optional add-on) |
| Frontend | **React + TypeScript + Vite** | Modern, fast, type-safe |
| Backend | **Node.js + TypeScript + Fastify** | Shared JS/TS ecosystem with frontend, async I/O, npm packages for kafka/rabbit/redis |

## 3. System Components

### 3.1 Frontend (UI Layer)
- **React SPA** with TypeScript
- **Monaco Editor** for k6 script authoring
- **Visual Block Editor** — drag-drop block tree with 43 block types across 9 categories (Requests, Flow Control, Validation, Scenarios, Timing, Data, Browser, Metrics & Debug, Processors)
- **Block Registry** — each block type has typed fields, default properties, validation rules, and a code generator
- **Code Generator** — converts block tree → k6 JavaScript (scenarios, groups, requests, checks, assertions, etc.)
- **Parser** — round-trips k6 JavaScript back to block tree for editing
- Real-time test progress via **SSE** or **WebSocket**
- Dashboard with charts (Chart.js / Recharts)
- Script library, test history, threshold configuration

### 3.2 Backend (API Layer)
- **REST API** (Fastify / Express.js) with TypeScript
- **WebSocket** (`ws` / `socket.io`) for real-time test streaming
- **Job Manager** — creates, queues (Bull/RabbitMQ), and monitors test execution
- **Script Manager** — CRUD for test scripts, versioning
- **Result Aggregator** — parses k6 JSON output line-by-line, stores in DB
- **Threshold Evaluator** — evaluates pass/fail criteria from aggregated metrics
- **Scheduler** — `node-cron` or Bull repeatable jobs for recurring runs

### 3.3 Execution Layer (k6 Worker)
- Manages k6 binary subprocess
- Streams stdout/stderr to backend
- Handles graceful shutdown / abort
- Resource isolation (cgroups/containers in multi-tenant)

### 3.4 Data Layer
- **PostgreSQL**: Users, projects, scripts, test runs, results, thresholds
- **MinIO**: Script files, data files, test artifacts
- **Redis**: Active test sessions, job queues, rate limits

## 4. Data Flow

```
User saves script ──► Backend stores in MinIO + DB
User triggers test ──► Backend creates TestRun ──► Job enqueued to RabbitMQ
Worker picks job ──► Downloads script from MinIO ──► Executes k6 with JSON output
k6 streams results ──► Worker parses JSON lines ──► Backend inserts to DB
User views dashboard ──► Backend queries results ──► Frontend renders charts
```

---

# LOW-LEVEL DESIGN — BACKEND (LLD)

## 1. Database Schema (PostgreSQL)

```sql
-- Users & Teams
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(50) DEFAULT 'user',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    user_id     UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Scripts
CREATE TABLE scripts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    content     TEXT NOT NULL,                    -- JS script body
    file_path   VARCHAR(500),                     -- MinIO path
    env_vars    JSONB DEFAULT '{}',               -- environment variables
    tags        JSONB DEFAULT '{}',               -- k6 tags
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Test Configurations
CREATE TABLE test_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id       UUID REFERENCES scripts(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Options (stored as JSON for flexibility)
    options         JSONB NOT NULL DEFAULT '{}',
    -- e.g.
    -- {
    --   "vus": 10,
    --   "duration": "30s",
    --   "iterations": 100,
    --   "scenarios": { ... },
    --   "thresholds": { "http_req_duration": ["p(95)<500"] },
    --   "stages": [{"duration": "10s", "target": 10}]
    -- }
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Test Runs
CREATE TABLE test_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_config_id  UUID REFERENCES test_configs(id) ON DELETE SET NULL,
    script_id       UUID REFERENCES scripts(id),
    project_id      UUID REFERENCES projects(id),
    user_id         UUID REFERENCES users(id),
    status          VARCHAR(20) DEFAULT 'pending',
                    -- pending | running | completed | failed | aborted
    status_message  TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    k6_exit_code    INTEGER,
    trigger_type    VARCHAR(20) DEFAULT 'manual',
                    -- manual | scheduled | ci
    options_snapshot JSONB,  -- frozen options at time of execution
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated Results (populated after test completes)
CREATE TABLE test_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id     UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    metric_name     VARCHAR(255) NOT NULL,   -- e.g. http_req_duration
    metric_type     VARCHAR(50),             -- counter | gauge | rate | trend
    avg             DOUBLE PRECISION,
    min             DOUBLE PRECISION,
    max             DOUBLE PRECISION,
    med             DOUBLE PRECISION,
    p90             DOUBLE PRECISION,
    p95             DOUBLE PRECISION,
    p99             DOUBLE PRECISION,
    count           BIGINT,
    rate            DOUBLE PRECISION,
    value           DOUBLE PRECISION,
    tags            JSONB DEFAULT '{}'
);

-- Time-series results (raw data points during test)
CREATE TABLE test_result_points (
    id              BIGSERIAL,
    test_run_id     UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ NOT NULL,
    metric_name     VARCHAR(255) NOT NULL,
    metric_value    DOUBLE PRECISION NOT NULL,
    tags            JSONB DEFAULT '{}'
);
-- Partition by test_run_id for query performance

-- Threshold Evaluations
CREATE TABLE threshold_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id     UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    metric_name     VARCHAR(255) NOT NULL,
    threshold_expr  VARCHAR(500) NOT NULL,  -- e.g. "p(95)<500"
    passed          BOOLEAN NOT NULL,
    actual_value    DOUBLE PRECISION,
    aborted         BOOLEAN DEFAULT FALSE
);

-- Scheduled Runs
CREATE TABLE schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_config_id  UUID REFERENCES test_configs(id) ON DELETE CASCADE,
    cron_expr       VARCHAR(100) NOT NULL,   -- e.g. "0 */6 * * *"
    enabled         BOOLEAN DEFAULT TRUE,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE environments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    base_url    VARCHAR(500),
    variables   JSONB DEFAULT '{}',
    is_default  BOOLEAN DEFAULT FALSE
);
```

## 2. API Endpoints (REST)

### Scripts
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/projects/{pid}/scripts` | List scripts |
| `POST` | `/api/v1/projects/{pid}/scripts` | Create script |
| `GET` | `/api/v1/scripts/{id}` | Get script with content |
| `PUT` | `/api/v1/scripts/{id}` | Update script (auto-increment version) |
| `DELETE` | `/api/v1/scripts/{id}` | Delete script |
| `GET` | `/api/v1/scripts/{id}/versions` | List version history |

### Test Configurations
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/scripts/{sid}/configs` | List configs for script |
| `POST` | `/api/v1/scripts/{sid}/configs` | Create config |
| `PUT` | `/api/v1/configs/{id}` | Update config |
| `DELETE` | `/api/v1/configs/{id}` | Delete config |

### Test Runs
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/configs/{id}/run` | Trigger test run |
| `GET` | `/api/v1/runs` | List runs (filterable by project/status) |
| `GET` | `/api/v1/runs/{id}` | Get run details |
| `POST` | `/api/v1/runs/{id}/abort` | Abort running test |
| `GET` | `/api/v1/runs/{id}/results` | Get aggregated results |
| `GET` | `/api/v1/runs/{id}/stream` | WebSocket — real-time metric stream |
| `GET` | `/api/v1/runs/{id}/thresholds` | Threshold pass/fail summary |
| `GET` | `/api/v1/runs/{id}/log` | k6 stdout/stderr log |

### Schedules
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/configs/{id}/schedules` | List schedules |
| `POST` | `/api/v1/configs/{id}/schedules` | Create schedule |
| `PUT` | `/api/v1/schedules/{id}` | Update schedule |
| `DELETE` | `/api/v1/schedules/{id}` | Delete schedule |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/projects/{pid}/dashboard/summary` | Summary stats (total tests, pass rate, etc.) |
| `GET` | `/api/v1/projects/{pid}/dashboard/trend` | Metric trends over time |

## 3. Backend Service Architecture (Node.js + TypeScript)

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Fastify)                        │
│  (Rate Limiting, Auth, Request Validation, CORS, OpenAPI)       │
└──────────┬──────────────────────────────────────────┬───────────┘
           │                                          │
┌──────────▼──────────┐              ┌────────────────▼──────────────┐
│   HTTP Router        │              │   WebSocket Hub              │
│   (Fastify/Express)  │              │   (ws / socket.io)            │
└──────────┬──────────┘              └────────────────┬──────────────┘
           │                                          │
┌──────────▼──────────────────────────────────────────▼──────────────┐
│                        Service Layer                               │
├───────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ ScriptService │  │ ConfigService │  │ RunService              │  │
│  └──────────────┘  └──────────────┘  └───────────┬─────────────┘  │
│                                                   │                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────▼─────────────┐  │
│  │ ResultService │  │ ScheduleSvc  │  │ ThresholdService        │  │
│  │ (node-cron)   │  │ (Bull)      │  │                         │  │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────────────┐
│                      Worker / Job Runner                           │
│  (Can run in same process or scale as separate workers)            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  k6 Runner                                                   │  │
│  │  ┌──────────────────┐    ┌───────────────────────────────┐   │  │
│  │  │  Job Consumer    │───►│  k6 Command Builder           │   │  │
│  │  │  (Bull/RabbitMQ) │    │  (constructs CLI args from    │   │  │
│  │  └──────────────────┘    │   config + options snapshot)  │   │  │
│  │                          └───────────────┬───────────────┘   │  │
│  │                                          ▼                    │  │
│  │  ┌──────────────────────────────────────────────────────┐     │  │
│  │  │  Process Manager (child_process.spawn)                │     │  │
│  │  │  • Spawns k6 binary as subprocess                    │     │  │
│  │  │  • Pipes stdout/stderr via stream pipeline            │     │  │
│  │  │  • Parses JSON output line-by-line (readline):       │     │  │
│  │  │    - Points: {"type":"Point","metric":"http_reqs",..}│     │  │
│  │  │    - Status: {"type":"Status",..}                    │     │  │
│  │  │  • Sends parsed data to Ingester                     │     │  │
│  │  │  • Handles abort (process.kill('SIGTERM'))           │     │  │
│  │  └──────────────────────────────────────────────────────┘     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Result Ingester                                            │  │
│  │  • Batch-inserts result_points via pg (node-postgres)       │  │
│  │  • Broadcasts via WebSocket to connected clients            │  │
│  │  • On test completion: aggregates results, evaluates        │  │
│  │    thresholds, updates test_run status                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 3.1 k6 Command Builder — Example Output

```ts
// Constructs the actual k6 CLI command from user configuration
k6 run /tmp/scripts/test_abc.js \
  --out json=/tmp/results/test_run_123.json \
  --vus 10 \
  --duration 30s \
  --iterations 100 \
  --tag test_run_id=123 \
  --tag project=my-project \
  --env BASE_URL=https://api.example.com \
  --http-debug \
  --quiet \
  --no-usage-report
```

The JSON output (`--out json=...`) produces lines like:

```json
{"type":"Point","metric":"http_req_duration","data":{"time":"...","value":150.5,"tags":{"name":"GET /api/users","method":"GET","url":"..."}}}
{"type":"Point","metric":"http_reqs","data":{"time":"...","value":1,"tags":{"name":"GET /api/users","method":"GET"}}}
{"type":"Status","data":{"time":"...","status":"running"}}
```

## 4. Key Backend Components (TypeScript)

### 4.1 k6 Runner

```ts
// src/k6-runner/runner.ts
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import EventEmitter from 'events';

interface RunningTest {
  runId: string;
  process: ChildProcess;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
}

class K6Runner extends EventEmitter {
  private k6BinaryPath: string;
  private active: Map<string, RunningTest> = new Map();

  async start(runId: string, scriptPath: string, args: string[]): Promise<void> {
    const proc = spawn(this.k6BinaryPath, ['run', scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Parse JSON lines from stdout
    const rl = createInterface({ input: proc.stdout! });
    rl.on('line', (line: string) => {
      try {
        const point = JSON.parse(line);
        this.emit('metric', runId, point);
      } catch { /* skip non-JSON lines */ }
    });

    this.active.set(runId, { runId, process: proc, status: 'running' });
  }

  abort(runId: string): void {
    const test = this.active.get(runId);
    test?.process.kill('SIGTERM');
  }

  wait(runId: string): Promise<number> {
    return new Promise((resolve) => {
      const test = this.active.get(runId);
      test?.process.on('exit', (code) => resolve(code ?? 1));
    });
  }
}
```

### 4.2 Result Aggregator

```ts
// src/aggregator/aggregate.ts
interface MetricPoint {
  type: 'Point';
  metric: string;
  data: { time: string; value: number; tags: Record<string, string> };
}

interface AggregatedMetric {
  metricName: string;
  type: string;
  avg: number;
  min: number;
  max: number;
  med: number;
  p90: number;
  p95: number;
  p99: number;
  count: number;
  rate: number;
}

function aggregate(points: MetricPoint[]): AggregatedMetric[] {
  const groups = new Map<string, number[]>();

  for (const p of points) {
    const key = p.metric;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p.data.value);
  }

  return Array.from(groups.entries()).map(([name, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      metricName: name,
      type: 'trend',
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      med: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      count: values.length,
      rate: 0,
    };
  });
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
```

### 4.3 Threshold Evaluator

```ts
// src/threshold/evaluator.ts

interface ThresholdRule {
  metric: string;
  expression: string; // e.g. "p(95)<500"
}

interface ThresholdResult {
  metric: string;
  expression: string;
  passed: boolean;
  actual: number | null;
}

function evaluateThresholds(
  metrics: AggregatedMetric[],
  rules: ThresholdRule[]
): ThresholdResult[] {
  return rules.map((rule) => {
    const metric = metrics.find((m) => m.metricName === rule.metric);
    if (!metric) return { ...rule, passed: false, actual: null };

    // Parse expression: "p(95)<500" → { aggregator: "p(95)", operator: "<", value: 500 }
    const match = rule.expression.match(/^(\w+(?:\(\d+\))?)\s*(<|>|<=|>=|==)\s*(\d+\.?\d*)$/);
    if (!match) return { ...rule, passed: false, actual: null };

    const [, aggregator, operator, thresholdStr] = match;
    const threshold = parseFloat(thresholdStr);
    const actual = resolveAggregator(metric, aggregator);
    const passed = compare(actual, operator, threshold);

    return { metric: rule.metric, expression: rule.expression, passed, actual };
  });
}
```

## 5. Scheduling (node-cron)

```ts
// src/scheduler/index.ts
import cron from 'node-cron';

// On startup, load all enabled schedules from DB
// Each schedule has a cron expression and a test_config_id
// When cron fires, create a new test_run and enqueue it

function startScheduler() {
  const schedules = await db.query('SELECT * FROM schedules WHERE enabled = true');

  for (const s of schedules) {
    cron.schedule(s.cron_expr, async () => {
      const run = await createTestRun(s.test_config_id);
      await jobQueue.add('run-test', { runId: run.id });
    });
  }
}
```

---

# LOW-LEVEL DESIGN — FRONTEND (LLD)

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **React 18** + **TypeScript** |
| Build Tool | **Vite** |
| Routing | **React Router v6** |
| State | **Zustand** (lightweight) + **React Query** (server state) |
| Editor | **Monaco Editor** (VS Code core) |
| Charts | **Recharts** (React-native) or **uPlot** (performance) |
| Styling | **Tailwind CSS** + **Radix UI** primitives |
| HTTP | **fetch** / **axios** |
| Real-time | **WebSocket** (native) / **SSE** |

## 2. Route Structure

```
/                              → Dashboard (project summary)
/login                         → Auth page
/projects                      → Project list
/projects/:pid                 → Project dashboard
/projects/:pid/scripts         → Script library
/projects/:pid/scripts/:sid    → Script editor + config
/projects/:pid/scripts/:sid/configs/:cid  → Test configuration
/projects/:pid/runs            → Test run history
/projects/:pid/runs/:rid       → Run detail + results
/projects/:pid/runs/:rid/live  → Live test monitor
/projects/:pid/schedules        → Scheduled runs
/projects/:pid/settings        → Environments, variables
```

## 3. Component Tree

```
<App>
  <AuthGuard>
    <Layout>
      <Sidebar />           — project nav, quick actions
      <Header />            — breadcrumbs, user menu
      <Routes>
        ├── <Dashboard />         — summary cards, trend charts, recent runs
        ├── <ProjectList />       — project cards
        ├── <ProjectDashboard />  — project-level stats
        ├── <ScriptLibrary />     — list of scripts with search/filter
        ├── <ScriptEditor />      — Monaco editor with:
        │   ├── <EditorToolbar />     — save, format, run, versions
        │   ├── <MonacoWrapper />     — code editor
        │   ├── <ScriptSidebar />     — configs list, quick actions
        │   └── <VersionHistory />   — version diff view
        ├── <ConfigEditor />     — form for test options:
        │   ├── <ScenarioForm />      — VUs, duration, stages, arrival rate
        │   ├── <ThresholdForm />     — add/remove threshold expressions
        │   ├── <EnvVarsForm />       — key-value environment variables
        │   ├── <TagsForm />          — key-value tags
        │   └── <RunButton />         — trigger test run
        ├── <RunHistory />       — paginated table of past runs
        ├── <RunDetail />        — single run result:
        │   ├── <RunStatus />        — status badge, timing
        │   ├── <ThresholdSummary />  — pass/fail grid
        │   ├── <MetricTable />       — aggregated metrics per endpoint
        │   ├── <MetricChart />       — time-series line chart
        │   └── <RunLog />           — k6 output log
        ├── <LiveMonitor />      — real-time dashboard during test:
        │   ├── <GaugeCard />        — VUs, iterations, duration
        │   ├── <LiveChart />        — streaming line chart
        │   └── <ThresholdStatus />  — live threshold updates
        └── <ScheduleManager /> — cron schedule list + form
      </Routes>
    </Layout>
  </AuthGuard>
</App>
```

## 4. State Management (Zustand Stores)

```typescript
// Current test run — live streaming state
interface LiveRunStore {
  runId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  metrics: Map<string, TimeSeriesPoint[]>;
  thresholds: ThresholdStatus[];
  log: string[];
  connect: (runId: string) => void;
  disconnect: () => void;
  appendMetric: (point: MetricPoint) => void;
  updateThreshold: (result: ThresholdResult) => void;
}

// Script editor state
interface EditorStore {
  currentScript: Script | null;
  isDirty: boolean;
  setContent: (content: string) => void;
  save: () => Promise<void>;
  formatCode: () => void;
}
```

## 5. Component Highlights

### 5.1 Script Editor (`ScriptEditor.tsx`)

- Uses **Monaco Editor** with k6 syntax highlighting (can use JS/TS mode)
- **Code snippets** panel for common k6 patterns:
  - HTTP GET/POST templates
  - Check/assertion patterns
  - Threshold examples
  - Scenario configurations
  - Custom metric definitions
- **Lint/validation**: basic k6 script validation (missing `export default function`, etc.)
- **Version diff**: side-by-side view of different script versions
- **Run dropdown**: "Run with..." option that opens config selection

### 5.2 Config Editor (`ConfigEditor.tsx`)

```
┌──────────────────────────────────────────────────┐
│  Test Configuration                             │
├──────────────────────────────────────────────────┤
│  General                                         │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ VUs:  10   │ │ Duration   │ │ Iterations   │ │
│  │     [____] │ │ [30s  [v]] │ │ [none   [v]] │ │
│  └────────────┘ └────────────┘ └──────────────┘ │
│                                                   │
│  [Use Scenarios]  ▼ (expandable section)         │
│  ┌──────────────────────────────────────────────┐ │
│  │ Scenario: ramp_up                            │ │
│  │ Executor: ramping-vus  Stages:               │ │
│  │  ┌─────────┬────────┬────────┐               │ │
│  │  │Duration │ Target │        │               │ │
│  │  ├─────────┼────────┼────────┤               │ │
│  │  │ 30s     │ 50     │ [×]    │               │ │
│  │  │ 1m      │ 100    │ [×]    │               │ │
│  │  │ 30s     │ 0      │ [×]    │               │ │
│  │  └─────────┴────────┴────────┘               │ │
│  │  [+ Add Stage]                                │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  Thresholds                                       │
│  ┌───────────────────────────────────────┐       │
│  │ Metric            │ Expression        │       │
│  ├───────────────────────────────────────┤       │
│  │ http_req_duration  │ p(95) < 500      │ [×]   │
│  │ http_req_failed    │ rate < 0.01      │ [×]   │
│  │ [Select metric...] │ [___________]    │ [+]   │
│  └───────────────────────────────────────┘       │
│                                                   │
│  Environment Variables                            │
│  ┌──────────┬──────────────┐                     │
│  │ BASE_URL │ https://...  │ [×]                 │
│  │ API_KEY  │ ****         │ [×]                 │
│  └──────────┴──────────────┘                     │
│                                                   │
│  [📄 Preview Script]  [▶ Run Test]               │
└──────────────────────────────────────────────────┘
```

### 5.3 Live Monitor (`LiveMonitor.tsx`)

- Connects to WebSocket at `/api/v1/runs/{id}/stream`
- Receives live metric points as they stream from k6
- Renders:
  - **Top bar**: elapsed time, active VUs, completed iterations, current RPS
  - **Live chart**: rolling 60-second window of response times (p50, p90, p95)
  - **Threshold cards**: live green/red status per threshold
  - **Log panel**: scrollable k6 stdout output
  - **Abort button**: kills the running test

### 5.4 Dashboard (`Dashboard.tsx`)

- **Summary cards**: Total tests (24h), Pass rate %, Avg response time, Error rate
- **Trend chart**: Response time over last N runs
- **Recent runs table**: status, duration, pass/fail, trigger
- **Threshold health grid**: which thresholds fail most often
- **Quick actions**: "New Script", "Run Last", "View Schedules"

## 6. Real-Time Architecture

```
Browser                    Backend                      k6 Worker
   │                          │                            │
   │  POST /run               │                            │
   │ ─────────────────────►   │   (creates test_run,       │
   │                          │    enqueues job)            │
   │                          │                            │
   │  WS /runs/{id}/stream    │                            │
   │ ─────────────────────►   │                            │
   │                          │   (worker picks job)       │
   │                          │ ◄─────────────────────────  │
   │                          │                            │
   │                          │   k6 starts, emits JSON    │
   │                          │ ◄─────────────────────────  │
   │        metric_point      │                            │
   │ ◄─────────────────────── │                            │
   │        metric_point      │                            │
   │ ◄─────────────────────── │                            │
   │        ...               │     ...                    │
   │                          │                            │
   │        test_completed    │                            │
   │ ◄─────────────────────── │    k6 exits                │
   │                          │ ◄─────────────────────────  │
   │                          │   (aggregation +           │
   │                          │    threshold evaluation)   │
   │        full_results      │                            │
   │ ◄─────────────────────── │                            │
```

---

## 6. Recommended npm Packages

```jsonc
{
  "dependencies": {
    // HTTP / API
    "fastify": "^5.x",          // HTTP framework (fast, schema-based)
    "@fastify/websocket": "",   // WebSocket plugin
    "@fastify/cors": "",        // CORS
    "@fastify/rate-limit": "",  // Rate limiting

    // Database
    "knex": "",                 // SQL query builder
    "pg": "",                   // PostgreSQL driver
    "ioredis": "",              // Redis client

    // Job Queue
    "bullmq": "",               // Redis-backed job queue

    // Object Storage
    "@aws-sdk/client-s3": "",   // MinIO/S3 client

    // Scheduling
    "node-cron": "",            // Cron scheduler

    // Validation
    "zod": "",                  // Schema validation

    // Logging
    "pino": "",                 // Structured logger (Fastify default)

    // k6 output parsing
    "readline": "built-in",     // Line-by-line stream parsing

    // Testing
    "vitest": "dev"             // Unit/integration tests
  }
}
```

---

## Key Integration Points with k6

### k6 Features Used

| k6 Feature | How Platform Uses It |
|------------|---------------------|
| **`--out json`** | Primary output — streamed and parsed line-by-line for real-time + storage |
| **Scenarios** | UI form → JSON `options.scenarios` → injected into script |
| **Thresholds** | UI form → `options.thresholds` → evaluated post-run by platform AND natively by k6 |
| **Tags** | UI tags → `options.tags` + tagged requests → enables per-endpoint filtering |
| **Checks** | Used inside scripts (UI snippets); results read from k6 output |
| **Custom Metrics** | UI snippet templates for Trend/Counter/Gauge/Rate |
| **Lifecycle Hooks** | setup() for data setup, teardown() for cleanup |
| **Environment Variables** | UI key-value → `-e KEY=VALUE` CLI flags |
| **Web Dashboard** | Can be enabled as an alternative live view (`--web-dashboard`) |
| **Extensions** | Support custom binaries via `k6 run --ext=...` if needed |

### k6 CLI Arguments Constructed by Platform

```
k6 run <script.js> \
  --out json=<output_path> \         # → stream to result ingester
  --vus <n> \                        # → from config
  --duration <d> \                   # → from config
  --iterations <n> \                 # → from config (optional)
  --stage ... \                      # → or stages
  --tag test_run_id=<uuid> \         # → platform tracking tag
  --tag project=<name> \             # → project context
  -e KEY=VALUE \                     # → env vars per config
  --quiet \                          # → reduce noise
  --no-usage-report \                # → privacy
  --summary-trend-stats="avg,p(p95),p(p99)"  # → for end-of-test summary
```

For scenario-based tests, options are embedded in the script itself rather than CLI flags.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                  Docker Compose / Kubernetes      │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Frontend  │  │ Backend  │  │ k6 Worker(s)  │   │
│  │ (Nginx)   │  │ (API)    │  │ (scale N)     │   │
│  └──────────┘  └──────────┘  └───────────────┘   │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Postgres  │  │ Redis    │  │ RabbitMQ       │   │
│  └──────────┘  └──────────┘  └───────────────┘   │
│                                                   │
│  ┌──────────┐                                     │
│  │ MinIO    │                                     │
│  └──────────┘                                     │
└─────────────────────────────────────────────────┘
```
