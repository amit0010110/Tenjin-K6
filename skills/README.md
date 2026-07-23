# My Engineering Skills

A collection of 10 reusable methodology and design skills extracted from how I work. Each is a self-contained guide with workflow, templates, examples, and anti-patterns.

---

## The Skills

| # | Skill | When to Open | 
|---|-------|-------------|
| 1 | **[Layered Decomposition](layered-decomposition.md)** | Starting any new project or major feature — BRD → HLD → LLD → Code |
| 2 | **[Data-Model-First](data-model-first.md)** | Before writing any schema or API — define entities, relationships, constraints first |
| 3 | **[Flow & Orchestration Mapping](flow-orchestration.md)** | When designing stateful workflows, event-driven systems, or distributed execution |
| 4 | **[Architecture Trade-off Analysis](architecture-tradeoffs.md)** | When choosing between technologies — compare on explicit dimensions before deciding |
| 5 | **[Trace-Driven Implementation](trace-driven-implementation.md)** | When implementing from a design — build one complete path through the system at a time |
| 6 | **[Design System Extraction](design-system-extraction.md)** | When building UI — extract tokens and components before pages |
| 7 | **[Documentation-First](documentation-first.md)** | Always — docs are first-class deliverables alongside code |
| 8 | **[Meta-Cognitive Planning](meta-cognitive-planning.md)** | After any project — retrospect, extract patterns, build accelerators |
| 9 | **[Code Structure & Standards](code-structure-standards.md)** | When refactoring or adding features — enforce file size limits, splitting patterns, and conventions |
| 10 | **[Application UI Tokens & Components](application-ui-tokens.md)** | When building any application UI — exact color palettes, typography scales, shadows, and atomic building blocks |

---

## The Workflow (how these fit together)

```
Start here ──→ layered-decomposition.md   → "I need a BRD first"
                      │
                      ├──→ data-model-first.md        → "What are the entities?"
                      ├──→ architecture-tradeoffs.md   → "Which database / queue?"
                      │
                      ▼
                HLD + LLD documents written
                      │
                      ├──→ flow-orchestration.md      → "How does data flow through the system?"
                      │
                      ▼
                Implementation
                      │
                      ├──→ trace-driven-implementation.md → "Build one path end-to-end"
                      │
                      ▼
                Frontend
                      │
                      ├──→ design-system-extraction.md  → "Extract tokens, build components"
                      ├──→ application-ui-tokens.md     → "What color/shadow tokens & UI building blocks do we use?"
                      │
                      ▼
                Ship + Retrospect
                      │
                      └──→ meta-cognitive-planning.md   → "What did I learn? What can I template?"
```

---

## Quick Reference

| Situation | Open This Skill |
|-----------|----------------|
| "I have a vague idea for an app" | `layered-decomposition.md` |
| "I need to design a database" | `data-model-first.md` |
| "Should I use X or Y?" | `architecture-tradeoffs.md` |
| "How does this work end-to-end?" | `flow-orchestration.md` |
| "Where do I start coding?" | `trace-driven-implementation.md` |
| "The UI looks inconsistent" | `design-system-extraction.md` |
| "We need high-contrast, modern UI tokens & atomic components right now" | `application-ui-tokens.md` |
| "We keep running into the same bugs" | `documentation-first.md` |
| "How can I work faster next time?" | `meta-cognitive-planning.md` |
| "This file is too big — where do I split it?" | `code-structure-standards.md` |
| "What patterns should I follow for blocks/generators?" | `code-structure-standards.md` |
