# UI Design Tokens

The complete visual design language used in TenjinT6, extracted for reuse in other applications.

---

## 1. Brand Colors

The primary brand palette used for accents, buttons, links, and active states.

```
brand-50  = #eef2ff
brand-100 = #e0e7ff
brand-200 = #c7d2fe
brand-300 = #a5b4fc
brand-400 = #818cf8
brand-500 = #6366f1  ← primary brand color
brand-600 = #4f46e5  ← hover state, active
brand-700 = #4338ca
brand-800 = #3730a3
brand-900 = #312e81
brand-950 = #1e1b4b
```

**Usage:**
- Buttons (primary): `bg-brand-600 text-white hover:bg-brand-700`
- Links: `text-brand-600 dark:text-brand-400`
- Active nav: `text-brand-700 dark:text-brand-300`

---

## 2. Surface / Neutral Palette

The gray/slate palette used for backgrounds, borders, text, and containers.

```
surface-50  = #f8fafc
surface-100 = #f1f5f9
surface-200 = #e2e8f0
surface-300 = #cbd5e1
surface-400 = #94a3b8
surface-500 = #64748b
surface-600 = #475569
surface-700 = #334155
surface-800 = #1e293b
surface-900 = #0f172a
surface-950 = #020617
```

**Light mode defaults:**
```
Page bg:       bg-gray-50           (#f9fafb)
Card/Surface:  bg-white             (#ffffff)
Border:        border-gray-200      (#e5e7eb)
Input border:  border-gray-300      (#d1d5db)
Text primary:  text-gray-900        (#111827)
Text muted:    text-gray-500        (#6b7280)
```

**Dark mode defaults:**
```
Page bg:       dark:bg-gray-950     (#030712)
Card/Surface:  dark:bg-gray-900     (#111827)
Border:        dark:border-gray-800 (#1f2937)
Input border:  dark:border-gray-700 (#374151)
Text primary:  dark:text-gray-100   (#f3f4f6)
Text muted:    dark:text-gray-400   (#9ca3af)
```

---

## 3. Semantic Colors

Used for status indicators, badges, alerts, and charts.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| success / emerald | `#10b981` | `#6ee7b7` | Passed checks, healthy, up |
| warning / amber | `#f59e0b` | `#fbbf24` | P95 metrics, warnings |
| danger / red | `#ef4444` | `#fca5a5` | Failed, errors, p99, abort |
| info / blue | `#3b82f6` | `#60a5fa` | Informational, avg duration |

**Chart data colors (full palette):**
```
#6366f1  (indigo / brand)    — http_req_duration
#ef4444  (red)               — http_req_failed
#10b981  (emerald)           — iterations
#f59e0b  (amber)             — vus
#3b82f6  (blue)              — data_received
#8b5cf6  (violet)            — data_sent
#06b6d4  (cyan)              — http_req_throughput
#ec4899  (pink)              — extra
```

---

## 4. Typography

### Font Families

```
sans: Inter, system-ui, -apple-system, sans-serif
mono: JetBrains Mono, Fira Code, monospace
```

### Font Sizes

| Token | Value | Usage |
|-------|-------|-------|
| 10px | `text-[10px]` | Section headers in nav |
| xs | `0.75rem` (12px) | Badges, labels, footnotes, small buttons |
| sm | `0.875rem` (14px) | Body text, inputs, table cells, buttons |
| base | `1rem` (16px) | Card titles, large buttons |
| lg | `1.125rem` (18px) | Modal titles, section headers |
| 2xl | `1.5rem` (24px) | Page titles, stat values |
| 4xl | `2.25rem` (36px) | Empty state icons |

### Font Weights

| Weight | Class | Usage |
|--------|-------|-------|
| 500 | `font-medium` | Buttons, tabs, labels |
| 600 | `font-semibold` | Card titles, table headers, page titles |
| 700 | `font-bold` | Page header titles, stat values |

### Letter Spacing

| Value | Class | Usage |
|-------|-------|-------|
| 0.12em | `tracking-[0.12em]` | Nav section headers |

---

## 5. Spacing

Uses the default Tailwind spacing scale:

| Token | Pixels | Usage |
|-------|--------|-------|
| 1 | 4px | Tab container padding |
| 1.5 | 6px | Section header margin |
| 2 | 8px | Badge padding, button padding |
| 2.5 | 10px | Small button padding |
| 3 | 12px | Card padding (sm), input padding |
| 4 | 16px | Default padding, gaps |
| 5 | 20px | Card & stat card padding (md) |
| 6 | 24px | Card padding (lg), header padding |
| 56 | 224px | Sidebar width |

