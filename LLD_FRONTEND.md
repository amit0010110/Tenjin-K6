# Low-Level Design — Frontend (packages/frontend)

## 1. Technology Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Routing | react-router-dom v6 |
| State management | React Query (TanStack Query v5) + React Context |
| Forms | react-hook-form + @hookform/resolvers (Zod) |
| Styling | Tailwind CSS v3 + Headless UI + Heroicons |
| WebSocket | Native WebSocket with reconnection |
| Charts | recharts |
| Rich text | @uiw/react-md-editor (markdown notes) |
| HTTP client | Native fetch wrapped via api/client.ts |
| Code editor | @monaco-editor/react |

---

## 2. Application Shell

### File: `src/App.tsx`

```
<QueryClientProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <!-- All authenticated routes -->
      </Route>
    </Routes>
  </BrowserRouter>
</QueryClientProvider>
```

### File: `src/components/Layout.tsx`

```
<div style={{ display: 'flex', height: '100vh' }}>
  <aside>   <!-- Left sidebar -->
    - Brand logo + app name
    - Project selector dropdown
    - Nav links (Dashboard, Scripts, Suites, Workers, Settings, ...)
    - User menu (profile, logout)
    - Theme toggle (light/dark)
  </aside>
  <main>   <!-- Content area -->
    <header>Breadcrumb + page title + action buttons</header>
    <Outlet />   <!-- react-router child routes -->
  </main>
</div>
```

**Theme Implementation:**
```tsx
function Layout() {
  const [dark, setDark] = useState(() => 
    document.documentElement.classList.contains('dark')
  )

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  // Sidebar uses Tailwind dark: variants
  // <aside className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 ...">
}
```

---

## 3. Route Map

| Path | Component | Data Dependencies |
|---|---|---|
| `/login` | LoginPage | — |
| `/` | Dashboard | GET /projects → GET /dashboard/:pid |
| `/projects/:pid/scripts` | ScriptList | GET /projects/:pid/scripts |
| `/projects/:pid/scripts/:sid/edit` | ScriptEditor | GET /scripts/:id, GET /scripts/:sid/configs |
| `/projects/:pid/scripts/:sid/runs` | RunHistory | GET /runs?projectId=&scriptId= |
| `/projects/:pid/scripts/:sid/versions` | VersionHistory | GET /scripts/:sid/versions |
| `/projects/:pid/configs` | ConfigList | GET /projects/:pid/configs |
| `/projects/:pid/configs/:cid/run` | RunDetail | GET /runs/:id, GET /runs/:id/results |
| `/projects/:pid/suites` | SuiteList | GET /projects/:pid/suites |
| `/projects/:pid/suites/:suid` | SuiteDetail | GET /suites/:id, GET /suites/:id/runs |
| `/projects/:pid/workers` | Workers | GET /projects/:pid/workers |
| `/projects/:pid/schedules` | ScheduleList | GET /configs/:id/schedules |
| `/projects/:pid/settings` | ProjectSettings | GET /projects/:pid |
| `/projects/:pid/settings/*` | members, alerts, etc. | Various sub-tabs |
| `/projects/:pid/plans` | PlanList | GET /projects/:pid/plans |
| `/projects/:pid/record` | Recording | Various |

---

## 4. Component Tree (Key Pages)

### 4.1 ScriptEditor (`pages/ScriptEditor.tsx`)

```
ScriptEditor
├── Top bar
│   ├── Script name input
│   ├── Config selector dropdown
│   ├── Run button → POST /configs/:id/run
│   ├── Distribute button → POST /projects/:pid/configs/:configId/distribute
│   └── Save button → PUT /scripts/:id
├── Editor + preview split (resize handle)
│   ├── Monaco Editor (code or visual blocks)
│   ├── VisualBlockEditor (drag-drop blocks → code generation)
│   ├── Split toggle (code/visual/split)
│   └── Real-time preview
├── Bottom panel
│   ├── Console tab (live run output via WebSocket)
│   ├── Results tab (WebSocket metrics → line chart)
│   └── Config editor tab (JSON form for TestConfig)
```

**Data Flow for Run:**
```
1. User clicks "Run"
2. api.runFromConfig(configId) → POST /configs/:id/run
3. Response: { runId }
4. navigate to /projects/:pid/workers OR set state to show live view
```

