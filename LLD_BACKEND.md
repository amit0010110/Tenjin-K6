# Low-Level Design — Backend (packages/backend)

## 1. Entry Point (`src/index.ts`)

### Initialization Sequence
```
1. Create Express app + HTTP server
2. Apply global middleware: cors, express.json()
3. Register public routes (health, swagger, auth, webhook triggers)
4. Register auth middleware
5. Register all protected routes (32 route modules)
6. Register error handler
7. Connect to Prisma (SQLite)
8. Connect to RabbitMQ
9. Start worker consumer
10. Start WebSocket server
11. Start retention cleanup scheduler
12. Start cron-based schedule engine
13. Listen on PORT (default 3001)
```

### Shutdown Sequence
```
1. Stop cron scheduler
2. Stop retention cleanup
3. Close RabbitMQ connection
4. Disconnect Prisma
5. Close HTTP server
```

---

## 2. Middleware Layer

### File: `src/middleware/auth.ts` — `authMiddleware`
```
Parse Authorization header (Bearer token)
  ├── Try JWT verification
  │   └── Success → decode payload, attach req.user
  ├── Fallback: try Personal Access Token (PAT)
  │   └── Success → look up SHA256(token) in DB, attach req.user
  └── Fallback: dev mode (no header) → attach admin user
```

### File: `src/middleware/rbac.ts` — `requirePermission(action, resource)`
```
Middleware factory:
  1. Extract userId from req.user
  2. Look up ProjectMember record
  3. Check role against permission matrix
  4. Return 403 if insufficient permissions
```

### File: `src/middleware/audit.ts` — `auditLogMiddleware`
```
Wraps res.json to intercept successful responses:
  1. Read action/entity/entityId from res.locals
  2. Create AuditLog row in DB
  3. Call original res.json
```

### File: `src/middleware/errorHandler.ts` — `errorHandler`
```
Catches:
  - ZodError → 400 { message, errors }
  - Generic Error → 500 { message }
Logs with pino
```

---

## 3. Route Modules

### 3.1 Auth Routes (`routes/auth.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| POST | /auth/signup | Validate email+password+name → hash password → create User → return JWT |
| POST | /auth/login | Find user by email → compare bcrypt → return JWT |
| GET | /auth/me | Return current user from JWT |
| PUT | /auth/me | Update name/email/password for current user |

### 3.2 Project Routes (`routes/projects.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| GET | /projects | Find projects where userId = owner OR user is member → return with _count |
| POST | /projects | Create project + auto-create ProjectMember as admin |
| GET | /projects/:pid | Find project + 404 if not found |
| PUT | /projects/:pid | Update name/description/smtpConfig/k8sConfig |
| PATCH | /projects/:pid/cloud-token | Update k6CloudToken |
| DELETE | /projects/:pid | Delete project (cascades to all related tables) |

### 3.3 Script Routes (`routes/scripts.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| GET | /projects/:pid/scripts | List scripts for project, ordered by createdAt desc |
| POST | /projects/:pid/scripts | Create script with name, content, envVars, tags |
| GET | /scripts/:id | Get single script with config count |
| PUT | /scripts/:id | Update name, content, tags + increment version + save version snapshot |
| DELETE | /scripts/:id | Delete script and cascade |
| PUT | /scripts/:id/blocks | Save visual block tree |
| GET | /scripts/:id/versions | List all versions |
| GET | /scripts/:id/versions/:vid | Get specific version content |
| POST | /scripts/:id/versions/:vid/restore | Restore script to version content |

### 3.4 Config Routes (`routes/configs.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| GET | /scripts/:sid/configs | List configs for a script |
| POST | /scripts/:sid/configs | Create config (resolve projectId from script) |
| GET | /projects/:pid/configs | List configs across all scripts in project |
| PUT | /configs/:id | Update name, description, options, prometheusPushUrl |
| DELETE | /configs/:id | Delete config |

