# Skill: Code Structure & Standards

> Enforce consistent file size limits, module splitting patterns, and code conventions across the project. Apply these standards to any new feature or refactoring task.

---

## What It Is

A set of structural rules and decomposition patterns that keep every source file under 400 lines with single-responsibility boundaries. When a file exceeds the limit, split it predictably using established patterns for block registries, code generators, component trees, and UI interactions.

```
File size limit:    400 lines max
Split direction:    One concept → One file
Import style:       Barrel re-exports preserve backward compatibility
Testing:            TypeScript compiles clean; all existing tests pass after split
```

---

## When To Use

- A source file exceeds **400 lines** — time to split
- Adding a **new block type** to the registry
- Adding a **new code generator** for a block type
- Adding a **new UI component** with sub-components
- Any time you ask "where does this code go?"
- Refactoring a legacy file that's grown too large

---

## Workflow

### Step 1: Detect the Threshold

Run `wc -l` on files. Any file over 400 lines is a candidate. Prioritize files that are:
- Most frequently modified
- Imported by the most other modules
- The largest

### Step 2: Identify the Split Axis

Read the file and group exports by responsibility. Common split axes:

| Original File | Split Into |
|---|---|
| `types.ts` (block definitions) | `blocks/{category}.ts` files + `blocks/registry.ts` |
| `generator.ts` (code gen) | `generators/{category}.ts` + main dispatcher |
| `VisualTree.tsx` (component) | `TreeNode.tsx` + `ContextMenu.tsx` + `tree-utils.ts` + `tree-defs.ts` + orchestrator |
| `TestBuilder.tsx` | Toolbar + template panel + main layout |

### Step 3: Create the Category Files

For block registries and generators, group by the UI categories they appear in (match `BlockPalette.tsx` categories):

```
blocks/
├── scenarios.ts        → scenario, stages-scenario, arrivals-scenario
├── requests.ts         → http-request, http-batch, grpc-call, websocket, ...
├── browser.ts          → browser-page
├── flow.ts             → group, loop, condition, transaction, ...
├── validation.ts       → check, assertion, json-assertion, extract-variable
├── timing.ts           → sleep, wait
├── data.ts             → data-file, set-variable, counter, random-var
├── metrics-debug.ts    → custom-metric, log, script
├── processors.ts       → pre-processor, post-processor
└── registry.ts         → import + spread all into BLOCK_REGISTRY
```

Each category file uses `Partial<Record<BlockType, BlockTypeDefinition>>` as the type (since it only contains a subset).

### Step 4: Create the Registry Combinator

```
blocks/registry.ts
  - Import all category modules
  - Spread them into a single export with `as Record<...>` assertion
  - This is the only file that imports all categories
```

### Step 5: Update the Barrel Export

The original file (e.g. `types.ts`) re-exports the combined export:

```typescript
import { BLOCK_REGISTRY } from './blocks/registry';
export { BLOCK_REGISTRY };
```

This preserves **all existing imports** — no consumer needs to change.

### Step 6: Verify

```
npm run typecheck    # Must pass with zero errors
npx vitest run       # Must pass all existing tests
```

---

## Patterns

### Pattern 1: Block Registry Split

**Before:** `types.ts` — 872 lines with inline BLOCK_REGISTRY object

**After:**
- `types.ts` — 205 lines (core types + re-export)
- `blocks/scenarios.ts` — 53 lines
- `blocks/requests.ts` — 196 lines (largest category)
- `blocks/flow.ts` — 151 lines
- `blocks/validation.ts` — 103 lines
- `blocks/timing.ts` — 34 lines
- `blocks/data.ts` — 73 lines
- `blocks/metrics-debug.ts` — 49 lines
- `blocks/processors.ts` — 28 lines
- `blocks/browser.ts` — 17 lines
- `blocks/registry.ts` — 22 lines (combinator)

**Rules:**
- Each category file uses `Partial<Record<BlockType, BlockTypeDefinition>>`
- `registry.ts` uses `as Record<BlockType, BlockTypeDefinition>` assertion
- `types.ts` does `import + export` (not `export ... from`)
- All category files import types from `../types` (circular-safe since types only re-exports)

### Pattern 2: Generator Split

**Before:** `generator.ts` — 923 lines with all gen* functions inline

**After:**
- `generators/requests.ts` — genHttpRequest, genHttpBatch, genGrpcCall, genWebSocket, genBrowserPage, genSqlQuery, genDummySampler + local helpers
- `generators/flow.ts` — genGroup, genLoop, genCondition, genTransaction, genThroughput, genInterleave, genRandomController, genSwitch, genForEach, genOnceOnly, genRuntime, genSynchronizingTimer
- `generators/scenarios.ts` — generateOptionsForTg, TG_TYPES
- `generator.ts` — GenContext, generateScript, genBlock switch (delegates to generators/), buildCheckExpr, sanitizeLabel, hasRequestInTree, collectDataFilesRecursive

**Rules:**
- Main `generator.ts` keeps: shared types (GenContext), the generateScript orchestrator, the genBlock dispatcher switch, and utility functions used by multiple categories
- Each `generators/{category}.ts` exports individual gen* functions
- Category generators import `TestBlock` from `../types`
- The switch in genBlock imports and calls category generators

### Pattern 3: Visual Tree Component Split

**Before:** `VisualTree.tsx` — 872 lines (tree rendering + context menu + drag-drop + tree utilities)