---

## 6. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded` | 4px | Skeletons |
| `rounded-lg` | 8px | Buttons, inputs, tabs, nav links |
| `rounded-xl` | 12px | Cards, tables, toasts, dialogs, stat cards, tab container |
| `rounded-2xl` | 16px | Modals, error icon container |
| `rounded-full` | 9999px | Badges, status dots |

---

## 7. Shadows

| Token | Definition |
|-------|-----------|
| `shadow-sm` | Tailwind default: `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `shadow-card` | `0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.06)` |
| `shadow-card-hover` | `0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.08)` |
| `shadow-elevated` | `0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)` |
| `shadow-lg` | Tailwind large: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |
| `shadow-2xl` | Tailwind 2xl: `0 25px 50px -12px rgb(0 0 0 / 0.25)` |

---

## 8. Animations

| Name | Definition | Duration |
|------|-----------|----------|
| `fade-in` | `0% { opacity: 0 }` → `100% { opacity: 1 }` | 200ms ease-out |
| `slide-up` | `0% { opacity: 0, translateY: 8px }` → `100% { opacity: 1, translateY: 0 }` | 250ms ease-out |
| `scale-in` | `0% { opacity: 0, scale: 0.95 }` → `100% { opacity: 1, scale: 1 }` | 150ms ease-out |
| `slide-in` | `0% { transform: translateX(100%), opacity: 0 }` → `100% { transform: translateX(0), opacity: 1 }` | 300ms ease-out |

---

## 9. Component Tokens

### Card

| Property | Light | Dark |
|----------|-------|------|
| Background | `bg-white` | `bg-gray-900` |
| Border | `border-gray-200` | `border-gray-800` |
| Border radius | `rounded-xl` (12px) | same |
| Shadow | `shadow-card` | same |
| Hover shadow | `shadow-lg` | same |
| Hover border | `hover:border-gray-300` | `dark:hover:border-gray-700` |
| Padding (sm) | `p-3` (12px) | same |
| Padding (md) | `p-5` (20px) | same |
| Padding (lg) | `p-6` (24px) | same |
| Title | `text-base font-semibold text-gray-900` | `dark:text-gray-100` |

### Button

| Variant | Normal | Hover | Focus ring |
|---------|--------|-------|------------|
| **primary** | `bg-brand-600 text-white shadow-sm` | `bg-brand-700` | `ring-brand-500` |
| **secondary** | `bg-white text-gray-700 border border-gray-300` | `bg-gray-50` / `dark:hover:bg-gray-700` | `ring-brand-500` |
| **danger** | `bg-red-600 text-white shadow-sm` | `bg-red-700` | `ring-red-500` |
| **ghost** | `bg-transparent text-gray-600` | `bg-gray-100` / `dark:hover:bg-gray-800` | `ring-brand-500` |

| Size | Padding | Font |
|------|---------|------|
| sm | `px-2.5 py-1.5` | `text-xs` (12px) |
| md | `px-4 py-2` | `text-sm` (14px) |
| lg | `px-6 py-3` | `text-base` (16px) |

**Common:** `rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none`

### Input / Textarea / Select

| Property | Light | Dark |
|----------|-------|------|
| Background | `bg-white` | `bg-gray-900` |
| Border | `border-gray-300` | `border-gray-700` |
| Border radius | `rounded-lg` (8px) | same |
| Padding | `px-3 py-2` | same |
| Font | `text-sm` | same |
| Text | `text-gray-900` | `text-gray-100` |
| Placeholder | `placeholder-gray-400` | `placeholder-gray-500` |
| Focus ring | `ring-2 ring-blue-500 border-blue-500` | same |
| Error | `border-red-400 dark:border-red-500 focus:ring-red-500` | same |
| Disabled | `opacity-50 cursor-not-allowed` | same |

### Badge

| Variant | Light | Dark |
|---------|-------|------|
| default | `bg-gray-100 text-gray-700` | `bg-gray-800 text-gray-300` |
| success | `bg-emerald-50 text-emerald-700` | `bg-emerald-950 text-emerald-300` |
| warning | `bg-amber-50 text-amber-700` | `bg-amber-950 text-amber-300` |
| danger | `bg-red-50 text-red-700` | `bg-red-950 text-red-300` |
| info | `bg-blue-50 text-blue-700` | `bg-blue-950 text-blue-300` |
| neutral | `bg-gray-50 text-gray-500` | `bg-gray-800 text-gray-400` |

**Common:** `px-2 py-0.5 rounded-full text-xs font-medium`

### Tag Colors (cycling palette)

```
#1: bg-blue-100 text-blue-700         →  dark:bg-blue-900/40 dark:text-blue-300
#2: bg-emerald-100 text-emerald-700   →  dark:bg-emerald-900/40 dark:text-emerald-300
#3: bg-violet-100 text-violet-700     →  dark:bg-violet-900/40 dark:text-violet-300
#4: bg-amber-100 text-amber-700       →  dark:bg-amber-900/40 dark:text-amber-300
#5: bg-rose-100 text-rose-700         →  dark:bg-rose-900/40 dark:text-rose-300
#6: bg-cyan-100 text-cyan-700         →  dark:bg-cyan-900/40 dark:text-cyan-300
#7: bg-pink-100 text-pink-700         →  dark:bg-pink-900/40 dark:text-pink-300
#8: bg-teal-100 text-teal-700         →  dark:bg-teal-900/40 dark:text-teal-300
#9: bg-orange-100 text-orange-700     →  dark:bg-orange-900/40 dark:text-orange-300
#10: bg-indigo-100 text-indigo-700    →  dark:bg-indigo-900/40 dark:text-indigo-300
```

### Status Dot Colors (for Badge)

| Status | Color |
|--------|-------|
| success | `#10b981` (emerald-500) |
| danger | `#ef4444` (red-500) |
| info | `#3b82f6` (blue-500) |
| neutral | `#9ca3af` (gray-400) |

