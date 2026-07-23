# TenjinT6 - Quick Start & Local Setup Guide

Welcome to **TenjinT6**, a distributed, trace-driven k6 performance testing platform. This guide provides comprehensive, step-by-step instructions to set up and run TenjinT6 on your local machine.

> [!IMPORTANT]
> **Key Architecture & Deployment Guides**:
> - 📦 **Master & Worker Deployment**: See **[DEPLOYMENT_MASTER_WORKER.md](file:///Users/yethi/Workspace/product007/graphanak6/DEPLOYMENT_MASTER_WORKER.md)** for Bare-Metal, Docker, and Kubernetes deployment instructions.
> - ⚙️ **Storage, Execution & Stages**: See **[TEST_PLANS_EXECUTION_STORAGE.md](file:///Users/yethi/Workspace/product007/graphanak6/TEST_PLANS_EXECUTION_STORAGE.md)** for detailed database models (`TestPlan`, `Script`, `TestRun`, `TestResult`), real-time `k6` streaming mechanics, and operational stages.
> - 🗄️ **Data Inventory & Storage Topology**: See **[DATA_INVENTORY_STORAGE.md](file:///Users/yethi/Workspace/product007/graphanak6/DATA_INVENTORY_STORAGE.md)** for the complete inventory of our 10 data categories, the two-tier real-time vs post-run ingestion pipeline, and our 5 physical storage tiers.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Quick Start (Docker Mode)](#2-quick-start-docker-mode)
3. [Local Development Setup (Manual Mode)](#3-local-development-setup-manual-mode)
4. [Using the Helper Script (`run.sh`)](#4-using-the-helper-script-runsh)
5. [Connecting & Logging In](#5-connecting--logging-in)
6. [Running Additional Services](#6-running-additional-services)
   - [Distributed Worker Agent](#distributed-worker-agent)
   - [TenjinT6 Command Line Interface (CLI)](#tenjint6-command-line-interface-cli)
7. [Common Commands & Tasks](#7-common-commands--tasks)

---

## 1. Prerequisites

Before setting up TenjinT6, make sure your machine has the following tools installed:

| Dependency | Required Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` (LTS) or higher | Monorepo runtime |
| **npm** | `v10.x` or higher | Workspace and dependency package manager |
| **k6 CLI** | `latest` | Performance test execution binary (required for backend/workers) |
| **Docker & Compose** | `latest` | Running RabbitMQ locally or containerizing the entire stack |

### Quick Installation Guide by OS

````carousel
#### macOS
If you are on macOS, you can install the prerequisites via [Homebrew](https://brew.sh/):
```bash
# Install Node.js & k6 CLI
brew install node k6

# Install Docker (optional, or download Docker Desktop)
brew install --cask docker
```
<!-- slide -->
#### Linux (Ubuntu/Debian)
Install prerequisites using standard package managers:
```bash
# 1. Install Node.js (via NodeSource v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install k6 CLI
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD194E80608552
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# 3. Install Docker
sudo apt-get install -y docker.io docker-compose
```
<!-- slide -->
#### Windows
Install prerequisites via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) or [Chocolatey](https://chocolatey.org/):
```powershell
# Install Node.js LTS
winget install OpenJS.NodeJS.LTS
# OR: choco install nodejs-lts

# Install k6 CLI
winget install Grafana.k6
# OR: choco install k6

# Install Docker Desktop
winget install Docker.DockerDesktop
```
````

---


## 2. Quick Start (Docker Mode)

The fastest and most reliable way to spin up the entire TenjinT6 ecosystem (Frontend, Backend, and RabbitMQ) is using Docker Compose.

1. Ensure the **Docker daemon** is running on your machine.
2. Run the start command from the project root:
   ```bash
   ./run.sh --docker
   ```
   *(Alternatively: `docker-compose up --build`)*

This boots up the following services:
* **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
* **Backend REST/WS API**: [http://localhost:3001](http://localhost:3001)
* **RabbitMQ Message Broker**: `amqp://localhost:5672` (for test run queues)

---

## 3. Local Development Setup (Manual Mode)

If you prefer to run the services natively for faster development iterations, follow this step-by-step procedure:

### Step 1: Run RabbitMQ
TenjinT6 uses RabbitMQ to queue test runs. Start a lightweight instance in the background using Docker:
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```
*(The management console will be available at [http://localhost:15672](http://localhost:15672) with default credentials `guest`/`guest`.)*

### Step 2: Install Project Dependencies
In the root directory, run `npm install` to download dependencies for all workspace packages:
```bash
npm install
```

### Step 3: Build the Shared Package
The frontend and backend both depend on `@tenjint6/shared`. Compile it first:
```bash
npm run build -w packages/shared
```

### Step 4: Configure Environment Variables
The backend looks for configuration settings in `packages/backend/.env`. Create or check the file to match your credentials:
```ini
DATABASE_URL="file:./dev.db"
RABBITMQ_URL="amqp://localhost"
PORT=3001

# Optional SMTP configurations for email notifications
# SMTP_HOST="smtp.example.com"
# SMTP_PORT=587
# SMTP_USER="user@example.com"
# SMTP_PASS="your-password"
# SMTP_FROM="alerts@example.com"
```

### Step 5: Initialize the SQLite Database & Generate Prisma Client
Set up your local database schema (a SQLite file will be created automatically at `packages/backend/prisma/dev.db`):
```bash
# Push schema & initialize Prisma Client
npm run db:push -w packages/backend
```

### Step 6: Seed the Database
Seed the database with initial developer credentials and a mock default project:
```bash
npx prisma db seed -w packages/backend
```

### Step 7: Start Development Servers
Start both the Frontend and Backend servers simultaneously under hot-reload mode:
```bash
npm run dev
```
* **Frontend**: Running on [http://localhost:5173](http://localhost:5173)
* **Backend**: Running on [http://localhost:3001](http://localhost:3001)

---

## 4. Running the Application

We provide a convenient shell script, [run.sh](file:///Users/yethi/Workspace/product007/graphanak6/run.sh), at the root of the project to automate local startup tasks for macOS and Linux.

### Command Options:
* **Start natively (Local mode)**: 
  Installs dependencies, builds packages, pushes database changes, generates Prisma clients, and launches dev servers.
  ```bash
  ./run.sh
  ```
* **Start via Docker Compose**:
  ```bash
  ./run.sh --docker
  ```
* **Force Update Dependencies & Rebuild**:
  ```bash
  ./run.sh --install
  ```
* **Reset Database**:
  Wipes and resets the local SQLite database schema.
  ```bash
  ./run.sh --reset-db
  ```

### Windows & Native Terminal Alternatives
> [!TIP]
> **Windows Users**: You can execute the shell script `./run.sh` inside **Git Bash**, **WSL (Windows Subsystem for Linux)**, or **Cygwin**.
> If you prefer not to use bash or want to run commands natively in **PowerShell / cmd.exe**, run the following equivalent sequence:
> 
> ```powershell
> # 1. Install dependencies
> npm install
> 
> # 2. Build the shared package (critical first build step)
> npm run build -w packages/shared
> 
> # 3. Sync database schema & generate Prisma client
> npm run db:push -w packages/backend
> 
> # 4. Seed database with initial credentials
> npx prisma db seed -w packages/backend
> 
> # 5. Run development servers (Starts frontend and backend concurrently)
> npm run dev
> ```

---

## 5. Connecting & Logging In

Once the servers are running, access the dashboard at **[http://localhost:5173](http://localhost:5173)**.

Use the seeded developer credentials to sign in:
* **Email**: `dev@tenjint6.local`
* **Password**: `password`

> [!NOTE]
> The Swagger API Documentation is accessible at **[http://localhost:3001/api/docs](http://localhost:3001/api/docs)** once the backend server starts.

---

## 6. Running Additional Services

### Distributed Worker Agent
If you want to simulate multi-node or distributed test runs, you can launch worker agents which listen for performance test jobs.

> [!TIP]
> **For complete production, Bare-Metal, Docker, and Kubernetes Master-Worker deployment instructions**, see our dedicated guide: **[DEPLOYMENT_MASTER_WORKER.md](file:///Users/yethi/Workspace/product007/graphanak6/DEPLOYMENT_MASTER_WORKER.md)**.

1. Navigate to the agent workspace (or run from root):
   ```bash
   npm run dev -w packages/worker-agent
   ```
2. The agent runs by default on port `6566` and communicates back with the central API server.
3. You can override configurations using environment variables:
   ```bash
   AGENT_PORT=6567 AGENT_NAME="agent-west-1" CENTRAL_API_URL="http://localhost:3001" npm run dev -w packages/worker-agent
   ```

### TenjinT6 Command Line Interface (CLI)
You can also trigger performance runs and fetch results directly from your terminal using the CLI tool.

1. Install TSX globally if you haven't (or use local execution paths):
   ```bash
   npm install -g tsx
   ```
2. Link or run the CLI bin file located in `packages/cli`:
   ```bash
   # Run the CLI helper to view available commands
   npx tsx packages/cli/index.ts
   ```
3. **Usage commands**:
   ```bash
   # Login and save API token
   npx tsx packages/cli/index.ts login <your-pat-token>
   
   # Set active project
   npx tsx packages/cli/index.ts use <project-id>
   
   # Trigger a run
   npx tsx packages/cli/index.ts run --config <config-id>
   
   # List recent runs
   npx tsx packages/cli/index.ts runs list
   ```

---

## 7. Common Commands & Tasks

Here are some helpful development npm tasks you can execute from the workspace root:

| Command | Action |
| :--- | :--- |
| `npm run lint` | Run ESLint across frontend and backend |
| `npm run typecheck` | Verify TypeScript type-safety across packages |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright end-to-end integration tests |
| `npm run db:studio` | Launch Prisma Studio GUI (accessible at [http://localhost:5555](http://localhost:5555)) |
| `npm run build` | Build production bundles for all packages |
