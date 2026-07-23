# Business Requirements Document — TenjinT6

## 1. Executive Summary

TenjinT6 is a web-based performance testing platform that enables engineering teams to design, migrate, execute, and analyze k6-based load tests through an intuitive visual interface. The platform replaces manual k6 scripting and CLI workflows with a collaborative SaaS-like experience while keeping data self-hosted. It features a **universal JMeter (`.jmx`) migration engine** and full **multi-protocol `xk6` extension support** (including HTTP, ISO 8583, Kafka, IBM MQ, Redis, SQL, gRPC, WebSockets, and Browser Automation).

### Vision
Democratize performance testing by making k6 accessible to non-experts, seamlessly migrating legacy JMeter test plans, and providing enterprise multi-protocol testing capabilities without sacrificing power for advanced users.

### Target Users
- **QA & Performance Engineers** — Design, migrate `.jmx` plans, and schedule multi-protocol load tests
- **Developers** — Validate API, messaging, and browser performance before deployment
- **DevOps/SRE** — Integrate performance gates and SLA validation into CI/CD pipelines
- **Engineering Managers** — Track SLA compliance, regression trends, and system capacity across environments

---

## 2. Business Objectives

| # | Objective | Success Metric | Priority |
|---|---|---|---|
| 1 | Reduce time-to-first-test from hours to minutes | New users run first test within 5 minutes of signup | P0 |
| 2 | Enable non-scripters to create k6 tests | 50% of tests created via visual builder or AI generation | P0 |
| 3 | Provide single-pane-of-glass for all test activities | Average user completes full workflow without leaving the app | P0 |
| 4 | Support CI/CD integration | Tests triggerable via API, CLI, or webhook | P1 |
| 5 | Scale to 1000+ concurrent virtual users | Horizontal scaling via distributed worker agents | P1 |
| 6 | Ensure performance SLA compliance | Automated SLA evaluation after every run | P1 |
| 7 | Support team collaboration | Role-based access, shared environments, audit logs | P2 |

---

## 3. Scope

### In Scope

| Module | Description |
|---|---|
| Test Plan Management | Create, version, organize k6 test scripts (code editor + visual builder) |
| JMeter (.jmx) Import Engine | Universal XML parser supporting standard JMeter (`<jmeterTestPlan>`) and proprietary TMeter (`<ScriptWrapper>`) files, converting `ThreadGroup` / `VirtualUserGroup` / `RecordController` hierarchies directly to visual k6 blocks and scenarios |
| Multi-Protocol Extensions (`xk6`) | First-class visual blocks and script generation for **ISO 8583 / ISO 20022**, **Kafka**, **IBM MQ**, **MQTT**, **Redis**, **SQL Queries (`xk6-sql`)**, **gRPC**, **WebSockets**, and **Browser Automation (`xk6-browser`)** |
| Interactive Function & Correlation Palette | Built-in dynamic expression generator (`FunctionsDialog`) for timestamps (`Date.now()`), UUIDs, HMAC/SHA hashing, and automated token correlation |
| Configuration Management | Define test parameters (VUs, duration, iterations, stages, thresholds, env vars, outputs) |
| Test Execution Engine | Trigger runs, real-time monitoring, result aggregation |
| Suite Execution | Sequential multi-script test suites |
| Scheduling | Cron-based recurring test execution |
| Result Analysis & Diagnostics | Multi-chart telemetry (VUs, RPS, latency p90/p95/p99, error rates), metrics, thresholds, trends, comparisons, exports |
| Dashboard Builder | Custom Grafana-style dashboards with Recharts |
| Anomaly Detection | Statistical anomaly detection across historical runs |
| Regression Detection | Baseline vs current run comparison |
| Correlation Engine | Auto-detect dynamic values (tokens, IDs) across runs |
| Alerting | Slack, webhook, email notifications on threshold breach |
| SLA Management | Define and track service level agreements per metric |
| Worker Infrastructure | Distributed execution via local agents or Kubernetes pods |
| Environment Management | Per-environment variables and base URLs |
| CI/CD Integration | API, CLI, webhook-based triggers |
| Recording Proxy | Capture HTTP traffic and generate k6 scripts |
| AI Script Generator | Natural language to k6 script generation |
| Git Sync | Push/pull scripts from git repositories |
| RBAC | Role-based access control (admin, editor, executor, viewer) |
| Audit Logging | Track all user actions |
| k6 Cloud Integration | Stream results to Grafana Cloud k6 |