### StatCard

| Property | Light | Dark |
|----------|-------|------|
| Container | `bg-white` | `bg-gray-900` |
| Border | `border-gray-200` | `border-gray-800` |
| Radius | `rounded-xl` (12px) | same |
| Shadow | `shadow-sm hover:shadow-md` | same |
| Label | `text-xs font-medium text-gray-500 uppercase tracking-wider` | `dark:text-gray-400` |
| Value | `text-2xl font-bold tabular-nums text-gray-900` | `dark:text-gray-100` |
| Subtitle | `text-xs text-gray-400` | same |
| Trend up | `text-emerald-600` | `dark:text-emerald-400` |
| Trend down | `text-red-600` | `dark:text-red-400` |

**Variant backgrounds:**
| Variant | Light bg | Light border | Dark bg | Dark border | Value color |
|---------|----------|-------------|---------|-------------|-------------|
| default | `bg-white` | `border-gray-200` | `bg-gray-900` | `border-gray-800` | inherited |
| success | `bg-emerald-50/80` | `border-emerald-200` | `bg-emerald-950/30` | `border-emerald-800` | `text-emerald-700 dark:text-emerald-300` |
| warning | `bg-amber-50/80` | `border-amber-200` | `bg-amber-950/30` | `border-amber-800` | `text-amber-700 dark:text-amber-300` |
| danger | `bg-red-50/80` | `border-red-200` | `bg-red-950/30` | `border-red-800` | `text-red-700 dark:text-red-300` |
| info | `bg-blue-50/80` | `border-blue-200` | `bg-blue-950/30` | `border-blue-800` | `text-blue-700 dark:text-blue-300` |

### Modal

| Property | Light | Dark |
|----------|-------|------|
| Overlay | `bg-black/50` | same |
| Container | `bg-white` | `bg-gray-900` |
| Radius | `rounded-2xl` (16px) | same |
| Shadow | `shadow-elevated` | same |
| Header divider | `border-b border-gray-200` | `dark:border-gray-800` |
| Title | `text-lg font-semibold` | same |
| Close icon | `text-gray-400 hover:text-gray-600` | `dark:hover:text-gray-300` |
| Animation | `animate-scale-in` (150ms) | same |
| Width (sm) | `max-w-sm` (384px) | same |
| Width (md) | `max-w-lg` (512px) | same |
| Width (lg) | `max-w-2xl` (672px) | same |

### Tabs

