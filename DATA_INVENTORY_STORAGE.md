# TenjinT6 — Complete Data Inventory, Execution Ingestion Pipeline & Storage Topology

This document provides a comprehensive, exhaustive reference on **what all data exists across the TenjinT6 platform**, **how execution metrics are ingested and stored in real-time vs. post-run**, and **the exact physical locations where every category of data lives across our architecture**.

---

## Table of Contents
1. [What All Data We Have (10 Data Categories)](#1-what-all-data-we-have-10-data-categories)
2. [How Execution Data Is Stored (Two-Tier Pipeline)](#2-how-execution-data-is-stored-two-tier-pipeline)
   - [Tier 1: Hot Real-Time Ingestion (`TestResultPoint`)](#21-tier-1-hot-real-time-ingestion-testresultpoint)
   - [Tier 2: Cold Statistical Aggregation (`TestResult`)](#22-tier-2-cold-statistical-aggregation-testresult)
3. [Where All We Are Having It (5 Physical Storage Tiers)](#3-where-all-we-are-having-it-5-physical-storage-tiers)
   - [Location 1: Relational Database (`DATABASE_URL`)](#31-location-1-relational-database-database_url)
   - [Location 2: In-Memory RAM State & Caching (`Node.js / Zustand`)](#32-location-2-in-memory-ram-state--caching-nodejs--zustand)
   - [Location 3: Message Queue Broker (`RABBITMQ_URL`)](#33-location-3-message-queue-broker-rabbitmq_url)
   - [Location 4: File System & Object Storage (`MinIO / Disk`)](#34-location-4-file-system--object-storage-minio--disk)
   - [Location 5: External Cloud Streams (`Prometheus / k6 Cloud`)](#35-location-5-external-cloud-streams-prometheus--k6-cloud)
4. [Data Lifecycle & Retention Strategy](#4-data-lifecycle--retention-strategy)

---

## 1. What All Data We Have (10 Data Categories)

Across the entire platform, data is organized into **10 core domain categories** managed via our database schemas and storage controllers:

| # | Data Category | Key Entities / Database Models | Description of Stored Data |
| :---: | :--- | :--- | :--- |
| **1** | **Identity & RBAC Data** | `User`, `Project`, `ProjectMember`, `ApiKey`, `PersonalAccessToken` | User accounts, encrypted bcrypt password hashes, project workspaces, team role assignments (`admin`, `editor`, `executor`, `viewer`), API keys (`api_keys`), and scoped PATs. |
| **2** | **Test Design & Code Data** | `TestPlan`, `Script`, `ScriptVersion`, `TestSuite`, `TestSuiteScript` | Visual Block Editor JSON trees (`blocks`), compiled k6 JavaScript code (`content`), version histories (`v1, v2...`), environment variables (`envVars`), and ordered multi-script execution suites. |
| **3** | **Configuration & Environment Data** | `TestConfig`, `Environment`, `Schedule`, `DatabaseConnection` | Execution options (`vus`, `duration`, `iterations`, `scenarios`, `thresholds`), target base URLs (`TARGET_URL`), cron schedules (`0 */6 * * *`), and external database connection strings. |
| **4** | **Execution Snapshot Data** | `TestRun`, `WorkerRunAssignment` | Immutable record of every triggered test run (`status`: `pending`/`running`/`completed`/`failed`/`aborted`), start/finish timestamps, k6 exit code, trigger source (`manual`/`scheduled`/`ci`), frozen `optionsSnapshot JSONB`, and distributed worker allocations. |
| **5** | **Hot Execution Data (Raw Time-Series)** | `TestResultPoint` | Raw data points captured *every second* during a live test: `timestamp`, `metricName` (`http_req_duration`, `http_reqs`, `vus`), scalar `metricValue`, and key-value `tags` (`method`, `url`, `status`). |
| **6** | **Cold Execution Data (Aggregated Metrics)** | `TestResult` | Pre-calculated statistical summaries generated when a run finishes: `avg`, `min`, `max`, `med` (p50), `p90`, `p95`, `p99`, total `count`, and error/success `rate`. |
| **7** | **Validation & SLA Compliance Data** | `ThresholdResult`, `SlaRule`, `SlaBreach` | Pass/fail outcomes for threshold expressions (`p(95)<500`), project-level SLA rules (`timeWindow: 24h`), and audit trails of SLA breaches (`actualValue vs threshold`). |
| **8** | **HTTP Debug & Request Data** | `TestRequestLog` | Full HTTP request/response inspection logs when running in debug/recording mode (`--http-debug`): `method`, `url`, HTTP `status`, request/response `headers`, `body` snippets, and round-trip `timing`. |
| **9** | **Alerting & Notification Data** | `AlertRule`, `AlertEvent` | Slack, generic webhook, and SMTP email notification rules, configurable cooldown periods, and historical dispatch logs. |
| **10** | **File & External Asset Data** | `CsvFile`, `GitRepo`, `Plugin`, `Dashboard` | CSV data parameterization files (`content`), Git repository sync configs (`repoUrl`, `branch`), custom Recharts/Grafana dashboard layouts (`widgets`), and k6 binary extensions. |

---

## 2. How Execution Data Is Stored (Two-Tier Pipeline)

To handle **millions of live data points** without freezing dashboard queries or overloading the database during high-concurrency tests (`NFR-3: 50 simultaneous tests`), execution data moves through a strict **Two-Tier Ingestion Pipeline**:

```mermaid
flowchart TD
    k6[k6 Binary Subprocess / Worker Agent] -->|Stdout JSON Lines| Stream[Node.js Readline Stream Pipeline]
    
    subgraph Hot Tier [Tier 1: Live Real-Time Storage & Broadcast]
        Stream -->|Point Event| Ingest[ResultIngester.ingestPoint]
        Ingest -->|Batch SQL Insert| TRP[(Table: test_result_points)]
        Ingest -->|WebSocket Broadcast <1s latency| WS[React UI Live Monitor Recharts]
    end

    subgraph Cold Tier [Tier 2: Post-Run Statistical Aggregation]
        k6 -->|Process Exit Code 0| Final[ResultIngester.aggregateAndFinalize]
        TRP -->|Query raw points for testRunId| Final
        Final -->|Calculate Percentiles O n log n| TR[(Table: test_results<br/>avg, min, max, p50, p90, p95, p99)]
        Final -->|Evaluate Threshold Expressions| THR[(Table: threshold_results<br/>passed: true/false)]
        Final -->|Evaluate SLA Compliance Windows| SLA[(Table: sla_breaches<br/>breachedAt, actualValue)]
        Final -->|Update TestRun Status| RUN[(Table: test_runs<br/>status: completed)]
    end
```

### 2.1 Tier 1: Hot Real-Time Ingestion (`TestResultPoint`)
1. **JSON Stream Emission**: When the `k6` command-line binary runs, it emits one JSON string per metric reading to standard output (`--out json`):
   ```json
   {"type":"Point","metric":"http_req_duration","data":{"time":"2026-07-14T13:45:01.050Z","value":184.5,"tags":{"name":"GET /api/users","status":"200"}}}
   ```
2. **Buffer & Batch Insert**: `ResultIngester` (`packages/backend/src/workers/index.ts`) buffers incoming points in memory and performs **batch SQL inserts** into the `test_result_points` table (`TestResultPoint`). Storing points in batches prevents database lock conflicts under high throughput.
3. **Sub-second WebSocket Broadcast**: Simultaneously, each data point is broadcast over WebSockets (`ws.ts`) to connected browsers (`LiveRunStore` in `Zustand`), updating Recharts gauge and rolling time-series line charts (`LiveMonitor.tsx`) within `< 1 second` (`NFR-2`).

### 2.2 Tier 2: Cold Statistical Aggregation (`TestResult`)
When `k6` finishes executing (`process.on('exit')`):
1. **Percentile Computation**: `ResultService` queries the raw points for that specific `testRunId`, groups them by `metricName`, sorts all scalar values (`O(n log n)`), and computes exact statistical percentiles:
   $$\text{Percentile}(p) = \text{sortedValue}\left[\left\lceil \frac{p}{100} \times N \right\rceil - 1\right]$$
2. **Compact Analytical Storage**: The computed summaries (`avg, min, max, med, p90, p95, p99, count, rate`) are permanently stored in the `test_results` table (`TestResult`).
3. **Threshold & SLA Evaluation**: Configured threshold rules (`ThresholdResult`) and project SLAs (`SlaBreach`) are evaluated against these clean percentiles. Once aggregated, historical trend charts (`FR-6.3`) query **only** `test_results`, allowing dashboards to render across months of runs (`NFR-4: 90 days retention`) in milliseconds (`NFR-1 < 2s`).

---

## 3. Where All We Are Having It (5 Physical Storage Tiers)

Your platform data lives across **5 distinct physical locations** depending on whether it is persistent relational data, high-speed active cache, queued jobs, or external file objects:

```
TenjinT6 Physical Storage Topology
 │
 ├── 1. Relational Database (SQLite / PostgreSQL)
 │       ├── Dev Mode:  packages/backend/prisma/dev.db (Single local SQLite file)
 │       └── Prod Mode: PostgreSQL Cluster (Partitioned tables via DATABASE_URL)
 │
 ├── 2. In-Memory State & Caching (RAM)
 │       ├── Backend RAM: Map<string, ChildProcess> spawnedAgents & K6Runner active runs
 │       └── Frontend RAM: Zustand Stores (LiveRunStore, EditorStore) holding live chart buffers
 │
 ├── 3. Message Queue Broker (RabbitMQ / BullMQ)
 │       └── Queues: Persistent durable queues ("run-test") storing test execution job payloads
 │
 ├── 4. File System & Object Storage (Disk / MinIO S3)
 │       ├── Temporary Execution Disk: /tmp/scripts/*.js & /tmp/results/*.json (wiped post-run)
 │       └── MinIO / Object Store: Large script files (`Script.filePath`), CSV files, and HAR dumps
 │
 └── 5. External Cloud Destinations (Optional Stream Outs)
         ├── Prometheus PushGateway: Streamed live via `TestConfig.prometheusPushUrl` (`OUTPUT_TYPES`)
         └── Grafana Cloud k6: Auto-streamed when `Project.k6CloudToken` is configured (`FR-3.7`)
```

### 3.1 Location 1: Relational Database (`DATABASE_URL`)
* **Where**: Locally at [`packages/backend/prisma/dev.db`](file:///Users/yethi/Workspace/product007/graphanak6/packages/backend/prisma/dev.db) (SQLite) or on a dedicated **PostgreSQL** database instance (`postgres://user:pass@host:5432/tenjint6`).
* **What is here**: All relational business data across 20+ Prisma database tables:
  - Users, projects, team memberships, and API keys (`users`, `projects`, `project_members`, `api_keys`).
  - Scripts, test plans, configurations, and version histories (`scripts`, `script_versions`, `test_configs`, `test_plans`).
  - Execution runs, aggregated results, and raw metric points (`test_runs`, `test_results`, `test_result_points`).
  - Threshold outcomes, SLA breaches, worker nodes, and audit logs (`threshold_results`, `sla_breaches`, `workers`, `audit_logs`).

### 3.2 Location 2: In-Memory RAM State & Caching (`Node.js / Zustand`)
* **Where**: Inside the running Node.js process memory (`packages/backend/src/routes/workers.ts`) and client browser RAM (`packages/frontend/src/store`).
* **What is here**:
  - **`spawnedAgents` Map**: Active OS process handles (`ChildProcess`) for locally running `k6` processes, allowing instantaneous aborts via `kill('SIGTERM')`.
  - **`K6Runner.active` Map**: Active test run tracking (`runId`, process reference, status).
  - **`LiveRunStore` (Zustand)**: 60-second rolling circular buffer of `TimeSeriesPoint[]` used by Recharts during live test monitoring.

### 3.3 Location 3: Message Queue Broker (`RABBITMQ_URL`)
* **Where**: Inside your RabbitMQ broker / container (`amqp://localhost:5672`).
* **What is here**: Durable message queues containing `test_run_id` payloads waiting to be dequeued by local job workers (`scheduler/index.ts`) or distributed worker agents (`packages/worker-agent`).

### 3.4 Location 4: File System & Object Storage (`MinIO / Disk`)
* **Where**: Local OS disk (`/tmp/scripts/`, `/tmp/results/`) or S3-compatible **MinIO** object storage.
* **What is here**:
  - **Temporary Executable Scripts (`/tmp/scripts/run_<id>.js`)**: When a run is triggered, the database `Script.content` (and merged environment variables (`__TARGET_URL__`) and CSV datasets) is written to a temporary disk file so the native `k6` CLI subprocess can execute it.
  - **Large File Assets**: Imported HAR files, recorded HTTP traffic sessions (`FR-1.7`), and uploaded CSV parameterization datasets (`CsvFile.content`).

### 3.5 Location 5: External Cloud Streams (`Prometheus / k6 Cloud`)
* **Where**: Grafana Cloud k6 or external Prometheus PushGateways (`TestConfig.prometheusPushUrl`).
* **What is here**: If the user configures an external output destination (`OUTPUT_TYPES` in `packages/shared`), `k6` streams raw data points directly to external Prometheus or Grafana dashboards in parallel to our internal database.

---

## 4. Data Lifecycle & Retention Strategy

To ensure long-term stability and fast query performance (`NFR-1`, `NFR-4`):
1. **Hot Data Pruning (`test_result_points`)**: Raw data points inside `test_result_points` are retained during live runs and immediate debugging, but can be pruned or purged periodically after aggregation because `test_results` holds the complete statistical summaries.
2. **Cold Data Retention (`test_results` & `test_runs`)**: Configurable per project (default **90 days retention** via `retention.ts` route).
3. **Audit Trail Immutability (`audit_logs` & `script_versions`)**: Never overwritten or deleted automatically, preserving a complete compliance history of who mutated every script and test configuration.