### 3.5 Run Routes (`routes/runs.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| POST | /configs/:id/run | **triggerRun**: Load config+script → merge env vars → replace __TARGET_URL__ → create TestRun → extract CSV files → enqueue to RabbitMQ → return run |
| GET | /runs | List runs with filters (projectId, status, suiteRunId, dateFrom, dateTo, scriptId, limit) |
| GET | /runs/:id | Get run with script name, config name, results, threshold results, request logs |
| POST | /runs/:id/abort | Enqueue abort message to RabbitMQ |
| DELETE | /runs/:id | Delete run and cascade |
| GET | /runs/:id/results | Get TestResult rows for run |
| GET | /runs/:id/thresholds | Get ThresholdResult rows for run |
| GET | /runs/:id/request-logs | Get TestRequestLog rows for run |
| PATCH | /runs/:id/notes | Update notes field |
| POST | /runs/:id/cloud-sync | Store cloudRunId and cloudRunUrl |
| GET | /runs/:id/export/json | Export run results as JSON |
| GET | /runs/:id/export/junit | Export run results as JUnit XML |
| GET | /runs/:id/export/prometheus | Export run results as Prometheus metrics text |

### 3.6 Worker Routes (`routes/workers.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| GET | /projects/:pid/workers | List workers with assignment count |
| POST | /projects/:pid/workers | Create worker (name, url, capacity, launchType, namespace) |
| PATCH | /workers/:id | Update worker fields |
| DELETE | /workers/:id | Delete worker |
| POST | /workers/heartbeat | Find worker by name → update status+lastHeartbeat |
| POST | /workers/:id/start | If launchType=kubernetes: init K8s client → launchWorker pod. If local: spawn child process with tsx |
| POST | /workers/:id/stop | If kubernetes: delete pod. If local: SIGTERM → SIGKILL |
| GET | /workers/:id/status | Return running state + pid/podPhase |
| GET | /workers/k8s-pods | List all worker pods in namespace (project K8s config) |
| POST | /projects/:pid/configs/:configId/distribute | Load config → split VUs → create assignments → POST to each worker agent |
| POST | /runs/:id/metrics | Receive metric point from remote worker → feed to ResultIngester |
| POST | /runs/:id/complete | Receive completion from remote worker → aggregateAndFinalize → update assignments |
| POST | /runs/:id/status | Update assignment status from remote worker |
| GET | /runs/:id/assignments | Get WorkerRunAssignment rows for run |

### 3.7 Suite Routes (`routes/suites.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| GET | /projects/:pid/suites | List suites with scripts |
| POST | /projects/:pid/suites | Create suite with ordered script references |
| PUT | /suites/:id | Update name and/or script list (delete + recreate TestSuiteScript) |
| DELETE | /suites/:id | Delete suite |
| POST | /suites/:id/run | Create per-script TestRuns with shared suiteRunId → enqueue first → mark running |
| GET | /suites/:id/runs | Group runs by suiteRunId, return latest first |
| GET | /suite-runs/:suiteRunId | Get all runs for a suite run ID |

### 3.8 Schedule Routes (`routes/schedules.ts`)

| Method | Path | Handler Logic |
|---|---|---|
| GET | /configs/:id/schedules | List schedules for a config |
| POST | /configs/:id/schedules | Create schedule with cronExpr → register cron job |
| DELETE | /schedules/:id | Delete schedule → unregister cron job |

### 3.9 Route Summary (All 32 Route Modules)