**Data Flow for Distribute:**
```
1. User selects workers, sets VU split
2. api.distributeRun(projectId, configId, { workerAssignments })
   → POST /projects/:pid/configs/:configId/distribute
3. Backend creates assignments, dispatches to each worker
4. navigate to run detail page showing per-worker status
```

### 4.2 Workers (`pages/Workers.tsx`)

```
Workers
├── Add worker panel
│   ├── Name, URL, capacity fields
│   ├── Launch Type toggle: Local | Kubernetes
│   ├── Namespace field (visible when K8s)
│   └── Add button
├── Worker list
│   ├── Each worker card:
│   │   ├── Name, URL, status badge online/offline
│   │   ├── Launch type badge + namespace
│   │   ├── Capacity gauge
│   │   ├── Assignments count
│   │   ├── Last heartbeat timestamp
│   │   └── Actions:
│   │       ├── Start → POST /workers/:id/start
│   │       ├── Stop → POST /workers/:id/stop
│   │       ├── Copy Setup → copies CLI command
│   │       ├── Edit → opens modal
│   │       └── Delete → confirmation → DELETE /workers/:id
│   └── Empty state when no workers
```

### 4.3 RunDetail (`pages/RunDetail.tsx`)

```
RunDetail
├── Run header
│   ├── Status badge (running/completed/failed/aborted)
│   ├── Script name + version
│   ├── Config name
│   ├── Options summary (VUs, duration, stages)
│   ├── Timestamps (created, started, completed)
│   └── Action buttons: Abort, Delete, Export (JSON/JUnit/Prometheus)
├── Results overview tab
│   ├── Summary cards (total requests, success rate, avg latency)
│   ├── Key metrics table (name, min, avg, max, p90, p95, p99)
│   └── Threshold results (pass/fail badges)
├── Charts tab
│   └── Live/static charts from recharts:
│       ├── Latency over time (line chart, colored by metric)
│       └── RPS over time (line chart)
├── Request logs tab
│   └── Filterable table: URL, method, status, duration, timestamp
├── Assignments tab (distributed runs only)
│   └── Per-worker: status, VU range, error, startedAt, completedAt
└── Notes tab
    └── Markdown editor (react-md-editor) → PATCH /runs/:id/notes
```

**Live WebSocket Connection:**
```tsx
useEffect(() => {
  if (run?.status !== 'running') return
  const ws = new WebSocket(`ws://${host}/api/v1/ws?runId=${runId}`)
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data)
    if (type === 'metric') appendMetricPoint(data)
    if (type === 'status') {
      setRunStatus(data.status)
      if (data.status !== 'running') ws.close()
    }
  }
  return () => ws.close()
}, [runId, run?.status])
```

### 4.4 ProjectSettings (`pages/ProjectSettings.tsx`)

```
ProjectSettings
├── Tab navigation
│   ├── General (name, description)
│   ├── SMTP (email config)
│   ├── Kubernetes (!NEW)
│   ├── Members (role management)
│   ├── Data Files (CSV upload)
│   ├── Audit Log
│   ├── API Keys (PAT management)
│   ├── Webhooks
│   ├── Plugins
│   ├── Retention (data purge)
│   └── Danger Zone (delete project)
├── Kubernetes tab
│   ├── Namespace input
│   ├── Worker image input
│   ├── Image pull policy select
│   ├── Save button (PUT /projects/:pid)
│   └── Pod list table: name, phase, IP, node, age
```

---

## 5. Shared Components

### 5.1 ValidationBadge
```
Props: thresholds (array of { metric, pass/fail, actual, threshold })
Renders: colored badges for each threshold result
```

### 5.2 MetricCard
```
Props: label, value, format (number/duration/percent), trend (up/down/flat)
Renders: card with label, formatted value, and optional trend arrow
```

### 5.3 StatusBadge
```
Props: status
Renders: colored pill (green=completed, yellow=running, red=failed, gray=pending)
```

### 5.4 DataTable
```
Props: columns, rows, sortable columns, filter callback, pagination
Generic reusable table with sort indicators, optional row click
```

---

## 6. Data Layer

### File: `src/api/client.ts`

```
Central HTTP client wrapping fetch with:
- Base URL: /api/v1
- Automatic Authorization header from localStorage JWT
- Content-Type: application/json
- Step Functions naming convention

