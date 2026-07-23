# Skill: Layered Decomposition

> Break any problem into ordered depth layers — BRD → Architecture → Design → Implementation. Never start code without knowing the shape of the system.

---

## What It Is

The ability to consistently decompose a large, ambiguous problem into a **stack of documents** where each layer answers a specific question and feeds into the next. You don't jump to code — you descend through layers of abstraction.

```
Layer 0: Business Need       →  Why are we building this?
Layer 1: BRD                 →  What must it do? (features, users, constraints)
Layer 2: Tech Stack          →  What tools will we use, and why?
Layer 3: HLD                 →  How do the big pieces fit together?
Layer 4: LLD                 →  What are the exact components, routes, data flows?
Layer 5: Implementation      →  Code it, test it, ship it.
```

---

## When To Use

- Starting a **new project** from scratch
- Adding a **major feature** (distributed execution, multi-tenant, SSO)
- **Onboarding** a new team member to a complex system
- When stakeholders ask "what are we building?" before you've written code
- Any time you feel the urge to `npm init` without a plan

---

## Workflow

### Step 1: Understand the Business Need

Before any technical document, clarify:
- Who is the user?
- What problem are they solving?
- What is the minimum viable outcome?

**Deliverable:** A paragraph or a conversation. Not yet a document.

### Step 2: Write the BRD (Business Requirements Document)

**Answer these questions:**
- What are the functional modules? (list them)
- Who are the actors? (admin, viewer, CI/CD system, worker agent)
- What are the constraints? (must work offline, must support 10k concurrent, etc.)
- What is out of scope?

**Example from this project:**
```markdown
## Functional Modules
1. Script management (CRUD, versioning, blocks)
2. Test execution (single run, suite run, distributed run)
3. Worker management (local, Kubernetes, heartbeat, assignments)
...
```

**Template:**
```markdown
# BRD — {Project Name}

## Objective
{one paragraph}

## Functional Modules
{N numbered list of modules with 1-line description each}

## Actors
{N list of actors and their goals}

## Constraints
{N list}

## Out of Scope
{N list}
```

---

### Step 3: Choose the Tech Stack

For each major concern, pick a tool and document **why**:
- Language / runtime
- Database
- Message queue
- Frontend framework
- Hosting / deployment
- Monitoring

**Template:**
```markdown
| Concern | Choice | Why not the alternative |
|---------|--------|------------------------|
| Database | SQLite | Simpler dev setup, no Docker dependency |
| Queue | RabbitMQ | Built-in ack/reject, dead-lettering |
| Auth | JWT + PAT | Stateless, no session store |
```

---

### Step 4: High-Level Design (HLD)

**Components:**
- Box-and-arrow diagram (in code: ASCII or Mermaid)
- Deployment modes (single binary? containerized? cloud?)
- How data flows through the system

**Sections:**
```markdown
## System Architecture
{diagram + explanation}

## Deployment Modes
### Single-Binary
{description}
### Distributed with Workers
{description}

## Data Flow
### Single Run
{sequence}
### Suite Run
{sequence}
### Distributed Run
{sequence}
```

---

### Step 5: Low-Level Design (LLD)

Split into backend and frontend:

**Backend LLD sections:**
- Route table (method, path, handler logic, side effects)
- Worker infrastructure (process lifecycle, event handlers)
- Database schema (models, relationships, indexes)
- Error handling strategy
- Logging strategy
- Testing strategy

**Frontend LLD sections:**
- Route map (path, component, data dependencies)
- Component tree for every key page
- Shared components (with props and states)
- Data layer (API client, query hooks)
- All UI states per component (loading, empty, error, edge cases)

---

### Step 6: Implementation

Code in dependency order:
1. Database schema (migrations)
2. Shared libraries (auth, errors, logging)
3. Backend routes (in dependency order: auth → projects → scripts → configs → runs → workers)
4. Frontend components (shell → shared → pages)
5. Integration tests

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Writing code before understanding the data model | You'll rewrite migrations 3 times |
| Skipping HLD and going straight to LLD | You miss cross-cutting concerns (auth, error handling) |
| Over-documenting implementation details in BRD | BRD becomes a spec that nobody reads |
| Making tech stack a footnote | Every team will have a different interpretation of "just use Kafka" |
| Writing LLD before BRD is stable | You'll design for features that get cut |

---

## Real Example from This Project

| Layer | Document | Pages |
|-------|----------|-------|
| BRD | `BRD.md` | ~10 pages |
| Tech Stack | `TECH_STACK.md` | ~6 pages |
| HLD | `HLD.md` | ~25 pages |
| LLD Backend | `LLD_BACKEND.md` | ~19 pages |
| LLD Frontend | `LLD_FRONTEND.md` | ~12 pages |
| API Spec | `API.md` | ~30 pages |
| Implementation | ~40 backend route files + ~30 frontend components | — |