| # | File | Routes Count | Key Responsibilities |
|---|---|---|---|
| 1 | auth.ts | 4 | Signup, login, profile |
| 2 | projects.ts | 6 | Project CRUD + cloud token |
| 3 | scripts.ts | 9 | Script CRUD + versions + blocks |
| 4 | configs.ts | 5 | Config CRUD |
| 5 | runs.ts | 14 | Run trigger, list, results, exports, abort |
| 6 | workers.ts | 14 | Worker CRUD, distribute, K8s, metrics, assignments |
| 7 | suites.ts | 6 | Suite CRUD + run + runs query |
| 8 | schedules.ts | 3 | Schedule CRUD |
| 9 | dashboard.ts | 2 | Summary stats + trend data |
| 10 | dashboards.ts | 5 | Dashboard builder CRUD |
| 11 | templates.ts | 2 | List templates + POST /templates/use (saves blocks + code) |
| 12 | comparison.ts | 1 | Run comparison |
| 13 | validation.ts | 1 | k6 script validation |
| 14 | environments.ts | 5 | Environment CRUD + set-default |
| 15 | members.ts | 4 | Member CRUD + role management |
| 16 | csv.ts | 4 | Data file CRUD |
| 17 | alerts.ts | 5 | Alert rule CRUD + history |
| 18 | export.ts | 3 | JSON, JUnit, Prometheus exports |
| 19 | git.ts | 6 | Git repo CRUD + push/pull |
| 20 | pats.ts | 4 | Personal Access Token CRUD |
| 21 | retention.ts | 2 | Stats + purge |
| 22 | correlation.ts | 4 | Auto-correlate, analyze, generate blocks |
| 23 | regression.ts | 2 | Baseline comparison |
| 24 | sla.ts | 7 | SLA rule CRUD + status + breaches + report |
| 25 | audit.ts | 1 | Paginated audit log |
| 26 | plugins.ts | 4 | Plugin CRUD + toggle |
| 27 | plans.ts | 5 | Test plan CRUD |
| 28 | db-connections.ts | 5 | Database connection CRUD |
| 29 | recording.ts | 6 | Start/stop/capture/generate from proxy |
| 30 | swagger.ts | 2 | OpenAPI spec + Swagger UI |
| 31 | ws.ts | 0 | WebSocket setup (no HTTP routes) |
| 32 | webhooks.ts | 6 | Webhook key CRUD + trigger endpoint |

---

## 4. Worker Infrastructure

### 4.1 Worker Consumer (`workers/index.ts`)

```
startWorker():
  1. Get RabbitMQ channel
  2. Consume from 'run-test' queue
  3. For each message:
     a. Parse JSON payload
     b. If type === 'abort' → runner.abort(runId) → ack
     c. Else → update status to running → runner.start(payload) → ack
```

### Event Handlers

**runner.on('metric', callback):**
```
For each metric point from k6 stdout:
  1. If type === 'Point':
     a. ingester.ingestPoint(runId, point) — buffer for batch insert
     b. broadcastMetric(runId, point) — WebSocket push
```

**runner.on('done', callback):**
```
On k6 process exit:
  1. ingester.aggregateAndFinalize(runId, exitCode)
     - Flush buffered points → batch insert into test_result_points
     - Aggregate points into test_results (avg/min/max/p90/p95/p99)
     - Evaluate thresholds → threshold_results
     - Evaluate alert rules → alert_events
     - Evaluate SLA rules → sla_breaches
     - Update test_runs.status
  2. Persist request logs into test_request_logs
  3. Store cloud run URL/ID
  4. Auto-fetch k6 Cloud results if token configured
  5. advanceSuite(runId) — find next pending suite run
  6. broadcastStatus (completed/failed)
```

**runner.on('error', callback):**
```
Log error, broadcastStatus('failed')
```

### 4.2 K6Runner (`workers/k6Runner.ts`)

```
Class K6Runner extends EventEmitter:

  start(req: RunRequest):
    1. Write script to temp file (workDir/{runId}.js)
    2. Write CSV files to temp directory
    3. Build CLI args:
       - ['run', scriptPath, '--out', 'json']
       - Output destinations (cloud, prometheus, etc.)
       - VUs, duration, iterations, stages
       - Browser flag, tags
    4. Spawn k6 process with merged env vars
    5. Parse stdout line-by-line via readline:
       - JSON lines → emit 'metric' event
       - __requestLog entries → collect in memory
    6. Collect stderr (cloud run URL/ID parsing)
    7. On process exit → emit 'done' event
    8. On error → emit 'error' event

  abort(runId):
    - SIGTERM → wait 5s → SIGKILL

  buildArgs(scriptPath, options):
    - Base: ['run', scriptPath, '--out', 'json']
    - For each enabled output in options.outputs:
      - Resolve OUTPUT_TYPES[type].flag(config) → append
    - Backward compat: prometheusPushUrl, cloud, browser
    - VUs, duration, iterations, stages
    - Tag: run_id=<runId>
```