Function categories:
  - auth: login(), signup(), me(), updateProfile()
  - projects: listProjects(), getProject(), createProject(), updateProject(), deleteProject()
  - scripts: listScripts(), createScript(), getScript(), updateScript(), deleteScript()
  - configs: listConfigs(), createConfig(), updateConfig(), deleteConfig()
  - configs (run): runFromConfig()
  - runs: listRuns(), getRun(), deleteRun(), abortRun(), getResults(), getThresholds(), getRequestLogs(), getAssignments()
  - runs (export): exportJson(), exportJunit(), exportPrometheus()
  - runs (notes): updateNotes()
  - suites: listSuites(), createSuite(), updateSuite(), deleteSuite(), runSuite(), getSuiteRuns()
  - workers: listWorkers(), createWorker(), updateWorker(), deleteWorker(), startWorker(), stopWorker(), getWorkerStatus(), getK8sPods(), distributeRun()
  - workers (agent callbacks): reportMetrics(), reportComplete(), reportStatus(), heartbeat()
  - schedules: listSchedules(), createSchedule(), deleteSchedule()
  - comparison: compareRuns()
  - correlation: autoCorrelate(), analyzeScript(), generateBlocks()
  - environments: listEnvironments(), createEnvironment(), ... setDefault()
  - validation: validateScript()
  - alerts: listAlertRules(), createAlertRule(), ... getAlertHistory()
  - plans: listPlans(), createPlan(), ...
```

### File: `src/hooks/` (React Query hooks)

```
useProjects() → useQuery(['projects'], api.listProjects)
useProject(id) → useQuery(['project', id], () => api.getProject(id))
useScripts(pid) → useQuery(['scripts', pid], ...)

Pattern:
  Create: useMutation(api.createScript, { onSuccess: () => queryClient.invalidateQueries(['scripts', pid]) })
  Update: useMutation(api.updateScript, { onSuccess: ... })
  Delete: useMutation(api.deleteScript, { onSuccess: ... })
```

---

## 7. Key States per Component

| Component | Loading | Empty | Error | Edge Cases |
|---|---|---|---|---|
| ScriptList | Skeleton rows | "No scripts yet" illustration | Inline banner "Failed to load" | Many scripts → pagination |
| ScriptEditor | Monaco loading overlay | New script defaults | Save error toast | Unsaved changes → beforeunload prompt |
| WorkerList | Spinner per card pulse | "Add your first worker" CTA | Inline error per worker | Offline worker → disabled start button |
| RunDetail | Skeleton metric cards | "No results yet" while running | Error state with retry | Distributed run → assignment per worker |
| ProjectSettings | Spinner in tab content | — | Save error banner | K8s config save → no validation of cluster |
| LoginPage | Disabled button + spinner | — | Auth error inline | JWT expiry → redirect to login |
| Dashboard | Chart skeletons | "No runs yet" | Partial failure per card | Large time range → server-side aggregation |

---

## 8. Testing Strategy

```
Framework: Vitest + @testing-library/react

Component tests:
  - Each component renders with mock data
  - Loading states show skeleton/spinner
  - Error states show error message
  - Empty states show fallback UI
  - Form validation on submit
  - Button clicks fire correct API calls

Integration tests:
  - Login → redirect to dashboard
  - Create script → appears in list
  - Run script → WebSocket connects → metrics appear
  - Worker start/stop → status updates

