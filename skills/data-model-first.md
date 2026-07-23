# Skill: Data-Model-First Design

> Define the schema before the API, the API before the UI. Every feature starts with "what data lives here?"

---

## What It Is

The discipline of designing the **entity relationships, field types, constraints, and indexes** before writing any route handler or component. You think in schemas first — the code is just a mechanical translation of the model.

```
Question                  →  What entities?
Entity Relationships      →  How do they relate? (1:1, 1:N, M:N)
Fields + Types            →  What data does each entity hold?
Constraints               →  What must be unique? What can be null?
Indexes                   →  What queries will we run?
API Design                →  What endpoints map to what CRUD?
UI Components             →  What form fields map to what schema fields?
```

---

## When To Use

- Designing a **new database table** or Prisma model
- Adding a **new feature** that stores data
- **Integrating** with an external system (you need to map their schema to yours)
- Debugging a performance issue (bad index? missing relation?)
- Any time you need to answer "can I query X from Y?"

---

## Workflow

### Step 1: Identify Entities

List every **noun** in the feature description:
- "Users can create **scripts** with **configs** and run them as **test runs**"
- Entities: User, Script, Config, TestRun

### Step 2: Define Relationships

Ask for each pair:
- Can one Script have many Configs? → Script 1:N Config
- Can one Config belong to many Scripts? → No → Config belongsTo Script
- Can a TestRun have multiple Workers? → TestRun M:N Worker → join table WorkerRunAssignment

**Relationship patterns:**
```
Owner (User 1:N Project)
Parent-child (Project 1:N Script)
Join table (TestRun M:N Worker → WorkerRunAssignment)
Self-referential (Script -> ScriptVersion with scriptId FK)
Polymorphic (AuditLog with entity + entityId string)
```

### Step 3: Model Fields

For each entity, define:
- **Primary key**: UUID or autoincrement?
- **Foreign keys**: What does it reference? CASCADE or SET NULL on delete?
- **Scalar fields**: What type? Optional? Default?
- **JSON-in-string**: When schema-less data is needed (options, envVars, tags)

**Example from this project:**
```prisma
model TestRun {
  id              String   @id @default(uuid())
  status          String   @default("pending")
  scriptId        String
  projectId       String
  userId          String
  testConfigId    String?
  triggerType     String   @default("manual")
  suiteRunId      String?  @map("suite_run_id")

  script          Script   @relation(fields: [scriptId], references: [id])
  config          TestConfig? @relation(fields: [testConfigId], references: [id], onDelete: SetNull)
  results         TestResult[]
  assignments     WorkerRunAssignment[]
}
```

**Key decision points:**
| Question | This project's choice |
|----------|----------------------|
| ID format | UUIDv4 | 
| Cascade or SetNull | Cascade for strong children, SetNull for optional refs |
| Enums | String field (SQLite limitation) |
| JSON storage | String field, JSON.stringify/parse in code |

### Step 4: Add Indexes

Look at your planned queries and add indexes:
```prisma
@@index([testRunId])     // fetching all points for a run
@@index([projectId, createdAt])  // audit log pagination by project
@@unique([projectId, userId])    // prevent duplicate members
@@unique([scriptId, version])    // each version is unique per script
```

### Step 5: Derive API from Models

Each entity usually gets a CRUD route pattern:
```
GET    /entities       → findMany
POST   /entities       → create
GET    /entities/:id   → findUnique
PUT    /entities/:id   → update
DELETE /entities/:id   → delete
```

Plus relation-aware variants:
```
GET  /scripts/:sid/configs       → configs belonging to a script
POST /projects/:pid/scripts      → create a script in a project
```

### Step 6: Drive UI from API

- **List page** → maps to GET with filters + pagination
- **Form page** → maps to POST/PUT with field types derived from Prisma types
- **Detail page** → maps to GET :id with includes
- **Delete action** → maps to DELETE with confirmation

**State coverage derived from schema:**
- `null` fields → show "Not set" in UI
- `optional` relations → handle missing related entity
- `unique` constraints → 409 conflict handling in UI

---

## Templates

### Schema Review Checklist

```
□ 1. Every entity identified from the feature description?
□ 2. Relationships correct cardinality? (1:1, 1:N, M:N)
□ 3. Foreign key delete behavior chosen? (CASCADE / SET NULL / RESTRICT)
□ 4. All fields have a type, default, and nullable decision?
□ 5. Indexes added for planned queries?
□ 6. Unique constraints added for business rules?
□ 7. JSON-in-string fields identified and documented?
□ 8. API routes derived from CRUD + relations?
□ 9. UI states derived from nullable/optional fields?
```

### Prisma Model Template

```prisma
model EntityName {
  id         String   @id @default(uuid())
  // Foreign keys
  parentId   String   @map("parent_id")
  // Business fields
  name       String
  status     String   @default("pending")
  // Optional / nullable
  description String?
  // JSON storage
  metadata   String   @default("{}")
  // Timestamps
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // Relations
  parent     ParentModel @relation(fields: [parentId], references: [id], onDelete: Cascade)
  children   ChildModel[]

  // Indexes
  @@index([parentId])
  @@index([status])
}
```

---

## Real Example from This Project

When adding distributed execution, the first thing designed was the join table:

```prisma
model WorkerRunAssignment {
  id         String    @id @default(uuid())
  runId      String    @map("run_id")
  workerId   String    @map("worker_id")
  vus        Int
  status     String    @default("pending")
  reason     String?
  startedAt  DateTime?
  finishedAt DateTime?

  run    TestRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  worker Worker  @relation(fields: [workerId], references: [id])

  @@index([runId])
  @@index([workerId])
}
```

This drove the entire feature:
- API: `GET /runs/:id/assignments` — reads from this table
- API: `POST /projects/:pid/configs/:configId/distribute` — creates rows in this table
- Worker completion handler — updates `status` and `finishedAt`
- Frontend Workers page — shows `_count.assignments`
- Frontend RunDetail — new "Assignments" tab showing each worker's status

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Adding fields ad-hoc as you code | Migrations become hard to track, schema drifts from reality |
| Using JSON for everything | You lose type safety, indexing, and query ability |
| Forgetting cascade behavior | You get foreign key constraint errors in production |
| No indexes on FK columns | JOIN queries slow down as data grows |
| Making everything required | You'll fight with migration defaults later |
| Designing UI before schema | UI form fields won't match data types |