### Out of Scope

| Item | Rationale |
|---|---|
| Multi-region test execution | Handled by k6's native distributed execution |
| Non-k6 native desktop applications | Platform is focused on synthetic browser (`xk6-browser`), API, and messaging load testing |
| Infrastructure monitoring | Focused on synthetic performance testing |
| Real user monitoring (RUM) | Complementary but separate domain |

---

## 4. Functional Requirements

### FR-1: Test Plan Management
| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | User shall create test plans with a name and optional tags | P0 |
| FR-1.2 | User shall edit scripts using Monaco code editor with syntax highlighting | P0 |
| FR-1.3 | User shall build tests visually using drag-and-drop block editor | P0 |
| FR-1.4 | System shall version scripts on manual save | P0 |
| FR-1.5 | User shall restore any previous version | P1 |
| FR-1.6 | User shall compare versions via diff view | P1 |
| FR-1.7 | User shall import HAR files and cURL commands | P2 |
| FR-1.8 | User shall import JMeter (`.jmx`) files (both standard `<jmeterTestPlan>` and custom TMeter `<ScriptWrapper>` formats) into visual blocks with exact extraction of VUs, ramp-up time, stages, samplers, and container controllers | P0 |
| FR-1.9 | User shall design and generate scripts for multi-protocol k6 extensions including ISO 8583 / ISO 20022, Kafka, IBM MQ, MQTT, Redis, SQL Query, gRPC, WebSocket, and Browser Automation (`xk6-browser`) | P0 |
| FR-1.10 | User shall insert dynamic expressions (timestamps, UUIDs, HMAC/SHA hashes, and correlation regex tokens) via an interactive function generator (`FunctionsDialog`) without manual coding | P1 |

### FR-2: Configuration Management
| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | User shall create multiple configurations per test plan | P0 |
| FR-2.2 | Configuration shall support VUs, duration, iterations, stages | P0 |
| FR-2.3 | Configuration shall support threshold rules per metric | P0 |
| FR-2.4 | Configuration shall support environment variables | P0 |
| FR-2.5 | Configuration shall support output destinations (cloud, prometheus, etc.) | P1 |
| FR-2.6 | User shall duplicate configurations | P1 |

### FR-3: Test Execution
| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | User shall trigger a test run from a configuration | P0 |
| FR-3.2 | System shall show real-time metrics via WebSocket during execution | P0 |
| FR-3.3 | User shall abort a running test | P0 |
| FR-3.4 | System shall aggregate results into percentiles (avg, min, max, p90, p95, p99) | P0 |
| FR-3.5 | System shall evaluate thresholds and indicate pass/fail | P0 |
| FR-3.6 | User shall distribute execution across multiple worker nodes | P1 |
| FR-3.7 | System shall auto-fetch k6 Cloud results when available | P2 |

### FR-4: Suite Execution
| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | User shall create ordered test suites | P0 |
| FR-4.2 | System shall execute suite scripts sequentially | P0 |
| FR-4.3 | User shall view suite run progress and individual script results | P0 |
| FR-4.4 | Suite shall advance automatically on completion of each script | P1 |

### FR-5: Scheduling
| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | User shall schedule recurring runs using cron expressions | P0 |
| FR-5.2 | System shall compute and display next run time | P0 |
| FR-5.3 | User shall enable/disable schedules | P0 |

### FR-6: Analysis & Reporting
| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | User shall view run details with all aggregated metrics | P0 |
| FR-6.2 | User shall compare two runs side-by-side | P1 |
| FR-6.3 | User shall view trend charts over time | P1 |
| FR-6.4 | User shall export results as JSON, JUnit, or Prometheus metrics | P1 |
| FR-6.5 | System shall detect statistical anomalies across runs | P2 |
| FR-6.6 | System shall detect performance regressions vs a baseline | P2 |
| FR-6.7 | User shall analyze runs through interactive multi-chart diagnostics (`RunDetail`) visualizing concurrent VUs, request rate (`RPS`), latency percentiles (`p90/p95/p99`), and error rates simultaneously | P0 |