90 unit tests currently passing (5 test files).
```

---

## 9. Test Builder Module (`lib/test-builder/`)

The test builder is a visual block-based test plan editor. It converts a tree of blocks into executable k6 JavaScript, and parses k6 code back into blocks for round-trip editing.

### 9.1 Module Architecture

```
lib/test-builder/
├── types.ts                        # Core interfaces (203 lines) + BLOCK_REGISTRY re-export
├── generator.ts                    # Code generation orchestrator (503 lines)
├── parser.ts                       # k6 code → block tree parser
├── templates.ts                    # Built-in script templates
├── import-curl.ts                  # cURL → block tree
├── import-har.ts                   # HAR → block tree
├── import-postman.ts               # Postman → block tree
├── index.ts                        # Public API barrel exports
│
├── blocks/                         # Block type definitions (split from types.ts)
│   ├── registry.ts                 # Combined BLOCK_REGISTRY
│   ├── scenarios.ts                # scenario, stages-scenario, arrivals-scenario
│   ├── requests.ts                 # http-request, http-batch, grpc-call, websocket, sql-query, dummy-sampler, header-manager, cookie-manager, cache-manager, auth-manager, http-defaults
│   ├── browser.ts                  # browser-page
│   ├── flow.ts                     # group, loop, condition, transaction, throughput, interleave, random-controller, switch, for-each, once-only, runtime, synchronizing-timer
│   ├── validation.ts               # check, assertion, json-assertion, extract-variable
│   ├── timing.ts                   # sleep, wait
│   ├── data.ts                     # data-file, set-variable, counter, random-var
│   ├── metrics-debug.ts            # custom-metric, log, script
│   └── processors.ts               # pre-processor, post-processor
│
└── generators/                     # Code generation functions (split from generator.ts)
    ├── requests.ts                 # genHttpRequest, genHttpBatch, genGrpcCall, genWebSocket, genBrowserPage, genSqlQuery, genDummySampler
    ├── flow.ts                     # genGroup, genLoop, genCondition, genTransaction, genThroughput, genInterleave, genRandomController, genSwitch, genForEach, genOnceOnly, genRuntime, genSynchronizingTimer
    └── scenarios.ts                # generateOptionsForTg (scenario options → TG script config)
```

### 9.2 Block Registry

Each block type is defined in a category file under `blocks/` and combined in `registry.ts`.

```
Core interfaces (types.ts):
  BlockType        — Union of 43 block type strings (http-request, check, group, …)
  TestBlock        — { id, type, label, children[], properties, enabled, elseBlocks? }
  BlockField       — { key, label, type, placeholder, required?, options?, defaultValue?, showIf? }
  BlockTypeDefinition — { type, label, icon, description, color, canHaveChildren, rootOnly?, defaultProperties, fields[] }

Utilities (types.ts):
  createBlock(type, overrides?)   — Create a TestBlock from registry defaults
  validateBlock(block)            — Recursive validation with type-specific rules
  SAMPLER_TYPES                   — Set: http-request, grpc-call, websocket, browser-page, sql-query, dummy-sampler, http-batch
  POST_PROCESSOR_TYPES            — Set: check, assertion, json-assertion, extract-variable, post-processor, log, script, sleep, wait
  BLOCK_REGISTRY                  — Record<BlockType, BlockTypeDefinition> (spread from all category files)

9 categories match the BlockPalette groupings:
  Scenarios       (3)     Flow Control   (12)     Data            (4)
  Requests        (11)    Validation     (4)      Metrics & Debug (3)
  Browser         (1)     Timing         (2)      Processors      (2)
```

### 9.3 Code Generator

The generator converts a block tree into a k6 JavaScript string. Files are under `generators/`.

**Entry point (`generator.ts`):**
```
generateScript(blocks, envVars?) → string
  1. Generate imports (http, ws, browser, grpc, etc.) based on block types used
  2. Generate `export const options = { ... }` via generateOptionsForTg
  3. Generate `export default function() { ... }` body from blocks
  4. Return complete script string
```

**Block dispatch (`genBlock`):**
```
switch(block.type):
  → generators/requests.ts:
    genHttpRequest, genHttpBatch, genGrpcCall, genWebSocket,
    genBrowserPage, genSqlQuery, genDummySampler

  → generators/flow.ts:
    genGroup, genLoop, genCondition, genTransaction, genThroughput,
    genInterleave, genRandomController, genSwitch, genForEach,
    genOnceOnly, genRuntime, genSynchronizingTimer

  → generators/scenarios.ts:
    generateOptionsForTg (scenario blocks → TG options config)

  → types.ts inline generators (via GenContext):
    check, assertion, json-assertion, extract-variable, set-variable,
    custom-metric, sleep, wait, log, script, data-file, pre/post-processor,
    header/cookie/cache/auth-manager, http-defaults
```

**Generated output structure:**
```javascript
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: { http_req_duration: ['p(95)<500'] },
};

