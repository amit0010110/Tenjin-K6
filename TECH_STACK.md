# Technology Stack — TenjinT6

## Monorepo Management

| Tool | Purpose | Version |
|---|---|---|
| npm workspaces | Monorepo orchestration | 10.x |
| TypeScript | Language (all packages) | ^5.6.0 |
| concurrently | Parallel dev server execution | ^9.0.0 |

---

## Backend (`packages/backend`)

### Runtime

| Technology | Purpose | Version |
|---|---|---|
| Node.js | Runtime environment | 20.x LTS |
| Express.js | HTTP framework | ^4.21.0 |
| cors | CORS middleware | ^2.8.5 |
| express-ws | WebSocket integration | ^5.0.2 |
| ws | WebSocket library | ^8.x |

### Database

| Technology | Purpose | Version |
|---|---|---|
| SQLite | Database engine | 3.x |
| Prisma ORM | Database access & migrations | ^6.0.0 |
| @prisma/client | Generated type-safe client | ^6.0.0 |

### Message Queue

| Technology | Purpose | Version |
|---|---|---|
| RabbitMQ | Job queue for test execution | 3.x |
| amqplib | RabbitMQ client | ^0.10.0 |

### Authentication & Security

| Technology | Purpose | Version |
|---|---|---|
| jsonwebtoken | JWT generation & verification | ^9.0.3 |
| bcryptjs | Password hashing | ^3.0.3 |

### Validation

| Technology | Purpose | Version |
|---|---|---|
| zod | Schema validation | ^3.24.0 |

### Logging

| Technology | Purpose | Version |
|---|---|---|
| pino | Structured JSON logging | ^9.0.0 |
| pino-pretty | Human-readable log formatting | ^11.0.0 |

### Notifications

| Technology | Purpose | Version |
|---|---|---|
| nodemailer | SMTP email delivery | ^9.0.3 |

### Scheduling

| Technology | Purpose | Version |
|---|---|---|
| node-cron | Cron-based job scheduling | ^4.6.0 |
| cron-parser | Cron expression parsing | ^5.6.1 |

### Git Integration

| Technology | Purpose | Version |
|---|---|---|
| simple-git | Git repository operations | ^3.36.0 |

### Kubernetes

| Technology | Purpose | Version |
|---|---|---|
| @kubernetes/client-node | K8s API for worker pod management | ^1.4.0 |

### API Documentation

| Technology | Purpose | Version |
|---|---|---|
| swagger-jsdoc | OpenAPI spec generation from JSDoc | ^6.3.0 |
| swagger-ui-express | Swagger UI serving | ^5.0.1 |

### Utilities

| Technology | Purpose | Version |
|---|---|---|
| uuid | UUID generation | ^10.0.0 |
| http-proxy | HTTP proxy for recording/correlation | ^1.18.1 |

### Development & Testing

| Technology | Purpose | Version |
|---|---|---|
| tsx | TypeScript execution (dev mode) | ^4.19.0 |
| vitest | Unit & integration test framework | ^4.1.10 |
| supertest | HTTP test assertions | ^7.2.2 |
| prisma (CLI) | Schema management & migrations | ^6.0.0 |

---

## Frontend (`packages/frontend`)

### Core

| Technology | Purpose | Version |
|---|---|---|
| React | UI framework | ^18.3.0 |
| react-dom | React DOM rendering | ^18.3.0 |
| react-router-dom | Client-side routing | ^6.28.0 |

### State Management

| Technology | Purpose | Version |
|---|---|---|
| zustand | Lightweight state management | ^5.0.0 |

### Build & Dev Tools

| Technology | Purpose | Version |
|---|---|---|
| Vite | Build tool & dev server | ^6.0.0 |
| @vitejs/plugin-react | Vite React plugin (SWC) | ^4.3.0 |
| tailwindcss | Utility-first CSS framework | ^3.4.0 |
| postcss | CSS processing | ^8.x |
| autoprefixer | CSS vendor prefixing | ^10.x |

### UI & Visualization

| Technology | Purpose | Version |
|---|---|---|
| @monaco-editor/react | VS Code code editor | ^4.6.0 |
| recharts | Charting (line, bar, area, pie, sparklines) | ^2.14.0 |
| lucide-react | Icon set | ^1.23.0 |

### Testing

| Technology | Purpose | Version |
|---|---|---|
| vitest | Unit test framework | ^4.1.10 |
| @testing-library/react | React component testing | ^14.x |
| @testing-library/jest-dom | DOM matchers | ^6.x |
| jsdom | DOM environment for tests | ^24.x |

### E2E Testing

| Technology | Purpose | Version |
|---|---|---|
| @playwright/test | E2E browser testing | ^1.61.1 |

---

## Worker Agent (`packages/worker-agent`)

| Technology | Purpose | Version |
|---|---|---|
| Node.js | Runtime | 20.x LTS |
| Express.js | HTTP server | ^4.21.0 |
| uuid | UUID generation | ^10.0.0 |
| tsx | TypeScript execution | ^4.19.0 |

The worker agent is a lightweight standalone service. It does NOT depend on Prisma, RabbitMQ, or any database — only on Express and the shared types package. It communicates with the central backend via HTTP only.

---

## CLI (`packages/cli`)

| Technology | Purpose | Version |
|---|---|---|
| Node.js | Runtime | 20.x LTS |
| tsx | TypeScript execution | ^4.19.0 |

Standalone CLI tool with zero additional dependencies. Communicates with the backend via REST API.

---

## Shared Package (`packages/shared`)

| Technology | Purpose | Version |
|---|---|---|
| TypeScript | Shared type definitions | ^5.6.0 |

Contains interfaces and constants used by multiple packages: `TestRun`, `MetricPoint`, `AggregatedMetric`, `OUTPUT_TYPES` (15 output destinations), script/config schemas, and error types.

---

## Infrastructure

| Component | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| API Server | Express.js on port 3001 |
| Frontend Server | Vite dev server on port 5173 (dev) / Nginx (production) |
| Database | SQLite file (`dev.db`) |
| Message Queue | RabbitMQ on port 5672 |
| WebSocket | Native `ws` on same HTTP server (port 3001) |

---

## Architecture Patterns

| Pattern | Implementation |
|---|---|
| Monorepo | npm workspaces |
| API Architecture | RESTful with OpenAPI documentation |
| Real-time | WebSocket pub/sub |
| Job Queue | RabbitMQ with persistent durable queues |
| Test Execution | Child process spawning of `k6` binary |
| ORM | Prisma (declarative schema, migrations, type-safe client) |
| CSS Strategy | Tailwind utility classes with `class` dark mode strategy |
| State Management | Zustand (lightweight, no boilerplate) |
| Auth Strategy | JWT access tokens + Personal Access Tokens |