### 4.3 ResultIngester (`workers/resultIngester.ts`)

```
Class ResultIngester:

  Constructor:
    - Start flush timer (every 2 seconds)
    - Initialize pointBuffer array

  ingestPoint(runId, point):
    - Push { testRunId, timestamp, metricName, metricValue, tags } to buffer

  flush():
    - Swap buffer with empty array
    - Batch insert into test_result_points via prisma.testResultPoint.createMany()
    - Error handled with logger

  flushNow():
    - Trigger flush + wait for pending flush

  aggregateAndFinalize(runId, exitCode):
    1. flushNow() — ensure all points are in DB
    2. Load all TestResultPoint for this runId
    3. Group by metricName
    4. For each metric group:
       - Compute: min, max, avg, med, p90, p95, p99, count
       - Create TestResult row with all aggregations
    5. Evaluate thresholds (from config options.thresholds):
       - Parse expression (e.g. "avg<200" or "p(95)<500")
       - Compute actual value from sorted data
       - Compare using operator → ThresholdResult
    6. Update TestRun status:
       - exitCode 0 → 'completed'
       - else → 'failed'
    7. Evaluate alert rules:
       - Find enabled AlertRule for project
       - Compute metric value
       - Compare with threshold + condition
       - Send notification (Slack/webhook/email)
       - Create AlertEvent row
       - Update AlertRule.lastTriggeredAt
    8. Evaluate SLA rules:
       - Call sla.evaluateSlaRules(runId, projectId)
    9. Return { status }

  evaluateThreshold(metric, expr, sortedValues):
    - Parse: aggregator (avg|min|max|med|count|p(N)) + operator + threshold
    - Compute actual
    - Compare
    - Return ThresholdResult

  evaluateAlerts(run, groups):
    - Similar to threshold evaluation but with notification dispatch

  percentile(sorted, p):
    - Calculate percentile using linear interpolation
```

---

## 5. Scheduler (`scheduler/index.ts`)

```
Class Scheduler:

  async start():
    1. Load all enabled schedules from DB
    2. For each schedule:
       - Register node-cron job with cronExpr
       - Compute nextRunAt using cron-parser
       - Store job reference in Map

  async execute(schedule):
    1. Load TestConfig + Script
    2. Merge env vars (script → config → default env)
    3. Replace __TARGET_URL__
    4. Create TestRun with triggerType: 'schedule'
    5. Enqueue to RabbitMQ
    6. Update lastRunAt, nextRunAt

  add(schedule) / remove(scheduleId) / update(schedule):
    - Register / unregister / re-register cron jobs

  stop():
    - Stop all cron jobs
```

---

## 6. RabbitMQ Library (`lib/rabbitmq.ts`)

```
Queues:
  - 'run-test' (durable) — Test run jobs
  - 'result-point' (durable) — Reserved for future metric point streaming

Functions:
  connectRabbitMQ():
    - Connect to RABBITMQ_URL (default amqp://localhost)
    - Create channel
    - Assert queues

  getChannel():
    - Return channel (throws if not connected)

  closeRabbitMQ():
    - Close channel → close connection
```

---

## 7. WebSocket System (`routes/ws.ts`)

```
WebSocket endpoint: /api/v1/ws?runId=<uuid>

On connection:
  1. Parse runId from query params
  2. If missing → close with 4001
  3. Subscribe client to runId's Set
  4. On disconnect → unsubscribe

Broadcast Functions:
  broadcastMetric(runId, data):
    - For each client subscribed to runId:
      - Send { type: 'metric', data }

  broadcastStatus(runId, status):
    - For each client subscribed to runId:
      - Send { type: 'status', status }
```

