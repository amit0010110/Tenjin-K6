# Skill: Meta-Cognitive Planning

> Step back from the work and analyze how you work. Optimize your process, build accelerators, and encode your methodology so you can repeat it without retracing your steps.

---

## What It Is

The ability to observe your own working patterns, extract the implicit methodology, and formalize it into **reusable templates, checklists, and workflows**. You don't just build the product — you build the process that builds the product.

```
Work on a project
  │
  └─ Observe: what patterns do I follow?
      │
      ├─ What questions do I ask first?
      ├─ What order do I do things in?
      ├─ What mistakes do I make repeatedly?
      └─ What accelerators can I build?
          │
          └─ Create templates, skills, generators
              │
              └─ Next project → reuse the system
```

---

## When To Use

- **After completing a major project** — extract lessons and templates
- **Before starting a new project** — set up your accelerators
- **When you notice yourself doing the same thing twice** — automate or template it
- **When onboarding someone** — your methodology is the fastest way to bring them up to speed
- **At regular intervals** — quarterly reflection on process improvement

---

## Workflow

### Step 1: Retrospect — What Did I Actually Do?

After a project, list what you did in order:

```
1. Asked "what are the entities and relationships?"
2. Asked "what's the single run vs suite run flow?"
3. Asked "how does distributed execution work?"
4. Recommended HTTP dispatch over RabbitMQ
5. Implemented worker agent bottom-up
6. Added K8s integration
7. Fixed sidebar theme bug
8. Created documentation package (BRD → HLD → LLD → API → UI Tokens)
9. Asked "what skills did I use?" and created this document
```

### Step 2: Extract the Patterns

From the retrospective, identify recurring behaviors:

| Pattern | Frequency | What to Do |
|---------|-----------|------------|
| Ask about data model first | Every feature | Create a schema-first checklist |
| Ask about execution flow | Before implementing | Create flow mapping template |
| Compare technologies on dimensions | Infrastructure decisions | Create trade-off scorecard |
| Build bottom-up for traceability | New component systems | Create phased implementation template |
| Extract design tokens from UI | Every frontend project | Create token extraction checklist |
| Document everything | Every significant feature | Create document hierarchy template |

### Step 3: Create Reusable Assets

For each pattern, build an accelerator:

**Templates:** BRD template, LLD template, API spec template, trade-off scorecard
**Checklists:** Schema review checklist, flow mapping checklist, token extraction checklist
**Generators:** Shell scripts that scaffold project directories, seed files
**Skills:** This skill set — encoded methodology for future reference

### Step 4: Test Your Accelerators on the Next Project

When starting a new project:
1. Open your BRD template
2. Open your trade-off scorecard when making infrastructure decisions
3. Follow your implementation phasing template
4. Use your document checklist before calling work done

**If something is missing or awkward, update the template.** The meta-skill is the meta-loop: use → improve → reuse.

---

## The Accelerators You Built (from this project)

### Template: Project Document Stack

```
Project Root
├─ BRD.md
├─ TECH_STACK.md
├─ HLD.md
├─ LLD_BACKEND.md
├─ LLD_FRONTEND.md
├─ API.md
├─ UI_TOKENS.md
└─ TOKENS.md
```

Use this as the starting directory for any new application.

### Template: BRD Generator

```
Questions to answer:
1. What is the one-sentence objective?
2. Who are the actors?
3. What are the functional modules? (numbered list)
4. What are the constraints? (tech, business, timeline)
5. What is explicitly out of scope?
```

### Template: Architecture Decision Record

```markdown
# ADR-{number}: {title}

## Context
{what problem}

## Options
{A: ..., B: ...}

## Decision
{chosen option}

## Rationale
{why}

## Consequences
{what changes}
```

### Template: Trace Document

```markdown
## Trace: {name}
1. Frontend: {file} → {function}
2. Backend: {file} → {route handler}
3. Worker: {file} → {handler}
4. External: {system} → {interaction}
5. Callback: {file} → {handler}
```

---

## Building Your Own Skill System

Use these files in `skills/` as a starting point. Each skill is a self-contained methodology document:

```
skills/
├── README.md                       ← this meta-index
├── layered-decomposition.md        ← BRD → HLD → LLD → Code
├── data-model-first.md             ← Schema before API, API before UI
├── flow-orchestration.md           ← State machines, event flows, distributed traces
├── architecture-tradeoffs.md       ← Compare options on explicit dimensions
├── trace-driven-implementation.md  ← One path through the system at a time
├── design-system-extraction.md     ← Extract UI tokens and reusable components
├── documentation-first.md          ← Docs as first-class deliverables
└── meta-cognitive-planning.md      ← This file — building the process itself
```

**To use the skills on your next project:**
1. `cp -r skills/ ../next-project/skills/`
2. Open `layered-decomposition.md` — follow the workflow
3. When you hit a trade-off, open `architecture-tradeoffs.md`
4. When you design a data model, open `data-model-first.md`
5. When you implement, open `trace-driven-implementation.md`

---

## Real Example: The Meta-Analysis

The fact that you asked me "based on my prompting, what are my skills?" is itself the meta-cognitive skill in action. You:
1. Observed that you prompted in a specific way (layered, model-first, flow-aware)
2. Recognized these as transferable patterns (not just one-time behaviors)
3. Asked for them to be formalized (this skill set)
4. Requested them in file format (reusable for next project)

This is exactly how process optimization works. You're not just building software — you're building the methodology for building software.

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Never retrospecting | You repeat the same mistakes on every project |
| Building templates that are too rigid | Every project is different — templates should guide, not prescribe |
| Not using your own accelerators | Creating templates but ignoring them next time |
| Optimizing processes that aren't broken | 80% of process improvement comes from fixing the 20% that hurts |
| Keeping methodology in your head | It dies when you leave the team or forget |
| Building before understanding | The meta-skill says: step back, think, then act. Skipping the step-back costs time. |
