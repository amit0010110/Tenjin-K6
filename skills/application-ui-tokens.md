# Skill: Application UI Tokens & Component Building Blocks

> A complete, production-ready, universal UI Design Token system and component dictionary. Use these exact tokens and building blocks as the visual foundation when building ANY new web application.

---

## What It Is

A standardized, rich, modern, and high-contrast design system specification containing exact **Color Palettes (Light & Dark)**, **Typography Scales**, **Spacing / Radius / Shadow Tokens**, and **12+ Atomic Component Specifications**. Instead of guessing styles or writing ad-hoc utility classes (`bg-blue-500`, `shadow-md`), build your UI directly from these universal tokens.

```
Universal UI Tokens Layer
  ├── 1. Brand Palette (indigo/violet 50..950 scale)
  ├── 2. Surface & Neutral Palette (slate/gray 50..950 scale)
  ├── 3. Semantic Colors (emerald success, amber warning, red danger, blue info)
  ├── 4. Typography Scale (Inter + JetBrains Mono, 10px to 4xl)
  ├── 5. Elevation & Glassmorphism Shadows (sm, md, lg, xl, modal, glass)
  └── 6. Atomic Component Building Blocks (Buttons, Inputs, Badges, Cards, Modals, Tables)
```

---

## When To Use

- **Starting a new frontend application** (e.g., `CRM`, `SaaS dashboard`, `Admin portal`, `E-Commerce store`).
- **Configuring Tailwind CSS or CSS Variables (`globals.css`)** for a new repository.
- **Building atomic UI components** (`Table`, `Card`, `Modal`, `Button`, `Badge`) that need rich aesthetics and seamless light/dark mode support.
- **Ensuring high visual quality** (`Rich Aesthetics`, `Dynamic hover transitions`, `Glassmorphism`) without hiring an external UI designer.

---

## 1. Universal Color Tokens

### Brand Palette (`Primary Accent`)
Used for primary call-to-action (CTA) buttons, interactive links, active tabs, and focus rings.

```css
/* Tailwind Brand Scale (Indigo / Violet) */
--brand-50:  #eef2ff;
--brand-100: #e0e7ff;
--brand-200: #c7d2fe;
--brand-300: #a5b4fc;
--brand-400: #818cf8;
--brand-500: #6366f1; /* Primary Brand Color */
--brand-600: #4f46e5; /* Hover / Active State */
--brand-700: #4338ca;
--brand-800: #3730a3;
--brand-900: #312e81;
--brand-950: #1e1b4b;
```

### Surface & Neutral Palette (`Backgrounds, Borders & Text`)
Used for page backgrounds, card surfaces, borders, and typography.

```css
/* Tailwind Surface Scale (Slate / Gray) */
--surface-50:  #f8fafc; /* Light Mode Page Background */
--surface-100: #f1f5f9;
--surface-200: #e2e8f0; /* Light Mode Borders */
--surface-300: #cbd5e1;
--surface-400: #94a3b8; /* Muted Text */
--surface-500: #64748b;
--surface-600: #475569;
--surface-700: #334155; /* Dark Mode Borders */
--surface-800: #1e293b;
--surface-900: #0f172a; /* Dark Mode Card Surface */
--surface-950: #020617; /* Dark Mode Page Background */
```

### Semantic Status Colors
Used for status badges, alert banners, validation errors, and chart metrics.

| Token / Role | Light Mode Hex | Dark Mode Hex | Semantic Usage |
|---|---|---|---|
| **`success`** (`emerald`) | `#10b981` | `#6ee7b7` | Completed, Active, Healthy, Approved |
| **`warning`** (`amber`) | `#f59e0b` | `#fbbf24` | Pending, Review Needed, Warning threshold |
| **`danger`** (`red`) | `#ef4444` | `#fca5a5` | Failed, Rejected, Deleted, Error state |
| **`info`** (`blue`) | `#3b82f6` | `#60a5fa` | Processing, Information, Default badge |

---

## 2. Universal Typography Scale

### Font Stacks
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Size & Hierarchy Matrix
| Role | Font Size | Line Height | Font Weight | Tailwind Class Equivalent |
|---|---|---|---|---|
| **Page Title (`H1`)** | `1.5rem` (24px) | `2rem` (32px) | `700` (`bold`) | `text-2xl font-bold` |
| **Section / Card Header (`H2`)** | `1.125rem` (18px) | `1.5rem` (24px) | `600` (`semibold`) | `text-lg font-semibold` |
| **Subheader / Group (`H3`)** | `1rem` (16px) | `1.5rem` (24px) | `600` (`semibold`) | `text-base font-semibold` |
| **Body / Input / Table Cell** | `0.875rem` (14px) | `1.25rem` (20px) | `400` / `500` | `text-sm font-normal` (`or font-medium`) |
| **Badge / Caption / Helper** | `0.75rem` (12px) | `1rem` (16px) | `500` (`medium`) | `text-xs font-medium` |
| **Mini Nav Label / Eyebrow** | `0.625rem` (10px) | `0.75rem` (12px) | `700` (`bold`) | `text-[10px] font-bold uppercase tracking-wider` |