export default function () {
  group('Main Flow', function () {
    const res = http.get('https://api.example.com/users');
    check(res, { 'status is 200': (r) => r.status === 200 });
  });
}
```

### 9.4 Templates

Built-in templates provide pre-built block trees and the corresponding k6 code for common test patterns.

**Interface:**
```typescript
interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;           // Generated k6 JavaScript
  blocks?: TestBlock[];   // Block tree (optional — enables visual tree on import)
}
```

**Template categories:**
- REST APIs (health check, CRUD, pagination)
- GraphQL (queries, mutations)
- gRPC (unary, server-streaming)
- WebSocket
- Browser (page interaction)
- Database (SQL queries)
- Auth flows (OAuth2, JWT, Basic)
- Data-driven (CSV, JSON files)
- Distributed tracing
- Real-time (SSE, events)

When a template has `blocks`, importing it calls `syncToCode(template.blocks, true)` — this sets the `internalUpdateRef` guard to prevent the `useEffect` from re-parsing flat code into flat blocks, preserving the parent-child hierarchy.

### 9.5 Parser

```
parser.ts — k6 JavaScript → block tree

parseScript(jsCode) → TestBlock[]
  1. Remove comments, imports, options export
  2. Walk AST-like patterns with regex/string matching:
     - group('name', fn) → TestBlock { type: 'group' }
     - http.get/post/put/delete() → TestBlock { type: 'http-request' }
     - check(res, { ... }) → TestBlock { type: 'check' }
     - sleep(dur) → TestBlock { type: 'sleep' }
     - condition() → TestBlock { type: 'condition' }
  3. Reconstruct nested parent-child relationships from code structure
  4. Return flat list (visual tree re-nests via block IDs and parent references)
```

The parser maintains a `parentStack` during parsing to correctly associate child blocks (checks, extract-variable) with their parent samplers.

---

## 10. Visual Block Editor Components

### 10.1 Component Tree

```
TestBuilder.tsx (27 KB)
├── Top toolbar
│   ├── Code/Visual/Split view toggle
│   ├── Import buttons (cURL, HAR, Postman)
│   ├── Template selector dropdown
│   ├── Run & Save buttons
│   └── Undo/Redo
├── Main area (3-column layout)
│   ├── BlockPalette (left, 121 lines) — draggable block list in collapsible categories
│   ├── VisualTree (center, 194 lines) — block tree canvas
│   │   ├── TreeNode (230 lines) — recursive node with drag-drop, inline actions
│   │   └── ContextMenu (233 lines) — right-click insert/wrap/duplicate/delete
│   └── PropertiesPanel (right, 21 KB) — field editor for selected block
└── Bottom panel
    ├── Code preview (Monaco Editor)
    └── Console / Validation output
```

### 10.2 VisualTree and Sub-components

The original `VisualTree.tsx` (872 lines) was split into 5 single-responsibility files:

```
components/test-builder/
├── VisualTree.tsx     (194 lines) — Orchestrator: manages context menu state, selection, layout
├── TreeNode.tsx       (230 lines) — Recursive node: expand/collapse, drag-drop, inline buttons
├── ContextMenu.tsx    (233 lines) — Right-click menu: insert before/after, add child, wrap, duplicate, delete
├── tree-defs.ts       (125 lines) — Shared constants: COLOR_MAP, getIcon(), INDENT, PADDING_LEFT, BLOCK_CATEGORIES
└── tree-utils.ts      (149 lines) — Pure functions: findBlock, findParent, findAndUpdate, findAndDelete,
                                     moveBlockById, unwrapBlock, insertInList, addChildToList, dupBlock,
                                     wrapFromHere, wrapAllInRoot, isInsideSampler, filterChildTypes, addToContainer
```

**tree-defs.ts — Constants:**
```
COLOR_MAP      — 17 color variants (blue, indigo, purple, cyan, emerald, green, amber, gray, …)
                 with light/dark Tailwind classes: border-{color}-500 bg-{color}-50 dark:bg-{color}-950/30
getIcon(type)  — Maps block type to lucide-react icon name
INDENT         — 20px per nesting level
PADDING_LEFT   — 12px base padding
BLOCK_CATEGORIES — Container types + child type filters for insertion menus
```

**tree-utils.ts — Core Functions:**
```
findBlock(tree, id)           — DFS search for block by ID
findParent(tree, id)          — Find parent of block by ID
findAndUpdate(tree, id, cb)   — Immutable update: find node, apply callback, return new tree
findAndDelete(tree, id)       — Remove block, return { tree, deleted }
moveBlockById(tree, id, toId, position) — Move block to new parent/position
unwrapBlock(tree, id)         — Remove container, promote children to parent
insertInList(list, item, idx) — Insert item at index
addChildToList(block, child, idx?) — Add child at position
dupBlock(block)               — Deep clone with new IDs
wrapFromHere(tree, id, wrapperType) — Wrap block in a new container
wrapAllInRoot(tree, wrapperType)     — Wrap all root blocks in a container
```

**TreeNode.tsx — Props and States:**
```
Props: block, depth, selectedId, dragOverId, dragOverPosition, onSelect, onUpdate, ...
Local state: expanded (children visibility), showActions (hover toolbar)