**After:**
- `tree-defs.ts` — Constants: COLOR_MAP, getIcon(), INDENT, PADDING_LEFT, BLOCK_CATEGORIES
- `tree-utils.ts` — Pure functions: findBlock, findParent, findAndUpdate, findAndDelete, moveBlockById, unwrapBlock, insertInList, addChildToList, dupBlock, wrapFromHere, wrapAllInRoot, isInsideSampler, filterChildTypes, addToContainer
- `TreeNode.tsx` — Recursive node component: expand/collapse, drag-drop handlers, inline action buttons (move up/down, duplicate, delete, unwrap)
- `ContextMenu.tsx` — Right-click context menu: Insert Before/After, Add Child, Wrap from Here, Duplicate, Unwrap, Delete (with submenus for block type selection)
- `VisualTree.tsx` — Orchestrator: manages contextMenu state, selectedId, dragOver state; renders TreeNode list + ContextMenu overlay

**Rules:**
- `tree-utils.ts` functions are pure — no React, no side effects, fully tested independently
- `tree-defs.ts` has no imports from the component files
- `TreeNode.tsx` renders the recursive structure; `VisualTree.tsx` renders TreeNode
- Each file under 250 lines

### Pattern 4: Collapsible UI Section

Used in `BlockPalette.tsx` and `ProjectNav.tsx`:

```typescript
const [expanded, setExpanded] = useState<Set<string>>(() => {
  const initial = new Set<string>();
  categories.forEach(c => { if (!collapsedByDefault.has(c)) initial.add(c); });
  return initial;
});

// Toggle
onClick={() => {
  setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
}}

// Chevron rotation
<ChevronRight className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
```

**Rules:**
- State is `Set<string>` (not boolean per item) for O(1) lookup
- Default expanded: high-traffic categories; default collapsed: low-traffic ones
- ChevronRight icon rotates 90° on expand via CSS transition
- localStorage persistence optional for ProjectNav

### Pattern 5: Template with Block Tree

For preserving parent-child relationships when importing templates:

```typescript
interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;             // Generated target domain code / script
  blocks?: TestBlock[];     // Block tree (preserves hierarchy)
}

// On import (TestBuilder.tsx):
if (template.blocks) {
  internalUpdateRef.current = true;  // Prevents useEffect re-parse
  syncToCode(template.blocks, true); // Sets blocks + generates code
}
```

**Rules:**
- `internalUpdateRef` guard prevents the `useEffect` (which parses code → flat blocks) from overwriting the tree
- Backend: `assignIds()` recursively assigns UUIDs before saving `Script.blocks`
- Templates without blocks fall back to code-only → parser reconstructs flat blocks

---

## Conventions

### File Organization

```
lib/test-builder/
├── types.ts                    # Core interfaces only
├── blocks/                     # Block type definitions (split by category)
│   └── registry.ts             # Combinator
├── generators/                 # Code generation (split by category)
├── templates.ts                # Built-in script templates
├── parser.ts                   # source code → syntax/block tree
├── generator.ts                # Main generator orchestrator
└── index.ts                    # Barrel exports

components/test-builder/
├── TestBuilder.tsx             # Main orchestrator
├── VisualTree.tsx              # Tree orchestrator (small)
├── TreeNode.tsx                # Recursive node
├── ContextMenu.tsx             # Right-click menu
├── BlockPalette.tsx            # Block palette with collapsible categories
├── PropertiesPanel.tsx         # Property editor
├── tree-defs.ts                # Shared constants
└── tree-utils.ts               # Pure tree functions
```

### Type Safety

- Category files: `Partial<Record<BlockType, BlockTypeDefinition>>`
- Registry: `Record<BlockType, BlockTypeDefinition>` with `as` assertion
- Pure utility functions: fully typed parameters and return values
- No `any` in utility functions

### Imports

- Category files import types from `../types`
- Consumers import from `../types` (barrel) — never directly from `blocks/`
- Generator category files import from `../types` — never from `types.ts`
- `tree-utils.ts` imports from `../../lib/test-builder/types`
- Component files import from `../../lib/test-builder/types`

### Naming

| Convention | Example |
|---|---|
| Category export name matches category | `export const scenarios`, `export const requests` |
| Generator functions: `gen{BlockType}` | `genHttpRequest`, `genGroup`, `genCondition` |
| Tree utilities: camelCase verb | `findBlock`, `moveBlockById`, `unwrapBlock` |
| Defs file: kebab-case | `tree-defs.ts` |

---

## Anti-Patterns

| Anti-Pattern | Why | Correct Approach |
|---|---|---|
| Exporting from both `types.ts` and `blocks/` directly | Confuses consumers, creates import inconsistency | All consumers import from `types.ts` only; it re-exports `BLOCK_REGISTRY` |
| Importing `Partial<Record<K,V>>` directly in registry | TS error on spread into `Record<K,V>` | Use `as Record<K,V>` assertion in the combinator |
| Keeping inline action handlers in tree-utils | tree-utils must be pure (no React state) | Put stateful handlers in TreeNode.tsx or VisualTree.tsx |
| Boolean state per collapsible item | N `useState` calls, hard to manage | Single `Set<string>` state |
| One giant file with multiple responsibilities | Hard to test, reason about, or diff | Split at 400 lines using patterns above |
| Generator switch in a separate file from dispatcher | Cyclic imports, harder to trace | Keep genBlock switch in generator.ts; category files export gen* functions |

---

## Verification Checklist

After applying any split:

- [ ] `npm run typecheck` passes (both frontend and backend)
- [ ] `npx vitest run` passes all tests
- [ ] Every file is under 400 lines
- [ ] Category files have the correct `Partial<Record<...>>` type
- [ ] Registry uses `as Record<...>` assertion
- [ ] No consumer imports changed (barrel re-export)
- [ ] Each file has exactly one responsibility