---

## 3. Spacing, Borders, and Shadows

### Border Radius Scale
```css
--radius-sm: 0.375rem; /* 6px  - Badges, small tags */
--radius-md: 0.5rem;   /* 8px  - Buttons, inputs, dropdown items */
--radius-lg: 0.75rem;  /* 12px - Cards, modals, tables */
--radius-xl: 1rem;     /* 16px - Large containers, toast alerts */
```

### Elevation & Glassmorphism Shadow Scale
```css
/* Card Elevation Shadow */
--shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);

/* Hover Elevated Shadow */
--shadow-elevated: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

/* Modal Overlay & Popover Shadow */
--shadow-modal: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
```

---

## 4. Atomic Component Building Blocks (`The Component Dictionary`)

When implementing frontend pages, assemble them from these exact, pre-defined atomic building blocks:

### A. Button Component
| Variant | Light Mode Classes | Dark Mode Classes |
|---|---|---|
| **Primary** | `bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors` | `dark:bg-brand-600 dark:hover:bg-brand-500` |
| **Secondary / Outline** | `bg-white border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors` | `dark:bg-surface-900 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800` |
| **Ghost / Subtle** | `text-surface-600 hover:bg-surface-100 hover:text-surface-900 transition-colors` | `dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100` |
| **Danger** | `bg-red-600 text-white hover:bg-red-700 shadow-sm transition-colors` | `dark:bg-red-600 dark:hover:bg-red-500` |

### B. Form Input / Select Component
```html
<!-- Standard Input Specification -->
<input 
  type="text" 
  class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:placeholder-surface-500 transition-all"
/>
```

### C. Status Badge Component (`Semantic Pills`)
| Status / Semantic | Class Structure |
|---|---|
| **Success (`Active / Approved`)** | `inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60` |
| **Warning (`Pending / Review`)** | `inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60` |
| **Danger (`Failed / Deleted`)** | `inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800/60` |
| **Info / Default (`Draft`)** | `inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700 dark:bg-surface-800 dark:text-surface-300 border border-surface-200 dark:border-surface-700` |

### D. Card / Surface Container Component
```html
<!-- Standard Card Container Specification -->
<div class="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900 transition-all hover:shadow-md">
  <div class="flex items-center justify-between border-b border-surface-100 pb-3 dark:border-surface-800">
    <h3 class="text-base font-semibold text-surface-900 dark:text-surface-100">Card Header Title</h3>
    <span class="text-xs text-surface-400">Action</span>
  </div>
  <div class="pt-4 text-sm text-surface-600 dark:text-surface-400">
    Card body contents go here...
  </div>
</div>
```

### E. Data Table Component (`Standard Enterprise Grid`)
```html
<div class="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
  <table class="w-full text-left border-collapse">
    <thead>
      <tr class="border-b border-surface-200 bg-surface-50 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:border-surface-800 dark:bg-surface-900/50 dark:text-surface-400">
        <th class="px-4 py-3">Entity Name</th>
        <th class="px-4 py-3">Status</th>
        <th class="px-4 py-3">Created Date</th>
        <th class="px-4 py-3 text-right">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-surface-100 text-sm dark:divide-surface-800">
      <tr class="hover:bg-surface-50/75 dark:hover:bg-surface-800/50 transition-colors">
        <td class="px-4 py-3 font-medium text-surface-900 dark:text-surface-100">Acme Corporation</td>
        <td class="px-4 py-3"><span class="badge-success">Active</span></td>
        <td class="px-4 py-3 text-surface-500 dark:text-surface-400">2026-07-15</td>
        <td class="px-4 py-3 text-right">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Verification Checklist for Application UI

Whenever you build or review a page in your new application, check:
- [ ] **Zero Ad-Hoc Colors**: Every background and border uses `surface-*` or `brand-*` (`no random #123456 hex values`).
- [ ] **100% Dark Mode Ready**: Every light mode `bg-white`, `text-gray-900`, or `border-gray-200` has its corresponding `dark:` class (`dark:bg-surface-900 dark:text-surface-100 dark:border-surface-800`).
- [ ] **Consistent Hierarchy**: Page headers use `text-2xl font-bold`, card titles use `text-base font-semibold`, and badges use `text-xs font-medium`.
- [ ] **Interactive Transitions**: Buttons and hoverable cards include `transition-colors` or `transition-all`.