Rendering per node:
  [expand arrow] [icon] [label] [type badge] [inline actions on hover]
    Move up/down  |  Duplicate  |  Delete  |  Unwrap (containers only)

Drag-and-drop:
  onDragStart — set dragged block ID
  onDragOver — determine position (above/below/inside based on cursor Y within element)
  onDrop — call moveBlockById
```

**ContextMenu.tsx — Menu Structure:**
```
Right-click on block:
├── Insert Before    → submenu of compatible block types
├── Insert After     → submenu of compatible block types
├── Add Child        → submenu (only for canHaveChildren blocks)
├── Wrap from Here   → submenu of container types
├── Duplicate        → dupBlock(block)
├── Unwrap           → unwrapBlock(tree, id) (containers only)
└── Delete           → findAndDelete(tree, id)
```

**VisualTree.tsx — Orchestrator:**
```
State:
  contextMenu — { x, y, blockId } | null
  selectedId — currently selected block ID
  dragOverId, dragOverPosition — drag-drop state

Rendering:
  Droppable root area → TreeNode list
  ContextMenu overlay (positioned at cursor)
  Empty state when no blocks
```

### 10.3 BlockPalette (Collapsible Categories)

```
BlockPalette.tsx (121 lines)

9 categories matching block registry groupings:
  Scenarios       → scenario, stages-scenario, arrivals-scenario
  Requests        → http-request, http-batch, grpc-call, websocket, sql-query, dummy-sampler, header-manager, cookie-manager, cache-manager, auth-manager, http-defaults
  Browser         → browser-page  (collapsed by default)
  Flow Control    → group, loop, condition, transaction, throughput, interleave, random-controller, switch, for-each, once-only, runtime, synchronizing-timer
  Validation      → check, assertion, json-assertion, extract-variable
  Timing          → sleep, wait
  Data            → data-file, set-variable, counter, random-var
  Metrics & Debug → custom-metric, log, script  (collapsed by default)
  Processors      → pre-processor, post-processor  (collapsed by default)

Expand/Collapse:
  State: Set<string> of expanded category labels
  Default: all expanded except Browser, Metrics & Debug, Processors
  ChevronRight icon rotates 90° on expand via CSS transition
  Search input filters blocks by label or description

Drag from palette:
  onDragStart sets 'block-type' data transfer
  VisualTree's onDrop creates block via createBlock and adds to tree
```

### 10.4 PropertiesPanel

```
PropertiesPanel.tsx (21 KB)

When a block is selected in the VisualTree, the PropertiesPanel renders:
  - Block label input
  - Toggle: enabled/disabled
  - Dynamic field list from BLOCK_REGISTRY[type].fields

Field types:
  string    → text input
  number    → number input
  boolean   → toggle switch
  select    → dropdown (with showIf conditional visibility)
  code      → small Monaco Editor
  headers   → key-value pair list
  json      → JSON textarea
  stages    → stage table (duration + target rows)
  data-file → file selector dropdown

Conditional fields (showIf):
  Used by auth-manager (authType → shows different fields per type)
  and other blocks with mode-dependent properties.

Validation:
  validateBlock(block) checks required fields and type-specific rules
  Errors displayed inline next to each field
```

### 10.5 ProjectNav (Collapsible Navigation)

```
ProjectNav.tsx

7 navigation groups in the sidebar:
  Dashboard       → expanded by default
  Testing         → expanded by default (Scripts, Suites, Recording)
  Plans           → expanded by default
  Integrate       → collapsed by default (Environments, Data Files, Git Repos, DB Connections)
  Infrastructure  → collapsed by default (Workers, Schedules)
  Admin           → collapsed by default (Settings, Members, Audit Log, API Keys, Plugins)
  Help & Support  → expanded by default

Same expand/collapse pattern as BlockPalette:
  Set<SectionId> state
  ChevronRight rotation animation
  localStorage persistence for user preference
