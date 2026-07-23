# Mandatory Engineering Methodology & Skills Operating System

> **CRITICAL RULE FOR ALL AI AGENTS WORKING IN THIS REPOSITORY:**
> Before writing, modifying, designing, or refactoring ANY code or architecture in this project, you MUST read `skills/README.md` and strictly obey the corresponding skill guidelines inside the `skills/` directory.

---

## 1. Mandatory Skills Execution Matrix

Whenever you receive a task from the user, determine the nature of the task and immediately apply the required skill guide:

| Task Type | Mandatory Skill Guide | Enforcement Mandate |
|---|---|---|
| **Starting a New Project or Feature** | **`skills/layered-decomposition.md`** | You **MUST NOT** write source code or execute `npm init` until `BRD.md`, `TECH_STACK.md`, `HLD.md`, and `LLD.md` (`Backend/Frontend`) are documented and explicitly approved by the user. |
| **Designing Database or API Schemas** | **`skills/data-model-first.md`** | You **MUST NOT** write API endpoints or business logic before defining entities, relationships, foreign key constraints, index definitions, and JSON validation schemas. |
| **Executing Implementation** | **`skills/trace-driven-implementation.md`** | You **MUST** build and verify **one complete vertical path end-to-end** (`Database -> Backend API -> Worker/Engine -> Frontend UI`) before adding horizontal infrastructure or edge cases. |
| **Designing Stateful & Async Workflows** | **`skills/flow-orchestration.md`** | You **MUST** map every state transition (`pending -> running -> completed/failed`), trace happy/error paths, and draw sequence diagrams before coding asynchronous or multi-step execution flows. |
| **Evaluating Technical Choices** | **`skills/architecture-tradeoffs.md`** | When choosing databases, message brokers, or frameworks, you **MUST** present explicit comparison tables (`Latency vs. Throughput`, `Simplicity vs. Scalability`, `Memory vs. CPU`) to the user. |
| **Implementing Frontend UI & Pages** | **`skills/application-ui-tokens.md`** & **`skills/design-system-extraction.md`** | You **MUST NOT** use ad-hoc utility classes or random `#123456` hex colors. Build all components using the defined `surface-*`, `brand-*`, and atomic building block tokens with **100% Dark Mode (`dark:`) parity**. |
| **Creating & Updating Documentation** | **`skills/documentation-first.md`** | Treat all documentation (`BRD.md`, `API.md`, `ARCHITECTURE.md`, `TOKENS.md`) as living, first-class deliverables that must be updated synchronously alongside code changes. |
| **Refactoring & Module Organization** | **`skills/code-structure-standards.md`** | Every source file **MUST strictly remain under 400 lines**. If a file exceeds 400 lines, immediately split it using single-responsibility category modules and barrel re-exports (`index.ts`). |
| **Post-Project Reflection & Templates** | **`skills/meta-cognitive-planning.md`** | After completing major features, retrospect and extract reusable code templates, generators, and workflow patterns for future iterations. |

---

## 2. Universal Master Prompt (`Copy-Paste When Starting a New App`)

When starting any new project or chat session with an AI coding assistant, the user should provide the following prompt:

> *"We are starting a new application development lifecycle. Before taking any action or writing any source code, first read `skills/README.md` and `AGENTS.md`. We must strictly follow our 10 engineering skills (`skills/`) throughout this entire development lifecycle.*
>
> *Here is my 5-bullet point business summary of the application:*
> 1. **Purpose**: [What the application does]
> 2. **Primary Users/Roles**: [Actors using the system e.g., Admin, Sales Rep, Customer]
> 3. **Core Modules**: [Top 3-5 functional feature sets]
> 4. **Tech Stack Preferences**: [e.g., Node.js + PostgreSQL + React + Tailwind]
> 5. **Key Constraints**: [e.g., Role-Based Access Control, audit logs, offline support]
>
> *Let's begin right now by executing Skill #1 (`skills/layered-decomposition.md` Step 2 & Step 3): please analyze my requirements and draft our initial `BRD.md` and `TECH_STACK.md` for my review!"*

---

## 3. Strict Verification & Code Review Rules

Before completing any task or ending your turn, check:
- [ ] Did I follow `layered-decomposition.md` (no code before architectural documentation)?
- [ ] Did I enforce the **400-line max limit** (`code-structure-standards.md`) across all modified files?
- [ ] Did I ensure **100% Dark Mode parity and token usage** (`application-ui-tokens.md`) for all UI elements?
- [ ] Did I verify the exact vertical trace (`trace-driven-implementation.md`) before finishing?