| Property | Light | Dark |
|----------|-------|------|
| Container | `bg-gray-100` | `bg-gray-800` |
| Container radius | `rounded-xl` | same |
| Padding | `p-1` | same |
| Active tab | `bg-white text-gray-900 shadow-sm` | `bg-gray-900 text-gray-100` |
| Inactive tab | `text-gray-500 hover:text-gray-700` | `dark:text-gray-400 dark:hover:text-gray-300` |
| Tab radius | `rounded-lg` | same |
| Tab padding | `px-4 py-2` | same |
| Tab font | `text-sm font-medium` | same |

### Toast

| Type | Container | Icon bg |
|------|-----------|---------|
| success | `bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300` | `bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300` |
| error | `bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300` | `bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300` |
| info | `bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300` | `bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300` |
| warning | `bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-300` | `bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300` |

**Common:** `border rounded-lg shadow-lg px-4 py-3 animate-slide-in`

### DataTable

| Property | Light | Dark |
|----------|-------|------|
| Container | `rounded-xl border border-gray-200` | `dark:border-gray-800` |
| Header bg | `bg-gray-50` | `bg-gray-800/50` |
| Header text | `text-xs font-semibold text-gray-500 uppercase tracking-wider` | `dark:text-gray-400` |
| Header border | `border-b border-gray-200` | `dark:border-gray-800` |
| Body divider | `divide-y divide-gray-100` | `dark:divide-gray-800` |
| Row bg | `bg-white hover:bg-gray-50` | `dark:bg-gray-900 dark:hover:bg-gray-800/50` |
| Cell padding | `px-4 py-3` | same |
| Font | `text-sm` | same |

### Skeleton Loading

| Property | Light | Dark |
|----------|-------|------|
| Color | `bg-gray-200` | `bg-gray-700` |
| Animation | `animate-pulse` | same |
| Radius | `rounded` | same |

### Breadcrumbs

| Property | Light | Dark |
|----------|-------|------|
| Text | `text-sm text-gray-500` | `dark:text-gray-400` |
| Separator | `text-gray-300` | `dark:text-gray-600` |
| Link hover | `hover:text-blue-600` | `dark:hover:text-blue-400` |
| Current | `text-gray-900 font-medium` | `dark:text-gray-100` |

### Sidebar (Layout)

| Property | Light | Dark |
|----------|-------|------|
| Width | `w-56` (224px) | same |
| Background | `bg-white` | `bg-gray-950` |
| Border | `border-r border-gray-200` | `dark:border-gray-800` |
| Brand (Tenjin) | `text-brand-600` | `dark:text-brand-400` |
| Brand (T6) | `text-gray-700` | `dark:text-gray-300` |
| Nav active | `bg-brand-50 text-brand-700 font-medium` | `dark:bg-brand-950/30 dark:text-brand-300` |
| Nav inactive | `text-gray-600 hover:bg-gray-100 hover:text-gray-900` | `dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200` |
| Section title | `text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 px-3 mb-1.5` | `dark:text-gray-500` |
| Nav item padding | `px-3 py-1.5 rounded-lg text-sm` | same |
| Footer divider | `border-t border-gray-200` | `dark:border-gray-800` |

---

## 10. Tailwind Config (CSS Custom Properties Equivalent)

If you're using plain CSS instead of Tailwind, here are the CSS custom properties to define:

```css
:root {
  /* Brand */
  --color-brand-50: #eef2ff;
  --color-brand-100: #e0e7ff;
  --color-brand-200: #c7d2fe;
  --color-brand-300: #a5b4fc;
  --color-brand-400: #818cf8;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;
  --color-brand-800: #3730a3;
  --color-brand-900: #312e81;
  --color-brand-950: #1e1b4b;

  /* Surface (slate) */
  --color-surface-50: #f8fafc;
  --color-surface-100: #f1f5f9;
  --color-surface-200: #e2e8f0;
  --color-surface-300: #cbd5e1;
  --color-surface-400: #94a3b8;
  --color-surface-500: #64748b;
  --color-surface-600: #475569;
  --color-surface-700: #334155;
  --color-surface-800: #1e293b;
  --color-surface-900: #0f172a;
  --color-surface-950: #020617;

  /* Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.06);
  --shadow-card-hover: 0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.08);
  --shadow-elevated: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04);
}

/* Dark mode variables */
.dark {
  --color-page-bg: #030712;
  --color-surface: #111827;
  --color-border: #1f2937;
  --color-text-primary: #f3f4f6;
  --color-text-muted: #9ca3af;
}
```

---

## 11. Block Palette & Tree View

### Block Color Map (17 variants)

Each block type has a color key. The palette renders each block button with the corresponding border + bg.