---

## 8. Kubernetes Manager (`lib/k8s.ts`)

```
Class K8sManager:

  init(config?):
    - Load kubeconfig from default location
    - Set context if specified
    - Create CoreV1Api and BatchV1Api clients
    - Set initialized flag

  launchWorker(name, port, centralUrl, config):
    1. Build pod manifest:
       - Name: worker-{name}-{sanitized}
       - Labels: app=tenjint6-worker, worker={name}
       - Container: image from config, port {port}
       - Env: AGENT_NAME, AGENT_PORT, CENTRAL_API_URL
    2. Delete existing pod with same name (if any)
    3. Create pod via createNamespacedPod
    4. Return { podName, namespace }

  stopWorker(name, namespace):
    - Delete pod via deleteNamespacedPod

  getPodStatus(name, namespace):
    - Read pod → return status.phase or null

  listWorkerPods(namespace):
    - List pods with label app=tenjint6-worker
```

---

## 9. Notification System (`lib/notifier.ts`)

```
sendNotification({ ruleName, channelType, channelConfig, metricName, metricValue, ... }):

  switch(channelType):
    case 'slack':
      - POST to webhook URL with Slack-formatted message
    case 'webhook':
      - POST to URL with JSON payload
    case 'email':
      - Use nodemailer with project SMTP config
      - Send to recipients list

  Return error string or null on success
```

---

## 10. Database Models — Relationships & Key Indexes

| Model | Foreign Keys | Unique Constraints | Indexes |
|---|---|---|---|
| ProjectMember | projectId → Project, userId → User | [projectId, userId] | — |
| ApiKey | userId → User | key | — |
| PersonalAccessToken | userId → User | — | — |
| Script | projectId → Project | — | — |
| ScriptVersion | scriptId → Script | [scriptId, version] | — |
| TestConfig | scriptId → Script, projectId → Project | — | — |
| TestRun | testConfigId → TestConfig, scriptId → Script, projectId → Project, userId → User | — | — |
| TestResult | testRunId → TestRun | — | — |
| TestResultPoint | testRunId → TestRun | — | [testRunId] |
| TestSuiteScript | suiteId → TestSuite, scriptId → Script | [suiteId, scriptId] | — |
| WorkerRunAssignment | runId → TestRun, workerId → Worker | — | [runId], [workerId] |
| AuditLog | projectId → Project, userId → User | — | [projectId, createdAt] |
| AlertEvent | alertRuleId → AlertRule | — | — |
| SlaBreach | slaRuleId → SlaRule, runId → TestRun | — | — |

---

## 11. Error Handling Strategy

```
Route Handler:
  try {
    // business logic
    res.json(data)
  } catch (err) {
    next(err)  // forward to errorHandler
  }

errorHandler:
  if (err instanceof z.ZodError):
    res.status(400).json({ message: 'Validation error', errors: err.issues })
  else:
    logger.error({ err })
    res.status(500).json({ message: 'Internal server error' })
```

---

## 12. Logging Strategy

```
All logs use pino structured JSON logging:

  logger.info({ runId, status }, 'Run completed')
  logger.error({ err, runId }, 'Failed to process run')

Log levels:
  - info: Route calls, lifecycle events, worker actions
  - warn: Heartbeat failures, worker agent issues
  - error: Uncaught errors, database failures, k6 failures
  - debug: Metric ingestion, WebSocket broadcasts (reserved)
```

---

## 13. Testing Strategy

```
Test Framework: Vitest + Supertest

Location: src/routes/__tests__/ (21 test files)

Test Pattern:
  - Setup: reset database, seed test data, create JWT token
  - Execute: use supertest to make HTTP requests
  - Assert: status codes, response body shape, database state

Coverage:
  - All CRUD routes tested
  - Authentication middleware tested
  - Permission checks tested
  - Run lifecycle tested (trigger, worker, results)
  - Worker distribution tested (online/offline scenarios)
```
