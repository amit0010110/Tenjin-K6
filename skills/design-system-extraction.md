# Skill: Design System Extraction

> Recognize when visual patterns can be extracted into reusable tokens. Build for reuse from the start — your UI is a product, not a one-off.

---

## What It Is

The ability to identify repeated visual patterns in a user interface, extract them into **named design tokens** (colors, spacing, typography, shadows, animations), and compose them into **reusable components**. You see not just "a blue button" but "the primary action variant of the Button component colored with brand-600".

```
UI Mockup
  │
  ├─ Identify repeated values
  │   ├─ Colors used in multiple places
  │   ├─ Font sizes and weights
  │   ├─ Spacing and alignment
  │   ├─ Border radii and shadows
  │   └─ Animation timings
  │
  ├─ Define tokens
  │   ├─ CSS variables or Tailwind config
  │   ├─ Naming convention (brand-50..950, surface-50..950)
  │   └─ Semantic aliases (--color-success, --color-danger)
  │
  └─ Build components from tokens
      ├─ Button, Input, Badge, Card
      ├─ Modal, Tabs, Toast, DataTable
      └─ Each with variants, sizes, states, dark mode
```

---

## When To Use

- **Starting a new frontend project** — define tokens before building pages
- **After building 3-5 pages** — extract common patterns into a shared system
- **Building a white-label or multi-app platform** — tokens make reskinning easy
- **Generating documentation** — UI_TOKENS.md becomes the source of truth
- **Any time you type `bg-` or `text-` more than 3 times** — consider if it's a reusable token

---

## Workflow

### Step 1: Identify the Token Categories

Every UI system has the same foundational tokens:

| Category | Examples to extract |
|----------|-------------------|
| **Colors** | Brand palette, surface/neutral palette, semantic colors (success, warning, danger, info) |
| **Typography** | Font family (sans, mono), sizes (xs, sm, base, lg, xl, 2xl), weights |
| **Spacing** | Padding, margin, gap values (standardized: 1=4px, 2=8px, 3=12px, 4=16px, 5=20px, 6=24px) |
| **Borders** | Radius (lg=8px, xl=12px, 2xl=16px), width, colors |
| **Shadows** | Card, elevated, hover states |
| **Animations** | Fade-in, slide-up, scale-in — with duration and easing |

### Step 2: Define the Naming Convention

**Good:**
```
brand-50 → brand-950    (consistent scale)
surface-50 → surface-950
shadow-card, shadow-elevated  (descriptive names)
```

**Bad:**
```
blue, dark-blue, light-blue  (ad-hoc, no scale)
shadow-1, shadow-2, shadow-3  (not descriptive)
my-custom-color  (not portable)
```

**Rule:** A developer should be able to guess a token name without looking it up.

### Step 3: Extract Colors from Mockups

Given a mockup, identify:
- **Brand color**: Used for Primary CTA, links, active states → extract as `brand-500`
- **Light shade of brand**: Used for active backgrounds, hover fills → extract as `brand-50`
- **Text colors**: Primary, secondary, disabled, placeholder → surface-900, surface-500, surface-300
- **Backgrounds**: Page bg, card bg, input bg, hover bg → surface-50, white, surface-100
- **Borders**: Default, hover, active, error → surface-200, surface-300, brand-500, danger

### Step 4: Define Every Component as a Token Map

Each component is defined by mapping its visual properties to tokens:

```markdown
## Button
| Property | Primary Variant | Secondary Variant | Danger Variant |
|----------|----------------|-------------------|----------------|
| bg | brand-600 | white | red-600 |
| text | white | gray-700 | white |
| border | none | gray-300 | none |
| hover bg | brand-700 | gray-50 | red-700 |
| radius | rounded-lg | rounded-lg | rounded-lg |
| font weight | medium | medium | medium |

| Size | Padding | Font |
|------|---------|------|
| sm | px-2.5 py-1.5 | text-xs |
| md | px-4 py-2 | text-sm |
| lg | px-6 py-3 | text-base |
```

### Step 5: Handle Dark Mode

Every token needs a dark mode counterpart. This forces you to define what changes at night:

```css
/* Light */
--sidebar-bg: white;
--card-bg: white;
--border-color: #e5e7eb;
--text-primary: #111827;

/* Dark */
.dark {
  --sidebar-bg: #030712;
  --card-bg: #111827;
  --border-color: #1f2937;
  --text-primary: #f3f4f6;
}
```

**Don't wait** until someone asks for dark mode. Design it from day one. It costs ~10% more effort upfront but saves 100% retrofit pain.

### Step 6: Document as UI_TOKENS.md

The tokens document is the contract between design and engineering:

```markdown
# UI Design Tokens

## Colors
brand-500 = #6366f1
success = #10b981
...

## Typography
sans: Inter, system-ui
mono: JetBrains Mono

## Component: Button
...
```

This document should be:
- **Reusable** — another app can adopt it and look like this one
- **Implementation-agnostic** — works with Tailwind, plain CSS, styled-components
- **Comprehensive** — every component and its states

---

## Templates

### Token Extraction Checklist

```
□ 1. Brand palette defined (50-950 scale)?
□ 2. Surface/neutral palette defined (50-950 scale)?
□ 3. Semantic colors defined (success, warning, danger, info)?
□ 4. Font stacks defined (sans + mono)?
□ 5. Font size scale defined?
□ 6. Spacing scale defined? (match Tailwind's or define your own)
□ 7. Border radius tokens defined?
□ 8. Shadow tokens defined?
□ 9. Animation tokens defined?
□ 10. Dark mode equivalents for every token?
□ 11. Common component list started? (Button, Input, Badge, Card, Modal, Tabs, Toast)
□ 12. Component states documented? (hover, active, disabled, error, focus)
□ 13. Chart/data visualization palette defined?
```

### Component Token Template

```markdown
## {Component Name}

### Variants
| Variant | bg | text | border | hover bg | hover border |
|---------|----|------|--------|----------|-------------|
| default |    |      |        |          |             |
| primary |    |      |        |          |             |
| danger  |    |      |        |          |             |

### Sizes
| Size | Padding | Font size | Icon size |
|------|---------|-----------|-----------|
| sm   |         |           |           |
| md   |         |           |           |
| lg   |         |           |           |

### Dark Mode
| Property | Light | Dark |
|----------|-------|------|
| bg       |       |      |
| text     |       |      |
| border   |       |      |
```

---

## Real Example from This Project

The `UI_TOKENS.md` document created in this project is the result of extracting the design system from:

- **Tailwind config** → brand colors, surface colors, custom shadows, animations, font families
- **20+ component files** → Card, Button, Input, Badge, Modal, Tabs, Toast, ConfirmDialog, Skeleton, PageHeader, StatCard, DataTable, Layout
- **Dark mode classes** → every component has `dark:` variants
- **Chart colors** → palette extracted from TrendChart, DashboardBuilder, LiveMonitor
- **Tag colors** → cycling 10-color palette for tags

The entire design system fits in one portable `UI_TOKENS.md` file that can be reused by another app.

---

## Anti-Patterns

| Trap | Why It Fails |
|------|-------------|
| Hardcoding hex values everywhere | Changing the brand color requires finding every instance |
| No dark mode from the start | Retrofit takes 2-3x longer and misses edge cases |
| Component-specific tokens (e.g. `--btn-primary-bg`) | You end up with thousands of tokens instead of a coherent system |
| Ignoring states | Button looks fine but hover/active/disabled are broken |
| Over-abstraction | 3 components with 30 variants each is worse than 10 focused components |
| No documentation | New team members re-extract the system from scratch |