| Color | Light | Dark |
|-------|-------|------|
| blue | `border-blue-500 bg-blue-50 text-blue-700` | `dark:bg-blue-950/30 dark:text-blue-300` |
| indigo | `border-indigo-500 bg-indigo-50 text-indigo-700` | `dark:bg-indigo-950/30 dark:text-indigo-300` |
| purple | `border-purple-500 bg-purple-50 text-purple-700` | `dark:bg-purple-950/30 dark:text-purple-300` |
| cyan | `border-cyan-500 bg-cyan-50 text-cyan-700` | `dark:bg-cyan-950/30 dark:text-cyan-300` |
| emerald | `border-emerald-500 bg-emerald-50 text-emerald-700` | `dark:bg-emerald-950/30 dark:text-emerald-300` |
| green | `border-green-500 bg-green-50 text-green-700` | `dark:bg-green-950/30 dark:text-green-300` |
| amber | `border-amber-500 bg-amber-50 text-amber-700` | `dark:bg-amber-950/30 dark:text-amber-300` |
| gray | `border-gray-500 bg-gray-50 text-gray-700` | `dark:bg-gray-800 dark:text-gray-300` |
| slate | `border-slate-500 bg-slate-50 text-slate-700` | `dark:bg-gray-800 dark:text-gray-300` |
| orange | `border-orange-500 bg-orange-50 text-orange-700` | `dark:bg-orange-950/30 dark:text-orange-300` |
| rose | `border-rose-500 bg-rose-50 text-rose-700` | `dark:bg-rose-950/30 dark:text-rose-300` |
| violet | `border-violet-500 bg-violet-50 text-violet-700` | `dark:bg-violet-950/30 dark:text-violet-300` |
| teal | `border-teal-500 bg-teal-50 text-teal-700` | `dark:bg-teal-950/30 dark:text-teal-300` |
| red | `border-red-500 bg-red-50 text-red-700` | `dark:bg-red-950/30 dark:text-red-300` |
| stone | `border-stone-500 bg-stone-50 text-stone-700` | `dark:bg-gray-800 dark:text-gray-300` |
| zinc | `border-zinc-500 bg-zinc-50 text-zinc-700` | `dark:bg-zinc-800 dark:text-zinc-300` |
| pink | `border-pink-500 bg-pink-50 text-pink-700` | `dark:bg-pink-950/30 dark:text-pink-300` |
| fuchsia | `border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700` | `dark:bg-fuchsia-950/30 dark:text-fuchsia-300` |

**Common:** `rounded-md text-xs border-l-2 transition-all hover:shadow-sm`

### Block Palette (left sidebar)

| Property | Light | Dark |
|----------|-------|------|
| Width | `w-56` (224px) | same |
| Background | `bg-gray-50` | `bg-gray-900` |
| Border | `border-r border-gray-200` | `dark:border-gray-700` |
| Search input | `border-gray-300 bg-white` | `dark:border-gray-600 dark:bg-gray-800` |
| Category header | `text-gray-400 uppercase tracking-wider` | `dark:text-gray-500` |
| Category chevron | `ChevronRight w-3 h-3 rotate-90 on expand` | same |

### Visual Tree (block canvas)

| Property | Light | Dark |
|----------|-------|------|
| Indent per level | `20px` | same |
| Root padding | `pl-3` (12px) | same |
| Node bg (hover) | `hover:bg-gray-50` | `dark:hover:bg-gray-800/50` |
| Node bg (selected) | `bg-brand-50` | `dark:bg-brand-950/20` |
| Node drag-over | `bg-blue-50 border-blue-400` | `dark:bg-blue-950/30 dark:border-blue-500` |
| Inline action buttons | `opacity-0 group-hover:opacity-100` | same |

### Collapsible Section (used in Palette + ProjectNav)

```
State: expandedCategories: Set<string>
Animation: rotate-90 on ChevronRight icon (transition-transform 200ms)
Default collapsed: Browser, Metrics & Debug, Processors (Palette)
                   Integrate, Infrastructure, Admin (ProjectNav)
```

---

## 12. Dark Mode Strategy

- Strategy: `class` on `<html>` element
- Toggle: `document.documentElement.classList.toggle('dark')`
- Persist: `localStorage.setItem('theme', 'dark' | 'light')`
- All tokens use Tailwind's `dark:` prefix — no separate CSS variable files needed
- Body: `bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors`
