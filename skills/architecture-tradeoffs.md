# Skill: Architecture Trade-off Analysis

> Never choose a technology by familiarity alone. Frame the options, compare on concrete dimensions, and make a falsifiable recommendation.

---

## What It Is

The ability to evaluate multiple technical approaches against each other on **explicit, measurable dimensions** — not just "I like X" or "X is popular". You state alternatives, list pros and cons, and make a recommendation that can be challenged and defended.

```
Problem ─→ List 2-3 viable approaches
            │
            ├─ Dimension 1: Complexity
            ├─ Dimension 2: Performance
            ├─ Dimension 3: Operational burden
            ├─ Dimension 4: Debuggability
            ├─ Dimension 5: Cost
            │
            └─ Recommendation (with why not the others)
```

---

## When To Use

- **Infrastructure choices**: database, message queue, cache, deployment model
- **Architecture patterns**: monolith vs microservices, REST vs GraphQL, sync vs async
- **Library selections**: ORM vs query builder, state management library, testing framework
- **Protocol decisions**: HTTP vs WebSocket vs gRPC, push vs poll
- **After a feature request** — before implementing, check if there's a simpler approach

---

## Workflow

### Step 1: Frame the Decision

State the decision clearly:
```
"We need to dispatch test runs to remote workers. Should we use RabbitMQ fan-out or direct HTTP POST?"
```

### Step 2: List Viable Alternatives

Limit to 2-3 realistic options. Don't list every possible technology.

| Option | Description |
|--------|-------------|
| **A: RabbitMQ fan-out** | Publish to exchange → each worker consumes from its own queue |
| **B: HTTP dispatch** | Backend POSTs directly to each worker's HTTP endpoint |
| **C: Shared DB polling** | Workers poll a `pending_jobs` table |

### Step 3: Define Comparison Dimensions

Pick 4-6 dimensions that matter for YOUR context:

| Dimension | Why It Matters Here |
|-----------|-------------------|
| **Complexity** | How many new moving parts? Team must maintain them. |
| **Latency** | Time from trigger to worker receiving the job. |
| **Reliability** | What happens if a worker is down? Message durability? |
| **Debuggability** | Can we inspect what's in the queue? Replay messages? |
| **Setup cost** | Do we need new infrastructure (RabbitMQ cluster)? |
| **Security** | Do workers need to be on the same network as the queue? |

### Step 4: Score Each Option

```
Dimension          | RabbitMQ fan-out | HTTP dispatch | DB polling
───────────────────|─────────────────|───────────────|───────────
Complexity         | High (new infra) | Low (no deps) | Medium
Latency            | Low (sub-ms)     | Medium (ms)   | High (seconds)
Reliability        | High (durable)   | Low (in-flight)| Medium
Debuggability      | High (UI tools)  | Low           | High
Setup cost         | High (RabbitMQ)  | Zero          | Zero
Security footprint | Workers need MQ  | Workers need  | DB access
                   | access           | HTTP(S)       | needed
```

### Step 5: Weight and Recommend

For the current project context (small team, single deployment, workers on same network):

```
RabbitMQ: Overkill for current scale, adds operational burden.
DB polling: Simpler but adds latency, not great for real-time.
HTTP dispatch: Simplest, no new infra, works at current scale. Can upgrade to 
               RabbitMQ later when we have 100s of workers.

RECOMMENDATION: HTTP dispatch.
Revisit at 50+ workers or if reliability requirements increase.
```

### Step 6: Document the Decision

```markdown
## Decision: HTTP Fan-Out Dispatch

### Context
We need to dispatch test runs to remote worker agents.

### Options Considered
1. RabbitMQ fan-out exchange + per-worker queues
2. Direct HTTP POST to worker agents
3. Shared database polling

### Decision
HTTP dispatch.

### Rationale
- Zero new infrastructure (workers already have HTTP servers)
- Workers are on the same network — no NAT/firewall issues
- At current scale (<10 workers), simplicity beats durability guarantees
- Easy to replace with RabbitMQ later — just swap the dispatch function

### Consequences
- In-flight jobs are lost if the backend crashes mid-dispatch
- Workers must be reachable via HTTP from the backend
- Will need retry logic for transient failures
```

---

## Common Trade-off Dimensions

| Dimension | What to Evaluate |
|-----------|-----------------|
| **Complexity** | Lines of code? Number of new services? Learning curve? |
| **Performance** | Latency P50/P95/P99? Throughput? Scalability ceiling? |
| **Reliability** | What guarantees? (at-most-once, at-least-once, exactly-once) |
| **Operability** | Monitoring? Debugging? Backup? Upgrade process? |
| **Cost** | Infrastructure cost? Engineering time? Maintenance burden? |
| **Security** | Attack surface? Auth complexity? Data exposure? |
| **Flexibility** | Easy to change later? Vendor lock-in? |
| **Ecosystem** | Documentation? Community? Package availability? |

---

## Templates

### Trade-off Scorecard

```markdown
## Decision: {topic}

### Options
| # | Option | Description |
|---|--------|-------------|
| A | {name} | {1-liner} |
| B | {name} | {1-liner} |

### Dimensions
| Dimension | Weight | A Score | A Weighted | B Score | B Weighted |
|-----------|--------|---------|------------|---------|------------|
| Complexity | 3 | 8 | 24 | 4 | 12 |
| Latency | 2 | 6 | 12 | 9 | 18 |
| Reliability | 3 | 9 | 27 | 3 | 9 |
| **Total** | | | **63** | | **39** |

### Recommendation
{Option with highest total, or qualitative override}

### Rationale
{bullet points}

### Consequences
{what changes if we pick this}
```

### Architecture Decision Record (ADR) Template

```markdown
# ADR-{number}: {title}

## Status
{Proposed | Accepted | Deprecated | Superseded}

## Context
{Why this decision needs to be made}

## Options
{What was considered}

## Decision
{What was chosen}

## Rationale
{Why this option over others}

## Consequences
{What this means for the team/codebase}

## Compliance
{How we'll verify this is working}
```

---

## Real Example from This Project

**Decision: HTTP dispatch vs RabbitMQ fan-out for distributed execution**

Analysis:
| Dimension | HTTP Dispatch | RabbitMQ Fan-out |
|-----------|--------------|-----------------|
| Setup cost | Zero — workers already have Express HTTP servers | Must deploy RabbitMQ, configure exchanges, manage queues |
| Debugging | Simple curl to test a worker | Need rabbitmqadmin or management UI |
| Failure handling | Backend must handle retry; in-flight jobs lost on crash | Durable queues survive restarts |
| Latency | ~5ms per POST (local network) | ~1ms per message |
| Scalability | Backend does N HTTP calls (fine for <50 workers) | Any number of workers, no extra load on backend |
| Auth | Token passed in header per request | Worker connects with credentials once |

**Result:** HTTP dispatch. Rationale: the added complexity of RabbitMQ was not justified for the current scale (<10 workers). The team can migrate to RabbitMQ later by changing one function — the dispatch interface is the same.

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Comparing without explicit dimensions | "X is better" — better HOW? |
| Weighting all dimensions equally | Latency might matter 10x more than setup cost |
| Ignoring the team's context | "Use Kafka" when the team has never operated it |
| False dichotomies | Presenting only two options when a hybrid exists |
| Not documenting rejected options | Next developer will ask "why didn't you use X?" |
| Analysis paralysis | Spending 2 weeks comparing when either option would work |
| Undocumented compliance | "We chose this for reliability" — but no one checks if it's actually reliable |
