# High-Level Design — TenjinT6

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Browser                                  │
│                  React SPA (Port 5173)                               │
│                                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Pages    │  │ Components   │  │ Stores   │  │ API Client    │   │
│  │ (37 pgs) │  │ (28 shared)  │  │ (Zustand)│  │ (~95 methods) │   │
│  └──────────┘  └──────────────┘  └──────────┘  └───────┬───────┘   │
│                                                         │           │
└─────────────────────────────────────────────────────────┼───────────┘
                                                          │
                      HTTP REST (JSON)                    │  WebSocket
                      /api/v1/*                           │  /api/v1/ws?runId=X
                                                          │
┌─────────────────────────────────────────────────────────┼───────────┐
│                  Backend Server (Port 3001)             │           │
│                                                         ▼           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Express.js HTTP Server                                      │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────────┐    │    │
│  │  │  Middleware Pipeline                                 │    │    │
│  │  │  cors → json() → authMiddleware → audit → routes    │    │    │
│  │  └──────────────────────────────────────────────────────┘    │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────────┐    │    │
│  │  │  Route Modules (32 files)                            │    │    │
│  │  │  auth  projects  scripts  configs  runs  suites      │    │    │
│  │  │  schedules  workers  alerts  sla  dashboards  ...    │    │    │
│  │  └──────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                           │                                          │
│              ┌────────────┼────────────┬──────────────┐              │
│              ▼            ▼            ▼              ▼              │
│  ┌──────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐      │
│  │  Prisma ORM  │ │  RabbitMQ  │ │WebSocket │ │  Scheduler   │      │
│  │  (SQLite)    │ │  Queue     │ │ Pub/Sub  │ │  (node-cron) │      │
│  └──────┬───────┘ └─────┬──────┘ └──────────┘ └──────────────┘      │
│         │               │                                            │
│         ▼               ▼                                            │
│  ┌──────────┐    ┌────────────┐                                      │
│  │ SQLite   │    │  Worker    │                                      │
│  │ dev.db   │    │  Consumer  │                                      │
│  └──────────┘    │            │                                      │
│                  │ ┌────────┐ │                                      │
│                  │ │K6Runner│ │  ── spawns ──► k6 binary             │
│                  │ └────────┘ │                                      │
│                  │ ┌──────────────┐                                  │
│                  │ │ResultIngester│  ── batch inserts ──► DB         │
│                  │ └──────────────┘                                  │
│                  │ ┌─────────────────┐                               │
│                  │ │ advanceSuite()  │  ── next run in chain         │
│                  │ └─────────────────┘                               │
│                  └────────────────────┘                              │
│                           │                                          │
│                    ┌──────┴──────┐                                   │
│                    ▼             ▼                                    │
│           ┌────────────┐  ┌──────────────┐                           │
│           │  Worker    │  │  Worker      │                           │
│           │  Agent     │  │  Agent       │  (distributed workers)    │
│           │  (local)   │  │  (K8s pod)   │                           │
│           └────────────┘  └──────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Context Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  TenjinT6    │────▶│   RabbitMQ   │
│  (React SPA) │     │  Backend     │     │  (Message Q) │
└──────────────┘     └──────────────┘     └──────┬───────┘
       ▲                    │                     │
       │    WebSocket       │                     ▼
       │◄───────────────────┤              ┌──────────────┐
       │                    │              │   k6 Binary  │
       │                    │              │  (test exec) │
       │                    │              └──────────────┘
       │                    │
       │                    ▼
       │           ┌──────────────────┐
       │           │   SQLite DB      │
       └───────────│  (Prisma ORM)    │
                   └──────────────────┘
```

### External Integrations

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  k6 Cloud    │    │  Git Repos   │    │  SMTP Server │
│  (results)   │    │  (sync)      │    │  (alerts)    │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Kubernetes  │    │  Worker      │    │  Slack/      │
│  API (pods)  │    │  Agents      │    │  Webhook     │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 3. Deployment Architecture

### Development Mode
```
┌─────────────────────────────────────────────┐
│  Single Machine                               │
│                                                │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │ Backend  │   │ Frontend │   │RabbitMQ  │  │
│  │ :3001    │   │ :5173    │   │ :5672    │  │
│  │ tsx watch│   │ vite dev │   │ docker   │  │
│  └──────────┘   └──────────┘   └──────────┘  │
└─────────────────────────────────────────────┘
```

### Production Mode (Docker Compose)
```
┌─────────────────────────────────────────────┐
│  Docker Host                                  │
│                                                │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │ Backend  │   │ Nginx    │   │RabbitMQ  │  │
│  │ :3001    │   │ :5173    │   │ :5672    │  │
│  │ node dist│   │ serves   │   │ alpine   │  │
│  │          │   │ frontend │   │          │  │
│  └──────────┘   └──────────┘   └──────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  SQLite Volume (./data/dev.db)           │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Scalable Mode (with worker agents)
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Load        │     │  Backend     │     │  RabbitMQ    │
│  Balancer    │────▶│  Cluster     │     │  Cluster     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                   │
              ┌────────────────────────────────────┤
              ▼                                    ▼
   ┌──────────────────┐              ┌──────────────────┐
   │  Worker Agent 1  │              │  Worker Agent N  │
   │  (local/k8s pod) │              │  (local/k8s pod) │
   │  k6 + agent      │              │  k6 + agent      │
   └──────────────────┘              └──────────────────┘
              │                              │
              └──────────┬───────────────────┘
                         ▼
                 ┌──────────────┐
                 │  Shared DB  │
                 │  (SQLite →  │
                 │  PostgreSQL)│
                 └──────────────┘
```

---

## 4. API Architecture

### Layer Structure
```
HTTP Request
    │
    ▼
cors() ────────── CORS headers
    │
    ▼
express.json() ── Body parsing
    │
    ▼
authMiddleware ── JWT/PAT verification (attaches req.user)
    │
    ▼
Route Handler ─── Zod validation → business logic → response
    │
    ▼
errorHandler ──── Catches ZodError (400) and generic errors (500)
```

### Route Organization
```
/api
  /health                           [public]  Health check
  /api-docs                         [public]  Swagger UI
  /api-docs.json                    [public]  OpenAPI spec

/api/v1
  /auth/*                           [public]  Login, signup, profile
  /webhooks/*                       [public]  Trigger runs via key

  /scripts/*                        [JWT]     CRUD script/plan operations
  /projects/*                       [JWT]     Project management
  /configs/*                        [JWT]     Test configuration CRUD
  /runs/*                           [JWT]     Run trigger, results, exports
  /suites/*                         [JWT]     Suite CRUD and execution
  /schedules/*                      [JWT]     Cron schedule management
  /workers/*                        [JWT]     Worker CRUD, distribute, K8s
  /alerts/*                         [JWT]     Alert rules and history
  /sla/*                            [JWT]     SLA rules, breaches, reports
  /dashboards/*                     [JWT]     Dashboard CRUD and builder
  /environments/*                   [JWT]     Environment variables
  /members/*                        [JWT]     Team member management
  /csv/*                            [JWT]     CSV data file management
  /git/*                            [JWT]     Git repository sync
  /plugins/*                        [JWT]     Plugin management
  /recording/*                      [JWT]     HTTP recording proxy
  /correlation/*                    [JWT]     Correlation analysis
  /templates/*                      [JWT]     Script templates
  /comparison/*                     [JWT]     Run comparison
  /validation/*                     [JWT]     k6 script validation
  /export/*                         [JWT]     Result exports
  /retention/*                      [JWT]     Data retention management
  /pat/*                            [JWT]     Personal Access Tokens
  /audit-logs/*                     [JWT]     Audit log queries
  /db-connections/*                 [JWT]     Database connections
  /plans/*                          [JWT]     Test plan management
```

---

## 5. Data Flow Diagrams

### 5.1 Test Run Lifecycle (Single Run)

```
User clicks "Run"
    │
    ▼
POST /api/v1/configs/:id/run
    │
    ▼
Backend:
  1. Load TestConfig + Script
  2. Merge env vars (script → config → default env → output types)
  3. Replace __TARGET_URL__ placeholders
  4. Create TestRun row (status: pending)
  5. Extract CSV files from script
  6. Enqueue message to RabbitMQ (run-test queue)
    │
    ▼
Worker Consumer:
  1. Broadcast status 'running' via WebSocket
  2. K6Runner.start():
     - Write script + CSVs to temp files
     - Spawn `k6 run script.js --out json`
     - Parse stdout line-by-line
         │
         ├── Metric Point → emit 'metric' event
         │   ├── ResultIngester.ingestPoint() → buffer
         │   └── broadcastMetric() → WebSocket
         │
         └── __requestLog → collect in memory
    │
    ▼
k6 process exits
    │
    ▼
'done' event:
  1. ResultIngester.aggregateAndFinalize():
     - Flush buffered points
     - Aggregate into TestResult rows
     - Evaluate thresholds → ThresholdResult rows
     - Evaluate alert rules → AlertEvent rows
     - Evaluate SLA rules → SlaBreach rows
     - Update TestRun status (completed/failed)
  2. Persist request logs
  3. Auto-fetch k6 Cloud results if available
  4. advanceSuite() [for suite runs]
  5. Broadcast final status via WebSocket
```

### 5.2 Suite Run Lifecycle

```
User clicks "Run Suite"
    │
    ▼
POST /api/v1/suites/:id/run
    │
    ▼
Backend:
  1. Load suite + ordered scripts
  2. Generate shared suiteRunId (UUID)
  3. Create N TestRun rows (one per script, all pending, same suiteRunId)
  4. Enqueue first script's run
  5. Mark first run 'running'
  6. Return { suiteRunId, runs[] }
    │
    ▼
Worker completes Run #1
    │
    ▼
advanceSuite(runId):
  1. Find next pending run with same suiteRunId
  2. Enqueue it to RabbitMQ
  3. Mark it 'running'
    │
    ▼
Worker completes Run #2 → advanceSuite → Run #3 → ... → all done
```

### 5.3 Distributed Run Flow

```
User clicks "Distribute"
    │
    ▼
POST /api/v1/projects/:pid/configs/:configId/distribute
    │
    ▼
Backend:
  1. Load config + script
  2. Query online workers
  3. Create TestRun (status: distributing)
  4. Split VUs across workers
  5. Create WorkerRunAssignment rows
  6. POST /run to each worker agent with:
     - Script content
     - VU split per worker
     - Central API URL + auth token
    │
    ▼
Worker Agent (on each node):
  1. Spawn k6 with assigned VUs
  2. POST metric points to /api/v1/runs/:id/metrics
  3. On completion, POST to /api/v1/runs/:id/complete
    │
    ▼
Backend (metrics endpoint):
  1. Feed points into ResultIngester (same buffer as local runs)
  2. On complete: aggregateAndFinalize()
  3. Mark WorkerRunAssignment as completed/failed
  4. When all assignments done: mark TestRun complete
```

---

## 6. Security Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Authentication Layer                                       │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ JWT Auth        │    │ Personal Access Token (PAT)  │   │
│  │ (user sessions) │    │ (API/CLI/Webhook access)     │   │
│  │                 │    │                              │   │
│  │ /auth/login ──▶ │    │ SHA256(token) stored in DB   │   │
│  │ JWT in response │    │ Bearer token in header       │   │
│  │ 24h expiration  │    │ Scoped permissions            │   │
│  └─────────────────┘    └──────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Authorization Layer                                        │
│                                                             │
│  Roles:                                                     │
│  ┌──────────┬──────┬──────┬─────────┬───────┐              │
│  │ Resource │Admin │Editor│Executor │Viewer │              │
│  ├──────────┼──────┼──────┼─────────┼───────┤              │
│  │ Scripts  │  ✅  │  ✅  │   ❌    │  ❌   │              │
│  │ Configs  │  ✅  │  ✅  │   ✅    │  ❌   │              │
│  │ Runs     │  ✅  │  ✅  │   ✅    │  ✅   │              │
│  │ Workers  │  ✅  │  ❌  │   ❌    │  ❌   │              │
│  │ Settings │  ✅  │  ❌  │   ❌    │  ❌   │              │
│  └──────────┴──────┴──────┴─────────┴───────┘              │
└────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema Overview (30 Models)

```
User ──── ProjectMember ──── Project ──── Script ──── ScriptVersion
  │                            │            │              │
  │                            │            ├── TestConfig ── Schedule
  │                            │            │       │
  │                            │            │       └── TestRun ──── TestResult
  │                            │            │            │          TestResultPoint
  │                            │            │            │          ThresholdResult
  │                            │            │            │          TestRequestLog
  │                            │            │            │          SlaBreach
  │                            │            │            │          WorkerRunAssignment
  │                            │            │            │
  │                            │            ├── TestSuiteScript
  │                            │            ├── SlaRule
  │                            │            ├── TestPlan
  │                            │            │
  │                            ├── Worker ── WorkerRunAssignment
  │                            ├── AlertRule ── AlertEvent
  │                            ├── SlaRule ── SlaBreach
  │                            ├── Environment
  │                            ├── CsvFile
  │                            ├── Dashboard
  │                            ├── GitRepo
  │                            ├── TestSuite ── TestSuiteScript
  │                            ├── Plugin
  │                            ├── DatabaseConnection
  │                            ├── AuditLog
  │                            │
  ├── ApiKey
  └── PersonalAccessToken
```

---

## 8. Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | SQLite | Zero configuration, single-file, perfect for self-hosted single-server deployments |
| ORM | Prisma | Type-safe queries, auto-generated client, easy migrations |
| Message Queue | RabbitMQ | Durable, reliable, supports multiple consumers for distributed workers |
| Real-time | WebSocket | Native browser support, full-duplex, lower latency than SSE |
| State Management | Zustand | Minimal boilerplate, no context providers, works outside React components |
| Styling | Tailwind CSS | Rapid development, consistent design system, built-in dark mode |
| Code Editor | Monaco | Feature-rich, same engine as VS Code, supports diff view |
| Visual Editor | Custom block tree (drag-drop) | Converts blocks → k6 JavaScript, parses code → blocks, 43 block types in 9 categories |
| Charting | Recharts | React-native, composable, supports all required chart types |
| Monorepo | npm workspaces | Built-in, no additional tooling needed, shared types across packages |
| Auth | JWT + PAT | Stateless sessions + API access without user interaction |
