# REST API Reference — Graphana k6

**Base URL:** `/api/v1`

**Content-Type:** `application/json` (all requests and responses)

**Authentication:** Bearer JWT token in `Authorization` header, or Personal Access Token (PAT)

---

## Table of Contents

1. [Auth](#1-auth)
2. [Projects](#2-projects)
3. [Scripts](#3-scripts)
4. [Configs](#4-configs)
5. [Runs](#5-runs)
6. [Suites](#6-suites)
7. [Workers](#7-workers)
8. [Schedules](#8-schedules)
9. [Environments](#9-environments)
10. [Members](#10-members)
11. [Alerts](#11-alerts)
12. [SLA](#12-sla)
13. [Dashboards](#13-dashboards)
14. [Plans](#14-plans)
15. [Templates](#15-templates)
16. [CSV / Data Files](#16-csv--data-files)
17. [Validation](#17-validation)
18. [Correlation & Recording](#18-correlation--recording)
19. [Git](#19-git)
20. [Export](#20-export)
21. [Plugins](#21-plugins)
22. [Database Connections](#22-database-connections)
23. [Personal Access Tokens](#23-personal-access-tokens)
24. [Webhooks / API Keys](#24-webhooks--api-keys)
25. [Retention & Purge](#25-retention--purge)
26. [Audit Logs](#26-audit-logs)
27. [Regression](#27-regression)
28. [Comparison](#28-comparison)
29. [Dashboard API (Summary)](#29-dashboard-api)

---

### Common Responses

| Code | Meaning |
|------|---------|
| `200` | Success (GET, PUT, PATCH) |
| `201` | Created (POST) |
| `204` | No Content (DELETE) |
| `400` | Validation error — `{ message: string, errors?: object[] }` |
| `401` | Missing or invalid authentication |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate, already exists) |
| `500` | Internal server error |

---

## 1. Auth

### `POST /signup`

Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securePass123"
}
```

**Constraints:**
- `email`: valid email format
- `name`: 1–255 characters
- `password`: 6–128 characters

**Response `201`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

**Side effects:**
- Creates a default project (`{name}'s Project`)
- Returns signed JWT

**Errors:** `400` validation, `409` email already registered

---

### `POST /login`

Authenticate and receive a JWT.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePass123"
}
```

**Response `200`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

**Errors:** `401` invalid credentials

---

### `GET /me`

Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response `200`**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user"
}
```

**Errors:** `401` missing/invalid token, `404` user not found

---

### `PUT /me`

Update name and/or password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New Name",
  "currentPassword": "oldPass",
  "newPassword": "newPass123"
}
```

**Notes:**
- `name` can be updated alone
- To change password, both `currentPassword` and `newPassword` are required
- `currentPassword` is verified before accepting the change

**Response `200`**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "New Name",
  "role": "user"
}
```

**Errors:** `400` missing currentPassword, `401` wrong password

---

## 2. Projects

### `GET /projects`

List all projects for the authenticated user (owned + member).

**Headers:** `Authorization: Bearer <token>` (required)

**Query Parameters:** none

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "My Project",
    "description": null,
    "userId": "uuid",
    "k6CloudToken": null,
    "smtpConfig": "{}",
    "k8sConfig": "{}",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "_count": {
      "scripts": 5,
      "testRuns": 42,
      "members": 3
    }
  }
]
```

---

### `POST /projects`

Create a new project.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "name": "My Project",
  "description": "Optional description",
  "smtpConfig": {},
  "k8sConfig": {}
}
```

**Notes:** All fields except `name` are optional. Auto-creates a `ProjectMember` record with `admin` role for the creator.

**Response `201`** (same shape as GET project with `_count`)

---

### `GET /projects/:pid`

Get a single project with related counts.

**Path Parameters:** `pid` — project UUID

**Response `200`**
```json
{
  "id": "uuid",
  "name": "My Project",
  "description": "...",
  "userId": "uuid",
  "k6CloudToken": null,
  "smtpConfig": "{}",
  "k8sConfig": "{}",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "_count": {
    "scripts": 5,
    "testRuns": 42,
    "members": 3
  }
}
```

**Errors:** `404` not found

---

### `PUT /projects/:pid`

Update project fields.

**Request Body** (partial):
```json
{
  "name": "Updated Name",
  "description": "New description",
  "smtpConfig": { "host": "smtp.example.com", ... },
  "k8sConfig": { "namespace": "loadtest", "image": "worker:latest" }
}
```

**Response `200`** — updated project object

---

### `PATCH /projects/:pid/cloud-token`

Update the k6 Cloud token.

**Request Body:**
```json
{
  "token": "k6_cloud_token_value"
}
```

**Response `200`**
```json
{
  "id": "uuid",
  "name": "My Project",
  "k6CloudToken": "k6_cloud_token_value"
}
```

---

### `DELETE /projects/:pid`

Delete a project and all related data (cascade).

**Response `200`**
```json
{
  "message": "Deleted"
}
```

**Cascade includes:** suites → suite scripts, scripts → versions/configs/runs/results/points/thresholds/request-logs, alerts → events, git repos, CSV files, schedules, environments, members, dashboards, plans, SLA rules → breaches, plugins, workers → assignments, audit logs, DB connections

---

## 3. Scripts

### `GET /projects/:pid/scripts`

List scripts for a project (metadata only, no content).

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "load-test.js",
    "version": 3,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "tags": "{}"
  }
]
```

---

### `POST /projects/:pid/scripts`

Create a new script.

**Request Body:**
```json
{
  "name": "load-test.js",
  "content": "import http from 'k6/http';\nexport default function() { ... }",
  "envVars": { "BASE_URL": "https://example.com" },
  "tags": { "team": "platform" },
  "blocks": "[{\"type\":\"http-request\",...}]"
}
```

**Notes:** `envVars` and `tags` are stored as JSON strings internally. `blocks` is the visual block tree (optional).

**Response `201`** — created script object

---

### `GET /scripts/:id`

Get a single script with its configs.

**Response `200`**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "name": "load-test.js",
  "version": 3,
  "content": "import http from...",
  "filePath": null,
  "blocks": "[...]",
  "envVars": { "BASE_URL": "https://example.com" },
  "tags": { "team": "platform" },
  "testPlanId": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "configs": [
    { "id": "uuid", "name": "Staging 50VU" }
  ]
}
```

**Errors:** `404` not found

---

### `PUT /scripts/:id`

Update a script (auto-versioning).

**Request Body** (partial):
```json
{
  "name": "updated-name.js",
  "content": "import http from 'k6/http';...",
  "envVars": { "BASE_URL": "https://staging.example.com" },
  "tags": { "team": "platform", "env": "staging" }
}
```

**Notes:** Before applying updates, the current state is saved as a `ScriptVersion` snapshot. The `version` field is incremented.

**Response `200`** — updated script with incremented version

---

### `DELETE /scripts/:id`

Delete a script.

**Response:** `204` No Content

---

### `GET /scripts/:id/versions`

List version history.

**Response `200`**
```json
[
  { "id": "uuid", "version": 1, "createdAt": "2025-01-01T00:00:00.000Z" },
  { "id": "uuid", "version": 2, "createdAt": "2025-01-02T00:00:00.000Z" }
]
```

**Errors:** `404` script not found

---

### `GET /scripts/:id/versions/:versionId`

Get a specific version's full content.

**Response `200`**
```json
{
  "id": "uuid",
  "version": 2,
  "content": "import http from...",
  "createdAt": "2025-01-02T00:00:00.000Z"
}
```

**Errors:** `404` script or version not found

---

### `POST /scripts/:id/versions/:versionId/restore`

Restore script content from a specific version.

**Notes:** Current state is saved as a snapshot before restoration. Version is incremented.

**Response `200`** — restored script object

**Errors:** `404` script or version not found

---

### `PUT /scripts/:id/blocks`

Save the visual block tree.

**Request Body:**
```json
{
  "blocks": "[{\"type\":\"http-request\",\"label\":\"GET /api/users\",...}]"
}
```

**Response `200`**
```json
{ "message": "Blocks saved" }
```

**Errors:** `400` blocks not a string, `404` not found

---

## 4. Configs

### `GET /scripts/:sid/configs`

List configs for a specific script.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "scriptId": "uuid",
    "name": "Staging 50VU",
    "description": "50 virtual users, 30s duration",
    "options": "{ \"vus\": 50, \"duration\": \"30s\" }",
    "prometheusPushUrl": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "projectId": "uuid"
  }
]
```

---

### `GET /projects/:pid/configs`

List configs across all scripts in a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "scriptId": "uuid",
    "name": "Staging 50VU",
    "options": "...",
    "prometheusPushUrl": null,
    "createdAt": "...",
    "updatedAt": "...",
    "projectId": "uuid",
    "script": {
      "id": "uuid",
      "name": "load-test.js"
    }
  }
]
```

---

### `POST /scripts/:sid/configs`

Create a config for a script.

**Request Body:**
```json
{
  "name": "Production 100VU",
  "description": "High load test",
  "options": { "vus": 100, "duration": "60s", "thresholds": { "http_req_duration": ["p(95)<500"] } },
  "prometheusPushUrl": "http://pushgateway:9091/metrics"
}
```

**Notes:** `options` is the full k6 options object (JSON). The script's `projectId` is automatically resolved.

**Response `201`** — created config

**Errors:** `404` script not found

---

### `PUT /configs/:id`

Update a config.

**Request Body** (partial):
```json
{
  "name": "Updated Name",
  "options": { "vus": 200 }
}
```

**Response `200`** — updated config

---

### `DELETE /configs/:id`

Delete a config.

**Response:** `204` No Content

---

## 5. Runs

### `POST /configs/:id/run`

Trigger a single test run.

**Headers:** `Authorization: Bearer <token>` (user ID extracted for ownership)

**Path Parameters:** `id` — TestConfig UUID

**Request Body:** none

**Response `201`**
```json
{
  "id": "uuid-run-id",
  "testConfigId": "uuid",
  "scriptId": "uuid",
  "projectId": "uuid",
  "userId": "uuid",
  "status": "pending",
  "triggerType": "manual",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Side Effects:**
- Fetches config + script
- Merges env vars: script env → config env → default environment variables
- Replaces `__TARGET_URL__` placeholders in script content
- Injects output-type env vars (e.g. `K6_CLOUD_TOKEN`)
- Detects CSV file references via `extractCsvFiles()`
- Creates `TestRun` record with `status: 'pending'`
- Enqueues job to RabbitMQ `run-test` queue

**Errors:** `404` config not found

---

### `GET /runs`

List test runs with filtering.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | UUID | Filter by project |
| `status` | string | Filter by status (`pending`, `running`, `completed`, `failed`, `aborted`) |
| `suiteRunId` | UUID | Filter by suite run |
| `scriptId` | UUID | Filter by script |
| `dateFrom` | ISO date | Filter runs after this date |
| `dateTo` | ISO date | Filter runs before this date |
| `limit` | integer | Max results (default 50, max 100) |

**Response `200`**
```json
[
  {
    "id": "uuid",
    "status": "completed",
    "triggerType": "manual",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "startedAt": "2025-01-01T00:01:00.000Z",
    "finishedAt": "2025-01-01T00:02:00.000Z",
    "k6ExitCode": 0,
    "suiteRunId": null,
    "notes": "",
    "script": { "name": "load-test.js" },
    "config": { "name": "Production 100VU" }
  }
]
```

---

### `GET /runs/:id`

Get a single run with all related data.

**Response `200`**
```json
{
  "id": "uuid",
  "testConfigId": "uuid",
  "scriptId": "uuid",
  "projectId": "uuid",
  "userId": "uuid",
  "status": "completed",
  "statusMessage": null,
  "startedAt": "2025-01-01T00:01:00.000Z",
  "finishedAt": "2025-01-01T00:02:00.000Z",
  "k6ExitCode": 0,
  "triggerType": "manual",
  "optionsSnapshot": "{...}",
  "suiteRunId": null,
  "cloudRunId": null,
  "cloudRunUrl": null,
  "notes": "",
  "cloudResults": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "script": { "name": "load-test.js" },
  "config": { "name": "Production 100VU" },
  "results": [
    {
      "id": "uuid",
      "metricName": "http_req_duration",
      "metricType": "trend",
      "avg": 245.3,
      "min": 120.1,
      "max": 890.5,
      "med": 230.0,
      "p90": 400.2,
      "p95": 520.8,
      "p99": 780.4,
      "count": 1500
    }
  ],
  "thresholdResults": [
    {
      "id": "uuid",
      "metricName": "http_req_duration",
      "thresholdExpr": "p(95)<500",
      "passed": false,
      "actualValue": 520.8,
      "aborted": false
    }
  ]
}
```

**Errors:** `404` not found

---

### `PATCH /runs/:id/notes`

Update the notes field.

**Request Body:**
```json
{
  "notes": "Investigated the P95 spike — caused by DB connection pool exhaustion"
}
```

**Response `200`**
```json
{ "id": "uuid", "notes": "Investigated the P95 spike..." }
```

---

### `DELETE /runs/:id`

Delete a run.

**Response:** `200`
```json
{ "message": "Run deleted" }
```

---

### `POST /runs/:id/abort`

Abort a running test.

**Response `200`**
```json
{ "message": "Abort signal sent" }
```

**Side Effects:**
- Checks run status is `running`
- Sends abort message to RabbitMQ
- Updates run status to `aborted` and sets `finishedAt`

**Errors:** `400` run not running, `404` not found

---

### `GET /runs/:id/results`

Get aggregated test results for a run.

**Response `200`** — array of `TestResult` objects (same shape as `results` in GET run)

---

### `GET /runs/:id/thresholds`

Get threshold results for a run.

**Response `200`** — array of `ThresholdResult` objects

---

### `GET /runs/:id/log`

Get time-series metric points for a run.

**Response `200`** — array of `TestResultPoint`
```json
[
  {
    "id": 1,
    "testRunId": "uuid",
    "timestamp": "2025-01-01T00:01:05.000Z",
    "metricName": "http_req_duration",
    "metricValue": 245.3,
    "tags": "{\"url\":\"/api/users\",\"method\":\"GET\"}"
  }
]
```

**Notes:** Limited to 1000 most recent points, ordered by timestamp ascending.

---

### `GET /runs/:id/request-logs`

Get per-request HTTP logs.

**Response `200`** — array of `TestRequestLog`
```json
[
  {
    "id": "uuid",
    "testRunId": "uuid",
    "method": "GET",
    "url": "https://example.com/api/users",
    "status": 200,
    "body": null,
    "headers": "{\"Content-Type\":\"application/json\"}",
    "timing": 245.3,
    "timestamp": "2025-01-01T00:01:05.000Z"
  }
]
```

---

### `POST /runs/:id/cloud-sync`

Sync k6 Cloud run metadata and optionally fetch cloud metrics.

**Request Body:**
```json
{
  "cloudRunId": "k6-cloud-run-id",
  "cloudRunUrl": "https://app.k6.io/runs/..."
}
```

**Response `200`**
```json
{
  "cloudRunId": "k6-cloud-run-id",
  "cloudRunUrl": "https://app.k6.io/runs/...",
  "cloudResults": { "http_req_duration": { "avg": 250.0, ... } }
}
```

**Side Effects:**
- If `cloudRunId` is provided and the project has `k6CloudToken`, fetches metrics from k6 Cloud API (`https://api.k6.io/v3/test-runs/{cloudRunId}/metrics`)
- Upserts fetched metrics as `TestResult` records

**Errors:** `404` run not found

---

## 6. Suites

### `GET /projects/:pid/suites`

List all suites for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Smoke Test Suite",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "scripts": [
      {
        "id": "uuid",
        "suiteId": "uuid",
        "scriptId": "uuid",
        "order": 1,
        "script": { "id": "uuid", "name": "smoke-test-1.js" }
      },
      {
        "id": "uuid",
        "suiteId": "uuid",
        "scriptId": "uuid",
        "order": 2,
        "script": { "id": "uuid", "name": "smoke-test-2.js" }
      }
    ]
  }
]
```

---

### `POST /projects/:pid/suites`

Create a new suite.

**Request Body:**
```json
{
  "name": "Smoke Test Suite",
  "scriptIds": ["uuid-script-1", "uuid-script-2"]
}
```

**Notes:** Scripts are assigned order based on their position in the array (1-indexed).

**Response `201`** — created suite with scripts

---

### `GET /suites/:id`

Get a suite with full script content.

**Response `200`**
```json
{
  "id": "uuid",
  "name": "Smoke Test Suite",
  "scripts": [
    {
      "id": "uuid",
      "suiteId": "uuid",
      "scriptId": "uuid",
      "order": 1,
      "script": {
        "id": "uuid",
        "name": "smoke-test-1.js",
        "content": "import http from 'k6/http';..."
      }
    }
  ]
}
```

**Errors:** `404` not found

---

### `PUT /suites/:id`

Update suite name and/or script list.

**Request Body:**
```json
{
  "name": "Updated Suite Name",
  "scriptIds": ["uuid-script-3", "uuid-script-1"]
}
```

**Notes:** Replaces all script associations (deletes existing + re-creates with new order).

**Response `200`** — updated suite

---

### `DELETE /suites/:id`

Delete a suite.

**Response `200`**
```json
{ "message": "Deleted" }
```

**Side Effects:** All `TestSuiteScript` join records are deleted first.

---

### `POST /suites/:id/run`

Execute all scripts in a suite sequentially.

**Headers:** `Authorization: Bearer <token>` (user ID extracted)

**Response `200`**
```json
{
  "suiteRunId": "uuid-v4",
  "runs": [
    { "id": "uuid-run-1", "status": "running", "scriptId": "uuid-1", ... },
    { "id": "uuid-run-2", "status": "pending", "scriptId": "uuid-2", ... }
  ]
}
```

**Side Effects:**
- Creates a common `suiteRunId` (v4 UUID)
- Creates `TestRun` records for each script in the suite
- Only enqueues the **first** script to RabbitMQ (marks it `running`)
- Subsequent scripts are triggered by `advanceSuite()` after each completes

**Errors:** `404` suite not found

---

### `GET /suite-runs/:suiteRunId`

Get all runs within a suite execution.

**Response `200`**
```json
{
  "suiteRunId": "uuid-v4",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "runs": [
    { "id": "uuid", "script": { "name": "test-1.js" }, "status": "completed", ... },
    { "id": "uuid", "script": { "name": "test-2.js" }, "status": "running", ... }
  ]
}
```

**Errors:** `404` no runs found

---

### `GET /suites/:id/runs`

Get all suite run executions for a suite, grouped by suite run.

**Response `200`** — array of `TestRun` with `script.name`, ordered by most recent first

---

## 7. Workers

### `GET /projects/:pid/workers`

List workers for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "worker-1",
    "url": "http://192.168.1.50:6566",
    "status": "online",
    "capacity": 100,
    "launchType": "local",
    "namespace": "default",
    "lastHeartbeat": "2025-01-01T00:05:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "_count": {
      "assignments": 2
    }
  }
]
```

---

### `POST /projects/:pid/workers`

Register a new worker.

**Request Body:**
```json
{
  "name": "worker-2",
  "url": "http://10.0.0.10:6566",
  "capacity": 200,
  "launchType": "kubernetes",
  "namespace": "loadtest"
}
```

**Defaults:** `capacity`=100, `launchType`=`"local"`, `namespace`=`"default"`, `status`=`"offline"`

**Response `201`** — created worker

---

### `PATCH /workers/:id`

Update worker fields.

**Request Body** (partial):
```json
{
  "url": "http://new-address:6566",
  "capacity": 300
}
```

**Response `200`** — updated worker

---

### `DELETE /workers/:id`

Delete a worker.

**Response `200`**
```json
{ "message": "Worker deleted" }
```

---

### `POST /workers/heartbeat`

Receive heartbeat from a worker agent (called by the agent itself).

**Request Body:**
```json
{
  "name": "worker-1",
  "status": "online",
  "activeRuns": 2
}
```

**Notes:** Lookup is by `name`, not ID.

**Response `200`**
```json
{ "message": "Heartbeat received", "worker": { "id": "uuid", "status": "online", ... } }
```

**Errors:** `400` name required, `404` worker not found

---

### `POST /workers/:id/start`

Start a worker agent (local process or Kubernetes pod).

**Response `200`**
```json
{
  "message": "Worker agent started on port 6566",
  "launchType": "local"
}
```

**Side Effects (local):**
- Spawns `npx tsx worker-agent/src/index.ts` with env vars: `AGENT_NAME`, `AGENT_PORT`, `CENTRAL_API_URL`
- Tracks the child process in `spawnedAgents` Map
- Logs stdout/stderr

**Side Effects (Kubernetes):**
- Reads project's `k8sConfig` (namespace, image, pullPolicy)
- Calls `k8sManager.launchWorker()` to create pod via Kubernetes API
- Sets labels: `app=tenjint6-worker`, `worker={name}`

**Errors:** `404` not found, `400` K8s not configured, `409` already running locally, `500` K8s launch failed

---

### `POST /workers/:id/stop`

Stop a running worker agent.

**Response `200`**
```json
{ "message": "Worker agent stopped" }
```

**Side Effects (local):**
- Sends `SIGTERM` → waits 5 seconds → sends `SIGKILL`
- Updates status to `offline`
- Removes from `spawnedAgents` Map

**Side Effects (Kubernetes):**
- Calls `k8sManager.stopWorker()` to delete the pod

**Errors:** `404` not found or no running agent

---

### `GET /workers/:id/status`

Check if a worker is currently running.

**Response `200`**
```json
{
  "running": true,
  "launchType": "local",
  "pid": 54321
}
```

For K8s:
```json
{
  "running": true,
  "launchType": "kubernetes",
  "podPhase": "Running"
}
```

**Errors:** `404` not found

---

### `GET /workers/k8s-pods`

List all worker Kubernetes pods for a project.

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `projectId` | UUID | Yes |

**Response `200`**
```json
{
  "pods": [
    {
      "name": "worker-worker-1-abc123",
      "phase": "Running",
      "ip": "10.42.0.5",
      "node": "node-1",
      "age": "2h"
    }
  ]
}
```

**Errors:** `400` missing projectId

---

### `POST /projects/:pid/configs/:configId/distribute`

Distribute a test run across multiple worker agents.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "workerAssignments": [
    { "workerId": "uuid-1", "vus": 30 },
    { "workerId": "uuid-2", "vus": 70 }
  ]
}
```

**Response `201`**
```json
{
  "run": {
    "id": "uuid-run-id",
    "status": "running",
    "testConfigId": "uuid",
    ...
  },
  "dispatchResults": [
    { "workerId": "uuid-1", "workerName": "worker-1", "status": "accepted", "vus": 30 },
    { "workerId": "uuid-2", "workerName": "worker-2", "status": "accepted", "vus": 70 }
  ]
}
```

**Side Effects:**
- Fetches config + script, merges env vars, replaces `__TARGET_URL__`
- Creates a single `TestRun` with status `distributing`
- Creates `WorkerRunAssignment` records for each worker
- HTTP POSTs to each worker's `{workerUrl}/run` with worker-specific options (VU range: `vusStart`, `vusEnd`)
- If all workers accept → status set to `running`
- If any worker fails → sets its assignment to `failed` with reason

**Errors:** `404` config not found, `400` no online workers

---

### `POST /runs/:id/metrics`

Ingest a real-time metric point (called by worker agents).

**Request Body:**
```json
{
  "type": "Point",
  "metricName": "http_req_duration",
  "metricValue": 245.3,
  "timestamp": "2025-01-01T00:01:05.000Z",
  "tags": { "url": "/api/users", "method": "GET" }
}
```

**Response `200`**
```json
{ "accepted": true }
```

**Side Effects:**
- Feeds point to `ResultIngester.ingestPoint()` (buffered batch insert)
- Broadcasts via WebSocket (`broadcastMetric()`)

---

### `POST /runs/:id/complete`

Report run completion from a worker agent.

**Request Body:**
```json
{
  "exitCode": 0,
  "requestLogs": [
    { "method": "GET", "url": "/api/users", "status": 200, "timing": 245.3, "timestamp": "..." }
  ],
  "cloudRunUrl": "https://app.k6.io/runs/...",
  "cloudRunId": "k6-cloud-run-id"
}
```

**Response `200`**
```json
{ "accepted": true }
```

**Side Effects:**
- Calls `resultIngester.aggregateAndFinalize()` (flushes points → aggregates → evaluates thresholds/alerts/SLA)
- Persists request logs via `testRequestLog.createMany`
- Stores cloud run URL/ID
- Marks `WorkerRunAssignment` as completed/failed
- If all assignments are done, marks parent `TestRun` as completed/failed
- Calls `advanceSuite()` if this run is part of a suite

---

### `POST /runs/:id/status`

Update assignment status from a worker agent.

**Request Body:**
```json
{
  "status": "running"
}
```

**Response `200`**
```json
{ "accepted": true }
```

**Side Effects:** Updates status on `WorkerRunAssignment` records that are currently `pending`, and updates parent run status.

---

### `GET /runs/:id/assignments`

Get all worker assignments for a distributed run.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "runId": "uuid",
    "workerId": "uuid",
    "vus": 30,
    "status": "completed",
    "reason": null,
    "startedAt": "2025-01-01T00:01:00.000Z",
    "finishedAt": "2025-01-01T00:02:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "worker": { "name": "worker-1", "url": "http://10.0.0.10:6566" }
  }
]
```

---

## 8. Schedules

### `GET /projects/:pid/schedules`

List all schedules for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "testConfigId": "uuid",
    "name": "Hourly Smoke Test",
    "cronExpr": "0 * * * *",
    "enabled": true,
    "lastRunAt": "2025-01-01T01:00:00.000Z",
    "nextRunAt": "2025-01-01T02:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "config": {
      "name": "Smoke 1VU",
      "scriptId": "uuid"
    },
    "lastRun": {
      "id": "uuid",
      "status": "completed",
      "createdAt": "2025-01-01T01:00:05.000Z"
    }
  }
]
```

---

### `GET /configs/:id/schedules`

List schedules for a specific config.

**Response `200`** — array of `Schedule` objects

---

### `POST /projects/:pid/schedules`

Create a schedule.

**Request Body:**
```json
{
  "name": "Daily Load Test",
  "configId": "uuid-config",
  "cronExpression": "0 6 * * *",
  "enabled": true
}
```

**Response `201`** — created schedule

**Side Effects:** Registers a node-cron job with the scheduler.

**Errors:** `404` config not found

---

### `POST /configs/:id/schedules`

Backward-compatible schedule creation (no `name` required).

**Request Body:**
```json
{
  "cronExpr": "0 6 * * *",
  "enabled": true
}
```

**Response `201`** — created schedule

---

### `PATCH /schedules/:id`

Enable/disable a schedule.

**Request Body:**
```json
{
  "enabled": false
}
```

**Response `200`** — updated schedule

**Side Effects:** Calls `scheduler.updateSchedule()` to add/remove the cron job.

---

### `PUT /schedules/:id`

Full update of schedule fields.

**Request Body:**
```json
{
  "name": "Updated Schedule",
  "cronExpression": "0 12 * * *",
  "enabled": true
}
```

**Response `200`** — updated schedule

---

### `DELETE /schedules/:id`

Delete a schedule.

**Response:** `204` No Content

**Side Effects:** Removes the cron job from the scheduler, then deletes from DB.

---

### `POST /schedules/:id/run`

Execute a schedule immediately.

**Headers:** `Authorization: Bearer <token>`

**Response `201`** — created `TestRun` with `triggerType: 'schedule'`

**Errors:** `404` schedule not found, `400` no linked config

---

## 9. Environments

### `GET /projects/:pid/environments`

List environments for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Staging",
    "baseUrl": "https://staging.example.com",
    "variables": { "API_KEY": "sk-test-123" },
    "isDefault": true
  }
]
```

**Notes:** Ordered by `isDefault desc`, then `name asc`. Variables parsed from JSON string.

---

### `POST /projects/:pid/environments`

Create an environment.

**Request Body:**
```json
{
  "name": "Production",
  "baseUrl": "https://api.example.com",
  "variables": { "API_KEY": "sk-prod-456" }
}
```

**Notes:** The first environment created for a project is automatically set as `isDefault: true`.

**Response `201`** — created environment

---

### `PUT /environments/:id`

Full replace update of an environment.

**Request Body:**
```json
{
  "name": "Updated Name",
  "baseUrl": "https://new-url.example.com",
  "variables": { "KEY": "value" }
}
```

**Response `200`** — updated environment

---

### `DELETE /environments/:id`

Delete an environment.

**Response:** `204` No Content

**Side Effects:** If deleting the default environment, the next alphabetically-first environment becomes the new default.

**Errors:** `404` not found

---

### `POST /environments/:id/set-default`

Set an environment as the default.

**Response `200`**
```json
{ "message": "Default environment updated" }
```

**Side Effects:** Unsets `isDefault` on all environments in the same project, then sets the target as default.

**Errors:** `404` not found

---

## 10. Members

### `GET /projects/:pid/members`

List project members.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "userId": "uuid",
    "role": "admin",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "user"
    }
  }
]
```

---

### `POST /projects/:pid/members`

Add a member to the project.

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "member"
}
```

**Note:** Default role is `member`. Available roles: `admin`, `member`, `viewer`.

**Response `201`** — created member with user details

**Errors:** `404` user not found (by email), `409` already a member

---

### `PUT /projects/:pid/members/:memberId`

Update a member's role.

**Request Body:**
```json
{
  "role": "viewer"
}
```

**Response `200`** — updated member

---

### `DELETE /projects/:pid/members/:memberId`

Remove a member.

**Response:** `204` No Content

---

### `PATCH /members/:id`

Alias for updating a member's role (uses member ID directly).

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response `200`** — updated member

---

### `DELETE /members/:id`

Alias for removing a member (uses member ID directly).

**Response:** `204` No Content

---

## 11. Alerts

### `GET /projects/:pid/alerts`

List all alert rules for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "High Latency Alert",
    "description": "Alert when P95 exceeds 500ms",
    "metricName": "http_req_duration",
    "condition": "gt",
    "threshold": 500,
    "channelType": "slack",
    "channelConfig": { "webhookUrl": "https://hooks.slack.com/..." },
    "enabled": true,
    "cooldownMinutes": 10,
    "lastTriggeredAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /projects/:pid/alerts`

Create an alert rule.

**Request Body:**
```json
{
  "name": "Error Rate Alert",
  "description": "Alert when error rate exceeds 1%",
  "metricName": "http_req_failed",
  "condition": "gt",
  "threshold": 0.01,
  "channelType": "slack",
  "channelConfig": { "webhookUrl": "https://hooks.slack.com/..." },
  "enabled": true,
  "cooldownMinutes": 5
}
```

**Constraints:**
- `condition`: one of `gt`, `lt`, `gte`, `lte`, `eq`
- `channelType`: one of `slack`, `webhook`, `email`
- `name`: 1–255 characters

**Response `201`** — created alert rule

---

### `PUT /alerts/:id`

Update an alert rule (partial update).

**Request Body** (partial):
```json
{
  "threshold": 800,
  "enabled": false
}
```

**Response `200`** — updated alert rule

---

### `DELETE /alerts/:id`

Delete an alert rule.

**Response:** `204` No Content

---

### `GET /projects/:pid/alerts/history`

Get alert event history.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "alertRuleId": "uuid",
    "runId": "uuid",
    "metricName": "http_req_duration",
    "metricValue": 520.8,
    "condition": "gt",
    "threshold": 500,
    "channelType": "slack",
    "sent": true,
    "error": null,
    "createdAt": "2025-01-01T00:02:00.000Z",
    "alertRule": { "name": "High Latency Alert" }
  }
]
```

**Notes:** Limited to the last 100 events, ordered by `createdAt desc`.

---

## 12. SLA

### `GET /projects/:pid/sla/rules`

List all SLA rules for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "scriptId": "uuid",
    "name": "API Latency SLA",
    "description": "P95 must be under 500ms",
    "metric": "http_req_duration",
    "condition": "lt",
    "threshold": 500,
    "timeWindow": 24,
    "enabled": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "_count": { "breaches": 3 },
    "script": { "id": "uuid", "name": "api-test.js" }
  }
]
```

---

### `POST /projects/:pid/sla/rules`

Create an SLA rule.

**Request Body:**
```json
{
  "name": "API Latency SLA",
  "description": "P95 must be under 500ms",
  "scriptId": "uuid-or-null",
  "metric": "http_req_duration",
  "condition": "lt",
  "threshold": 500,
  "timeWindow": 24,
  "enabled": true
}
```

**Constraints:**
- `metric`: one of `http_req_duration`, `http_req_failed`, `http_reqs`, `iterations`
- `condition`: one of `lt`, `gt`, `lte`, `gte`
- `timeWindow`: integer between 1 and 8760 (hours), default 24

**Response `201`** — created SLA rule

---

### `PUT /sla/rules/:id`

Update an SLA rule (partial update).

**Response `200`** — updated SLA rule

---

### `PATCH /sla/rules/:id/toggle`

Toggle the `enabled` flag.

**Response `200`** — updated SLA rule with toggled `enabled`

**Errors:** `404` not found

---

### `DELETE /sla/rules/:id`

Delete an SLA rule.

**Response:** `204` No Content

---

### `GET /projects/:pid/sla/status`

Evaluate compliance for all enabled SLA rules.

**Response `200`**
```json
{
  "statuses": [
    {
      "ruleId": "uuid",
      "name": "API Latency SLA",
      "metric": "http_req_duration",
      "condition": "lt",
      "threshold": 500,
      "compliant": true,
      "runsAnalyzed": 10,
      "actualValue": 320.5,
      "lastBreachAt": null
    }
  ],
  "evaluatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Notes:** Averages metric values across completed runs within the `timeWindow`. Checks condition against threshold.

---

### `GET /projects/:pid/sla/breaches`

List SLA breaches for a project.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `ruleId` | UUID | Optional filter by rule |

**Response `200`** — array of `SlaBreach` with `slaRule` and `run` details, last 100 breaches

---

### `GET /sla/rules/:id/breaches`

List breaches for a specific SLA rule.

**Response `200`** — array of `SlaBreach`, last 100 breaches

---

### `GET /projects/:pid/sla/report`

Generate a 7-day SLA compliance report.

**Response `200`**
```json
{
  "projectId": "uuid",
  "generatedAt": "2025-01-07T00:00:00.000Z",
  "reportWindow": "168h",
  "overallCompliance": 97.5,
  "totalRules": 5,
  "enabledRules": 4,
  "totalBreaches": 3,
  "rules": [
    {
      "ruleId": "uuid",
      "name": "API Latency SLA",
      "compliancePercent": 100.0,
      "compliantRuns": 42,
      "breachedRuns": 0,
      "totalBreaches": 0
    }
  ]
}
```

---

## 13. Dashboards

### `GET /projects/:pid/dashboards`

List dashboards for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "My Dashboard",
    "widgets": "[{\"type\":\"line-chart\",\"metric\":\"http_req_duration\",...}]",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /projects/:pid/dashboards`

Create a dashboard.

**Request Body:**
```json
{
  "name": "Performance Overview",
  "widgets": "[{\"type\":\"metric-card\",\"metric\":\"http_req_duration\"}]"
}
```

**Notes:** Default `widgets` is `'[]'` if not provided.

**Response `201`** — created dashboard

**Errors:** `404` project not found

---

### `GET /dashboards/:id`

Get a single dashboard.

**Response `200`** — dashboard object

**Errors:** `404` not found

---

### `PUT /dashboards/:id`

Update a dashboard (partial update).

**Request Body:**
```json
{
  "name": "Updated Name",
  "widgets": "[{\"type\":\"line-chart\",...}]"
}
```

**Response `200`** — updated dashboard

**Errors:** `404` not found

---

### `DELETE /dashboards/:id`

Delete a dashboard.

**Response:** `204` No Content

**Errors:** `404` not found

---

## 14. Plans

### `GET /projects/:pid/plans`

List test plans for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Release 2.0 Smoke Tests",
    "description": "Block-based test plan for verification",
    "blocks": "[{\"type\":\"run-script\",\"scriptId\":\"uuid\"},...]",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "_count": { "scripts": 3 }
  }
]
```

---

### `POST /projects/:pid/plans`

Create a test plan.

**Request Body:**
```json
{
  "name": "Release 2.0 Smoke Tests",
  "description": "Block-based test plan",
  "blocks": "[{\"type\":\"run-script\",\"scriptId\":\"uuid\"}]"
}
```

**Response `201`** — created test plan

---

### `GET /plans/:id`

Get a test plan with its scripts.

**Response `200`**
```json
{
  "id": "uuid",
  "name": "Release 2.0 Smoke Tests",
  "scripts": [
    { "id": "uuid", "name": "smoke-test.js", "version": 2 }
  ],
  "...": "..."
}
```

**Errors:** `404` not found

---

### `PUT /plans/:id`

Update a test plan (partial update).

**Response `200`** — updated test plan

**Errors:** `404` not found

---

### `DELETE /plans/:id`

Delete a test plan.

**Response:** `204` No Content

**Errors:** `404` not found

---

## 15. Templates

### `GET /templates`

List available script templates.

**Response `200`**
```json
[
  {
    "id": "rest-api-basic",
    "name": "REST API - Basic CRUD",
    "description": "Template for testing REST API endpoints",
    "category": "REST API",
    "code": "import http from 'k6/http';\n...",
    "blocks": []  // optional — pre-built block tree for visual editor
  }
]
```

**Notes:** Returns built-in templates across categories: REST API, WebSocket, gRPC, GraphQL, Browser, Load Test, Monitoring, Integration, Database. Some templates include a `blocks` field with a pre-built block tree that preserves parent-child nesting (group → http-request → check) when imported into the visual editor.

---

### `POST /templates/use`

Create a script from a template.

**Request Body:**
```json
{
  "templateId": "rest-api-basic",
  "projectId": "uuid-project",
  "name": "My API Test"
}
```

**Response `201`** — created `Script` with template content

**Errors:** `404` template not found

---

## 16. CSV / Data Files

### `GET /projects/:pid/csv`

List CSV data files for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "Users Data",
    "filename": "users_data.csv",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /projects/:pid/csv`

Create a CSV data file.

**Request Body:**
```json
{
  "name": "Users Data",
  "content": "id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com"
}
```

**Notes:** Filename is auto-generated from `name` (snake_case + .csv).

**Response `201`**
```json
{
  "id": "uuid",
  "name": "Users Data",
  "filename": "users_data.csv",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### `GET /csv/:id`

Get the full CSV file content.

**Response `200`**
```json
{
  "id": "uuid",
  "name": "Users Data",
  "filename": "users_data.csv",
  "content": "id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Errors:** `404` not found

---

### `DELETE /csv/:id`

Delete a CSV file.

**Response:** `204` No Content

---

## 17. Validation

### `POST /scripts/validate`

Lint a k6 script without running it.

**Request Body:**
```json
{
  "content": "import http from 'k6/http';\nexport default function() { http.get('https://test.com'); }"
}
```

**Response `200`**
```json
{
  "valid": true,
  "issues": []
}
```

**On issues:**
```json
{
  "valid": false,
  "issues": [
    { "line": 3, "message": "HTTP request without check()", "severity": "warning" },
    { "line": 5, "message": "Missing semicolon", "severity": "error" }
  ]
}
```

**Checks performed:**
- Unknown imports (not `k6/` or relative paths)
- HTTP requests without `check()`
- Missing semicolons
- Missing `export default function` or `export default class`
- Missing `export const options`

---

## 18. Correlation & Recording

### `POST /correlation/analyze`

Analyze captured requests for dynamic parameters.

**Request Body:**
```json
{
  "targetUrl": "https://api.example.com",
  "requests": [
    {
      "method": "GET",
      "url": "https://api.example.com/login",
      "headers": { "Content-Type": "application/json" },
      "body": "{\"username\":\"test\",\"password\":\"test\"}",
      "statusCode": 200,
      "responseHeaders": { "Set-Cookie": "session=abc123" },
      "responseBody": "{\"token\":\"jwt-token-here\"}",
      "timestamp": "2025-01-01T00:00:00.000Z",
      "durationMs": 150
    }
  ]
}
```

**Notes:** If `requests` is omitted, uses the in-memory `capturedRequests` from the recording proxy. Replays up to 20 requests against `targetUrl`, compares recorded vs replayed responses. Detects dynamic values (CSRF tokens, JWT, session IDs, etc.).

**Response `200`**
```json
{
  "suggestions": [
    {
      "variableName": "auth_token",
      "extractLocation": "body",
      "extractPath": "$.token",
      "extractType": "jsonpath",
      "requestIndex": 0
    }
  ],
  "diffs": [],
  "count": 1
}
```

**Errors:** `400` missing `targetUrl`

---

### `POST /correlation/generate-blocks`

Generate script blocks for extracting variables.

**Request Body:**
```json
{
  "rules": [
    {
      "variableName": "auth_token",
      "extractLocation": "body",
      "extractPath": "$.token",
      "extractType": "jsonpath",
      "begin": null,
      "end": null,
      "pattern": null,
      "requestIndex": 0
    }
  ]
}
```

**Response `200`**
```json
{
  "blocks": [
    {
      "type": "extract-variable",
      "label": "Extract auth_token",
      "properties": { "variableName": "auth_token", ... }
    }
  ],
  "count": 1
}
```

---

### `POST /recording/start`

Start the forward proxy recording session.

**Request Body:**
```json
{
  "targetUrl": "https://api.example.com"
}
```

**Response `200`**
```json
{
  "message": "Recording started. Configure your browser/system to use this server as HTTP proxy.",
  "targetUrl": "https://api.example.com",
  "instructions": "Set proxy to http://<host>:3001/api/v1/recording/proxy"
}
```

**Side Effects:** Clears captured requests, sets `recordingEnabled = true`.

---

### `POST /recording/stop`

Stop recording.

**Response `200`**
```json
{
  "message": "Recording stopped",
  "captured": 42
}
```

---

### `GET /recording/captured`

Get all captured requests.

**Response `200`**
```json
{
  "captured": [
    { "method": "GET", "url": "https://api.example.com/users", "statusCode": 200, ... }
  ],
  "count": 42,
  "recording": false,
  "targetUrl": "https://api.example.com"
}
```

---

### `POST /recording/clear`

Clear captured requests.

**Response `200`**
```json
{ "message": "Captured requests cleared" }
```

---

### `POST /recording/generate`

Convert captured requests to script blocks.

**Response `200`**
```json
{
  "blocks": [
    { "type": "http-request", "label": "GET /users", "properties": { ... } },
    { "type": "check", "label": "Status is 200", "properties": { ... } },
    { "type": "extract-variable", "label": "Extract csrf_token", "properties": { ... } }
  ],
  "count": 15,
  "proxyTarget": "https://api.example.com"
}
```

---

### `ALL /recording/proxy/*`

Forward proxy endpoint. Intercepts HTTP requests, captures request/response pairs, and forwards to the target.

**Path:** Any subpath after `/recording/proxy`

**Notes:**
- Requires recording to be started first (400 if not started)
- Captures up to 1000 entries (FIFO)
- Uses `http-proxy` library for forwarding

**Error:** `400` recording not started

---

## 19. Git

### `GET /projects/:pid/git`

List linked Git repositories.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Main Repo",
    "repoUrl": "https://github.com/org/repo.git",
    "branch": "main",
    "authToken": "••••••••",
    "lastSyncedAt": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Note:** `authToken` is always masked as `'••••••••'` in responses.

---

### `POST /projects/:pid/git`

Link a Git repository.

**Request Body:**
```json
{
  "name": "Main Repo",
  "repoUrl": "https://github.com/org/repo.git",
  "branch": "main",
  "authToken": "ghp_abc123"
}
```

**Response `201`** — created git repo (with masked token)

---

### `DELETE /git/:id`

Remove a linked Git repository.

**Response:** `204` No Content

---

### `POST /scripts/:sid/git-push`

Push a script to its linked Git repository.

**Response `200`**
```json
{ "message": "Pushed to git" }
```

**Side Effects:** Calls `pushScriptToGit(scriptId)` from `lib/gitSync.js`.

**Errors:** `400` push failed

---

### `POST /projects/:pid/git-pull`

Pull scripts from linked Git repositories.

**Response `200`**
```json
{ "message": "Pulled from git" }
```

**Side Effects:** Calls `pullScriptsFromGit(projectId)` from `lib/gitSync.js`.

**Errors:** `400` pull failed

---

## 20. Export

### `GET /runs/:id/export/json`

Export run results as a JSON file download.

**Response `200`** — JSON file attachment (`Content-Disposition: attachment; filename="run-{id}.json"`)

**Response Body:**
```json
{
  "run": { "id": "uuid", "status": "completed", ... },
  "metrics": [
    { "metricName": "http_req_duration", "avg": 245.3, "min": 120.1, "max": 890.5, "med": 230.0, "p90": 400.2, "p95": 520.8, "p99": 780.4, "count": 1500 },
    { "metricName": "http_req_failed", "rate": 0.005, "count": 1500 }
  ],
  "thresholds": [
    { "metricName": "http_req_duration", "thresholdExpr": "p(95)<500", "passed": false, "actualValue": 520.8 }
  ]
}
```

**Errors:** `404` run not found

---

### `GET /runs/:id/export/csv`

Export run metrics as a CSV file download.

**Headers:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="run-{id}.csv"`

**Response:** CSV file with columns: `metricName,avg,min,max,med,p90,p95,p99,count`

---

### `GET /runs/:id/export/junit`

Export run results as JUnit XML for CI/CD integration.

**Headers:** `Content-Type: application/xml`, `Content-Disposition: attachment; filename="run-{id}.xml"`

**Response:** JUnit XML with:
- Each threshold result mapped to a `<testcase>` (passed/failed)
- Failed request rate mapped to `<error>` elements
- `<testsuite>` with `tests`, `failures`, `errors` attributes

---

### `GET /runs/:id/export/html`

Generate a self-contained HTML report.

**Headers:** `Content-Type: text/html`, `Content-Disposition: attachment; filename="run-{id}.html"`

**Response:** Full HTML page with:
- Status badge (inline SVG)
- Chart.js bar chart for metrics
- Metrics table (avg, min, max, p90, p95, p99)
- Threshold results (pass/fail)

---

## 21. Plugins

### `GET /projects/:pid/plugins`

List installed plugins.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Slack Notifier",
    "description": "Sends test results to Slack",
    "repoUrl": "https://github.com/org/plugin-slack",
    "version": "1.0.0",
    "enabled": true,
    "installedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /projects/:pid/plugins`

Install a plugin.

**Request Body:**
```json
{
  "name": "Slack Notifier",
  "description": "Sends test results to Slack",
  "repoUrl": "https://github.com/org/plugin-slack",
  "version": "1.0.0"
}
```

**Notes:** No Zod validation (raw body destructuring). Always created as `enabled: true`.

**Response `201`** — created plugin

---

### `PATCH /plugins/:id`

Update plugin fields (e.g. toggle enabled).

**Request Body:**
```json
{
  "enabled": false
}
```

**Response `200`** — updated plugin

---

### `DELETE /plugins/:id`

Remove a plugin.

**Response `200`**
```json
{ "message": "Plugin removed" }
```

---

## 22. Database Connections

### `GET /projects/:pid/db-connections`

List database connections for a project.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Production DB",
    "type": "postgres",
    "host": "db.example.com",
    "port": 5432,
    "database": "app_production",
    "username": "readonly",
    "password": "",
    "ssl": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /projects/:pid/db-connections`

Create a database connection config.

**Request Body:**
```json
{
  "name": "Production DB",
  "type": "postgres",
  "host": "db.example.com",
  "port": 5432,
  "database": "app_production",
  "username": "readonly",
  "password": "secret123",
  "ssl": true
}
```

**Constraints:**
- `type`: one of `postgres`, `mysql`, `sqlserver`, `sqlite`
- `host`: default `localhost`
- `port`: coerced to integer, default based on type
- `ssl`: coerced to boolean, default `false`

**Response `201`** — created connection

---

### `GET /db-connections/:id`

Get a single database connection.

**Response `200`** — connection object

**Errors:** `404` not found

---

### `PUT /db-connections/:id`

Update a database connection.

**Response `200`** — updated connection

**Errors:** `404` not found

---

### `DELETE /db-connections/:id`

Delete a database connection.

**Response:** `204` No Content

**Errors:** `404` not found

---

## 23. Personal Access Tokens

### `GET /pats`

List personal access tokens for the authenticated user.

**Headers:** `Authorization: Bearer <token>` (required)

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "CI/CD Token",
    "scopes": ["*"],
    "expiresAt": null,
    "lastUsedAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Notes:** `tokenHash` is never returned. `token` value is only returned once at creation.

---

### `POST /pats`

Create a personal access token.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "name": "CI/CD Token",
  "scopes": ["*"],
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "name": "CI/CD Token",
  "token": "gp6_a1b2c3d4e5f6...",
  "scopes": ["*"],
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**⚠️ Important:** The plaintext `token` is returned **only once**. Store it securely.

**Token format:** `gp6_{32 random bytes as hex}` (64 hex characters)

---

### `DELETE /pats/:id`

Revoke a personal access token.

**Headers:** `Authorization: Bearer <token>` (required)

**Response `200`**
```json
{ "message": "Revoked" }
```

**Errors:** `404` not found or not owned by user

---

## 24. Webhooks / API Keys

### `POST /keys`

Create a webhook API key.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "name": "GitHub Actions Key"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "name": "GitHub Actions Key",
  "key": "gk6_a1b2c3d4e5f6...",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Token format:** `gk6_{32 random bytes as hex}` (64 hex characters)

**Errors:** `401` not authenticated

---

### `GET /keys`

List webhook API keys.

**Headers:** `Authorization: Bearer <token>` (required)

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "GitHub Actions Key",
    "key": "gk6_a1b2c3d4e5f6...",
    "lastUsedAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Errors:** `401` not authenticated

---

### `DELETE /keys/:id`

Delete a webhook API key.

**Headers:** `Authorization: Bearer <token>` (required)

**Response:** `204` No Content

**Errors:** `401` not authenticated

---

### `POST /trigger`

CI/CD webhook trigger — run a test from external CI/CD pipeline.

**Headers:** `Authorization: <apiKey>` (the `gk6_` key value)

**Request Body:**
```json
{
  "configId": "uuid-config"
}
```

**Response `201`**
```json
{
  "runId": "uuid",
  "status": "pending"
}
```

**Side Effects:**
- Looks up API key by value, updates `lastUsedAt`
- Creates `TestRun` with `triggerType: 'api'`
- Enqueues job to RabbitMQ

**Errors:** `401` missing/invalid API key, `404` config not found

---

## 25. Retention & Purge

### `GET /projects/:pid/retention`

Get data retention statistics.

**Response `200`**
```json
{
  "totalRuns": 500,
  "totalPoints": 150000,
  "oldestRunAt": "2024-06-01T00:00:00.000Z",
  "latestRunAt": "2025-01-01T00:00:00.000Z"
}
```

---

### `POST /projects/:pid/purge`

Purge old test runs.

**Request Body:**
```json
{
  "olderThanDays": 90
}
```

**Response `200`**
```json
{
  "deletedRuns": 123,
  "message": "Purged 123 runs older than 90 days"
}
```

**Notes:** Minimum `olderThanDays` is 1. Deletes runs + all cascaded data (results, points, thresholds, request logs, assignments, SLA breaches).

---

## 26. Audit Logs

### `GET /projects/:pid/audit-logs`

Get paginated audit log entries.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page |

**Response `200`**
```json
{
  "logs": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "userId": "uuid",
      "action": "run.trigger",
      "entity": "TestRun",
      "entityId": "uuid",
      "details": "Triggered load test from config 'Production 100VU'",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "total": 500,
  "page": 1,
  "totalPages": 10
}
```

---

## 27. Regression

### `POST /scripts/:id/regression`

Analyze performance regression for a script.

**Request Body:**
```json
{
  "baselineRunId": "uuid-optional-baseline"
}
```

**Response `200`**
```json
{
  "scriptId": "uuid",
  "scriptName": "load-test.js",
  "baseline": {
    "runId": "uuid",
    "avg": 200.0,
    "p95": 400.0,
    "p99": 600.0,
    "source": "rolling_avg_last_5"
  },
  "current": {
    "runId": "uuid",
    "avg": 245.3,
    "p95": 520.8,
    "p99": 780.4
  },
  "regression": [
    {
      "metric": "http_req_duration",
      "baselineValue": 200.0,
      "currentValue": 245.3,
      "changePercent": 22.65,
      "direction": "regressed",
      "severity": "medium"
    }
  ],
  "summary": {
    "metricsCompared": 5,
    "regressions": 1,
    "improvements": 2,
    "totalRuns": 50
  }
}
```

**Notes (auto-selection of baseline):**
1. If `baselineRunId` is provided, use that run
2. Otherwise use rolling average of last 5 completed runs
3. Fall back to a single prior run
4. Error if insufficient data

**Classification:**
- Metrics are classified as lower-is-better (`http_req_duration`, `http_req_failed`) or higher-is-better (`http_reqs`, `iterations`)
- `direction`: `improved`, `regressed`, or `unchanged`
- `severity`: `high` (>20% change), `medium` (5–20%), `none` (<5%)

**Errors:** `404` baseline run not found

---

## 28. Comparison

### `POST /runs/compare`

Compare two test runs side by side.

**Request Body:**
```json
{
  "runIds": ["uuid-run-a", "uuid-run-b"]
}
```

**Constraints:** Exactly 2 run IDs are required.

**Response `200`**
```json
{
  "runs": [
    { "id": "uuid", "name": "Run A (2025-01-01)", "createdAt": "2025-01-01T00:00:00.000Z" },
    { "id": "uuid", "name": "Run B (2025-01-02)", "createdAt": "2025-01-02T00:00:00.000Z" }
  ],
  "diff": [
    {
      "name": "http_req_duration",
      "runA": { "value": 200.0, "p95": 380.0, "p99": 550.0, "count": 1500 },
      "runB": { "value": 245.3, "p95": 520.8, "p99": 780.4, "count": 1500 },
      "changePercent": 22.65
    }
  ]
}
```

**Errors:** `400` invalid body, `404` one/both runs not found

---

## 29. Dashboard API

### `GET /projects/:pid/dashboard/summary`

Get summary statistics for the project dashboard.

**Response `200`**
```json
{
  "totalRuns": 150,
  "passedRuns": 130,
  "failedRuns": 20,
  "passRate": 86.67,
  "avgDuration": 45.5,
  "recentResults": [
    { "avg": 245.3, "createdAt": "2025-01-01T00:00:00.000Z" }
  ]
}
```

**Notes:**
- `passRate` is percentage of completed runs with `exitCode === 0`
- `avgDuration` is average of `http_req_duration` across last 20 runs
- `recentResults` is last 20 runs' average duration for trend sparkline

---

### `GET /projects/:pid/dashboard/trend`

Get trend data for charts.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "duration": 245.3,
    "p95": 520.8,
    "p99": 780.4
  }
]
```

**Notes:** Returns last 30 completed runs with `http_req_duration` avg, p95, p99.

---

## Appendix: WebSocket

### `GET /api/v1/ws?runId=<uuid>`

Upgrade to WebSocket for real-time metric streaming.

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `runId` | UUID | Yes |

**Protocol:**

**Server → Client messages:**
```json
// Metric point
{ "type": "metric", "data": { "metricName": "http_req_duration", "metricValue": 245.3, "timestamp": "...", "tags": {} } }

// Status update
{ "type": "status", "status": "completed" }
```

**Errors:**
- `4001` — missing `runId` query parameter (close code)

---

## Appendix: Error Response Format

All errors follow a consistent format:

```json
{
  "message": "Human-readable error description",
  "errors": [
    {
      "code": "too_small",
      "field": "name",
      "message": "Name must be at least 1 character"
    }
  ]
}
```

- `400` — Zod validation errors include `errors` array with field-level details
- `500` — only `message`, never exposes stack traces

---

## Appendix: Common Headers

| Header | Required For | Value |
|--------|-------------|-------|
| `Authorization: Bearer <jwt>` | Protected routes | JWT from `/login` or `/signup` |
| `Authorization: <apiKey>` | `/trigger` webhook | `gk6_` API key |
| `Content-Type: application/json` | All requests with body | Fixed value |