### FR-7: Dashboard Builder
| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | User shall create multiple dashboards per project | P1 |
| FR-7.2 | User shall add line, bar, area, and pie chart widgets | P1 |
| FR-7.3 | User shall add stat cards with sparklines | P1 |
| FR-7.4 | User shall select time ranges (1h, 6h, 24h, 7d, 30d) | P1 |

### FR-8: Alerting
| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | User shall create alert rules based on metric thresholds | P1 |
| FR-8.2 | Alerts shall support Slack webhook, generic webhook, and email channels | P1 |
| FR-8.3 | System shall enforce configurable cooldown periods | P1 |
| FR-8.4 | User shall view alert history | P1 |

### FR-9: SLA Management
| ID | Requirement | Priority |
|---|---|---|
| FR-9.1 | User shall define SLA rules (metric + condition + threshold + time window) | P1 |
| FR-9.2 | System shall evaluate SLA compliance after every run | P1 |
| FR-9.3 | User shall view SLA status and breach history | P1 |
| FR-9.4 | System shall generate SLA compliance reports | P2 |

### FR-10: Infrastructure & Workers
| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | User shall register worker nodes | P1 |
| FR-10.2 | System shall track worker health via heartbeat | P1 |
| FR-10.3 | User shall deploy workers as local processes or Kubernetes pods | P1 |
| FR-10.4 | System shall distribute VUs across online workers | P1 |

### FR-11: CI/CD Integration
| ID | Requirement | Priority |
|---|---|---|
| FR-11.1 | User shall trigger runs via REST API | P1 |
| FR-11.2 | User shall trigger runs via webhook (shared key) | P1 |
| FR-11.3 | User shall trigger runs via CLI tool | P1 |
| FR-11.4 | CLI shall return JUnit-formatted results for pipeline reporting | P1 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Page load time | < 2s for all pages |
| NFR-2 | Real-time metric latency | < 1s from k6 stdout to browser |
| NFR-3 | Concurrent users | 50 simultaneous users per backend instance |
| NFR-4 | Data retention | Configurable (default 90 days) |
| NFR-5 | Availability | 99.9% uptime |
| NFR-6 | Security | JWT auth, PAT support, data encrypted in transit |
| NFR-7 | Audit | All mutations logged to AuditLog |
| NFR-8 | Single deploy | Run fully with `docker compose up` |
| NFR-9 | Dark mode | Full dark mode support via Tailwind class strategy |

---

## 6. User Stories (Epics)

### Epic 1: First Run in 5 Minutes
> "As a QA engineer, I want to select a template or use AI to generate my first test, configure it via a form, and run it immediately without writing any k6 code."

### Epic 2: Continuous Performance Validation
> "As a DevOps engineer, I want my tests to run on every deployment via CI/CD pipeline, and get alerted immediately if response times exceed thresholds."

### Epic 3: Performance Trend Analysis
> "As an engineering manager, I want to see dashboards showing p95 latency trends over the last 30 days and know if we're meeting our SLA."

### Epic 4: Distributed Load Generation
> "As a performance engineer, I want to generate 5000 VUs of load by distributing across 5 worker nodes in different availability zones."

### Epic 5: Collaborative Test Development
> "As a team lead, I want my team to share environments, review each other's test scripts via visual blocks, and have full audit trails."

---

## 7. Constraints

| Constraint | Detail |
|---|---|
| Database | SQLite (single file) — suitable for single-server deployments; no replication |
| Message Queue | RabbitMQ required for job distribution |
| k6 Binary | Must be installed on the backend server (and each worker node) |
| Browser Support | Modern browsers (Chrome, Firefox, Safari, Edge latest 2 versions) |
| Deployment | Docker Compose or manual Node.js deployment |
| Storage | SQLite file size limits apply (~few GB practical) |

---

## 8. Assumptions

1. Users have network access to the backend and any worker nodes
2. k6 is installed on all execution nodes
3. RabbitMQ is accessible from the backend
4. For Kubernetes deployment, a valid kubeconfig exists on the backend server
5. Users have basic understanding of HTTP performance metrics
