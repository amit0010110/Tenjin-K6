# Skill: Documentation-First Development

> Treat every document as a first-class deliverable. Write the documentation before (or at least parallel to) the code. The docs are the source of truth; the code is an implementation detail.

---

## What It Is

The discipline of creating structured, comprehensive documentation at every level of the system — requirements, architecture, API contracts, design tokens, operations — and treating these documents as **assets that drive and validate the implementation**. You write docs not as an afterthought but as the blueprint.

```
BRD ─→ Architecture Decision ─→ HLD ─→ LLD ─→ API Spec ─→ UI Tokens ─→ Code
  │         │                   │       │         │            │
  └─ All docs are reviewed, stored, versioned alongside the code
```

---

## Document Types

| Document | Audience | Answers | Written When |
|----------|----------|---------|-------------|
| **BRD** | Stakeholders, PMs | What are we building and why? | Before any design |
| **Tech Stack** | Engineers | What tools and why these? | Before HLD |
| **ADR** | Engineers (future) | Why did we make this choice? | At decision time |
| **HLD** | Engineers, Architects | How do the big pieces fit? | Before LLD |
| **LLD** | Implementing engineers | What exactly needs to be built? | Before coding |
| **API Spec** | Integrators, Frontend | What endpoints exist? What do they return? | Before or during implementation |
| **UI Tokens** | Designers, Engineers | What are the design system values? | Before or during frontend |
| **Operations Guide** | Ops, SRE | How do we run this? What goes wrong? | Before deployment |
| **Runbook** | On-call engineers | How do we fix common issues? | After first incident |

---

## When To Use

- **Starting a new project** — BRD → Tech Stack → HLD → LLD → API → Code
- **Adding a major feature** — mini versions of the same stack
- **Handing off to another team** — documentation is the primary deliverable
- **Open sourcing** — docs are the product for new users
- **Compliance / regulated environments** — docs are legally required
- **After a production incident** — write the runbook entry

---

## Workflow

### Step 1: Map the Document Tree

Before writing anything, decide what documents you need:

```
Distributed Cloud / SaaS Platform (Example Project)

├─ BRD.md              → Business requirements, functional modules
├─ TECH_STACK.md       → Every dependency with version and purpose
├─ HLD.md              → System architecture, data flow, security
├─ LLD_BACKEND.md      → 32 route modules, worker infra, DB schema
├─ LLD_FRONTEND.md     → Component tree, data layer, UI states
├─ API.md              → Every endpoint with request/response schemas
├─ UI_TOKENS.md        → Colors, typography, shadows, component tokens
└─ TOKENS.md           → Auth tokens (PAT, API Key, JWT) for external use
```

### Step 2: Write Documents in Dependency Order

Each document references the previous ones:

```
BRD defines the "what"
  → Tech Stack defines the "with what"
    → HLD defines the "big picture how"
      → LLD defines the "detailed how"
        → API.md defines the "interface"
          → UI_TOKENS.md defines the "look"
```

### Step 3: Use Documents as Implementation Checklists

The LLD becomes your task list:
```markdown
LLD section: Worker Routes
  
  [ ] GET  /projects/:pid/workers     → list workers
  [ ] POST /projects/:pid/workers     → create worker
  [ ] POST /workers/:id/start         → start agent
  [ ] POST /workers/:id/stop          → stop agent
  [ ] POST /workers/heartbeat         → receive heartbeat
  [ ] POST /runs/:id/metrics          → ingest metrics
  [ ] POST /runs/:id/complete         → handle completion
```

Check off items as you implement. If you can't implement exactly what's documented, update the doc first, then implement.

### Step 4: Keep Documents in the Same Repository

```
project-root/
├─ BRD.md
├─ TECH_STACK.md
├─ HLD.md
├─ LLD_BACKEND.md
├─ LLD_FRONTEND.md
├─ API.md
├─ UI_TOKENS.md
├─ TOKENS.md
├─ packages/
│   ├─ backend/
│   ├─ frontend/
│   └─ worker-agent/
```

**Why co-located:**
- Docs are found naturally by anyone exploring the repo
- PRs can include doc changes alongside code changes
- Version history ties docs to the code they describe

### Step 5: Review Documents Like Code

Apply code review practices to documentation:
- **Spell check and grammar** — errors erode trust
- **Is it accurate?** — test the API examples with curl
- **Is it complete?** — are all endpoints covered? All states?
- **Is it current?** — do the screenshots match the current UI?

---

## Templates

### Document Header Template

```markdown
# {Title}

## Status
{Draft | Review | Current | Deprecated}

## Last Updated
{date}

## Audience
{who should read this}

## Prerequisites
{what docs or knowledge are assumed}

## Contents
{link to related documents}
```

### Document Quality Checklist

```
□ 1. Title clearly states what the document covers
□ 2. Audience is identified
□ 3. All technical terms are defined or linked
□ 4. Examples are tested and accurate
□ 5. All sections are filled (no TODO markers)
□ 6. Status and last-updated date are present
□ 7. Related documents are linked
□ 8. Code blocks are syntax-highlighted
□ 9. Tables are used for structured data
□ 10. Someone unfamiliar with the system can understand it
```

---

## Real Example from This Project

**Documents created in sequence:**

| Order | Document | Purpose | Pages |
|-------|----------|---------|-------|
| 1 | `BRD.md` | Define what the system does, 11 functional modules | 10 |
| 2 | `TECH_STACK.md` | Choose and justify every dependency | 6 |
| 3 | `HLD.md` | Architecture, deployment, data flow, security | 25 |
| 4 | `LLD_BACKEND.md` | All routes, worker infra, error handling, DB | 19 |
| 5 | `LLD_FRONTEND.md` | Components, data layer, UI states | 12 |
| 6 | `API.md` | Complete API reference (120+ endpoints) | 30 |
| 7 | `UI_TOKENS.md` | Design system tokens for reuse | 15 |
| 8 | `TOKENS.md` | Auth token formats and usage | 8 |

All 8 documents were written **before or during implementation**, not after. The LLD drove the code structure, the API spec drove route implementation, and the UI tokens drove component design.

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Writing docs after the code | They're always out of date, nobody trusts them |
| Docs in a separate wiki | They rot, no version history, no correlation to code |
| Over-documenting obvious things | Developers stop reading because there's too much noise |
| No audience awareness | BRD language for engineers, API spec language for integrators |
| Code examples that don't work | Destroy trust in the entire document |
| Documents without a clear owner | Nobody updates them when things change |
| "The code is self-documenting" | Code explains HOW, not WHY. Design intent lives in docs. |
