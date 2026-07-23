# Skill: Trace-Driven Implementation

> Ground every implementation in a concrete trace — a specific request path, a specific actor, a specific data flow. Build the thing that makes the trace work, then generalize.

---

## What It Is

The ability to take a documented design and translate it into code by following the **exact path of a single request or event** through the system. You don't build "generic worker infrastructure" — you build the code that handles "a worker agent starts → receives a job → runs processing task → reports metrics → completes". Once the trace works, you abstract and handle variants.

```
Design Document ─→ Pick one trace ─→ Implement end-to-end
                                        │
                                   Does it work?
                                        │
                                   Yes ─→ Handle variants
                                        │
                                   Generalize and refactor
```

---

## When To Use

- **Breaking down a large feature** into concrete, shippable pieces
- **Implementing from a design document** (HLD → LLD → code)
- **Building integration points** between systems (backoffice → worker agent → central API)
- **Adding a new external dependency** (Kubernetes API, Cloud Storage API, Git provider)
- Any time you feel "this feature is too big to start"

---

## Workflow

### Step 1: Pick One Trace Through the Design

From the design document, pick the simplest complete path:

```markdown
Design: Distributed Task Execution

Possible traces:
1. User distributes → backend creates assignments → worker accepts → task engine runs → worker completes
2. User distributes → worker is offline → assignment rejected
3. User distributes → worker accepts → task engine crashes → worker reports failure
4. User distributes → worker times out → backend marks failed

→ Pick trace #1 first (happy path, simplest)
```

### Step 2: Map Every Step to a File and Function

```markdown
Trace: User distributes a task → 3 workers each run a portion

1. Frontend JobEditor.tsx → distributeRun() calls api.distributeRun()
2. Backend routes/workers.ts → POST /distribute handler
3. Backend creates TaskRun + WorkerRunAssignment
4. Backend HTTP POST to each worker's /run endpoint
5. Worker agent agent.ts → /run handler
6. Worker agent taskRunner.ts → spawns processing engine
7. engine outputs telemetry → Worker parses and POSTs to /metrics
8. Backend routes/workers.ts → /metrics handler → ResultIngester
9. Backend routes/workers.ts → /complete handler → aggregateAndFinalize
```

### Step 3: Implement Bottom-Up or Top-Down

**Bottom-up (safer, testable at each step):**
```
1. Worker agent: create taskRunner.ts standalone (test with local engine binary)
2. Worker agent: create agent.ts HTTP server (test with curl)
3. Backend: create POST /distribute handler
4. Backend: create POST /runs/:id/metrics and /complete
5. Frontend: add distribute button and UI
```

**Top-down (visible progress, needs mocks):**
```
1. Frontend: add button that calls a mock
2. Backend: stub the route handler
3. Backend: implement the logic
4. Worker agent: implement the receiving side
```

Recommendation: **Bottom-up** for distributed systems (you can test each component independently).

### Step 4: Implement Each Layer with the Next in Mind

**Worker agent (bottom):**
```typescript
// taskRunner.ts — standalone, zero external dependencies
class TaskRunner {
  start(runRequest: RunRequest): ChildProcess { ... }
  abort(): void { ... }
}

// agent.ts — Express server, calls TaskRunner
app.post('/run', async (req, res) => {
  const runner = new TaskRunner()
  runner.on('metric', (point) => {
    fetch(`${CENTRAL_API}/runs/${runId}/metrics`, { ... })
  })
  runner.on('done', (result) => {
    fetch(`${CENTRAL_API}/runs/${runId}/complete`, { ... })
  })
  runner.start(req.body)
  res.json({ accepted: true })
})
```

**Backend (middle layer):**
```typescript
// routes/workers.ts — calls workers, receives callbacks
router.post('/projects/:pid/configs/:configId/distribute', async (req, res) => {
  const config = await prisma.testConfig.findUnique({ ... })
  const run = await prisma.testRun.create({ status: 'distributing' })
  for (const [worker, vuRange] of assignments) {
    const response = await fetch(`${worker.url}/run`, { method: 'POST', body: { vusStart, vusEnd } })
    await prisma.workerRunAssignment.update({ status: response.ok ? 'accepted' : 'failed' })
  }
  res.json({ run, dispatchResults })
})

router.post('/runs/:id/metrics', async (req, res) => {
  ingester.ingestPoint(req.params.id, req.body)
  res.json({ accepted: true })
})

router.post('/runs/:id/complete', async (req, res) => {
  await ingester.aggregateAndFinalize(req.params.id, req.body.exitCode)
  await prisma.workerRunAssignment.update({ status: 'completed' })
  res.json({ accepted: true })
})
```

### Step 5: Verify the Trace

```
1. Start worker agent:  npx tsx worker-agent/src/index.ts
2. Backend sends a job: curl -X POST http://localhost:6566/run -d '{...}'
3. Check that task engine starts — look for child process
4. Check that metrics arrive at the backend
5. Check that completion is reported
6. Check the database: TaskRun status, TaskResult rows, Assignments
```

### Step 6: Generalize and Handle Variants

Once the happy path trace works:
- Add error handling (worker rejects, worker crashes, worker times out)
- Add edge cases (zero concurrency, single task, very large payload)
- Add configuration options (launch type, capacity, namespace)
- Add the UI for triggering and monitoring

---

## Templates

### Trace Document Template

```markdown
## Trace: {name}

### Starting Point
{what triggers this trace}

### End Point
{what indicates success}

### Steps
| # | Component | File | Function | Input | Output |
|---|-----------|------|----------|-------|--------|
| 1 | {frontend}| {path} | {fn} | {data}| {data} |
| 2 | {backend} | {path} | {fn} | {data}| {data} |
...

### Verification
{how to test each step in isolation}
```

### Implementation Order Template

```
Phase 1: {bottom layer} — standalone, testable without other components
  Files: {list}
  Test: {command}

Phase 2: {middle layer} — integrates layer 1 components
  Files: {list}
  Test: {command}

Phase 3: {top layer} — UI and end-to-end
  Files: {list}
  Test: {command}
```

---

## Real Example from a Distributed System Project

The worker agent package was built using trace-driven implementation:

```
Trace: "Worker agent receives a run request, executes task engine, reports back"
```

**Phase 1 — TaskRunner (bottom):**
- Created `packages/worker-agent/src/taskRunner.ts`
- Standalone class: `new TaskRunner().start({payload, concurrency, duration})`
- Tested with `node -e "new TaskRunner().start({...})"`
- Emits events: `metric`, `done`, `error`

**Phase 2 — Agent HTTP server (middle):**
- Created `packages/worker-agent/src/agent.ts`
- Express routes: `POST /run`, `POST /abort`, `GET /health`
- Wires TaskRunner events to HTTP callbacks
- Tested with curl

**Phase 3 — Backend dispatch (integration):**
- Added `POST /projects/:pid/configs/:configId/distribute`
- Added assignment creation and status tracking
- Added `POST /runs/:id/metrics` and `/complete` endpoints
- Tested with frontend button

Each phase was independently verifiable before moving to the next.

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Building generic infrastructure before specific traces | You build "job queue framework" that doesn't fit your actual job |
| Implementing all layers without testing any | Bug at the bottom breaks everything above |
| Only testing the happy path | Edge cases crash in production |
| Mocking everything in tests | The mocks pass but the real integration fails |
| Trying to generalize too early | You abstract over one use case and get it wrong |
| Building UI before the backend works | The user sees buttons that don't do anything |
