---
name: refactoring
description: |
  Enterprise refactoring execution skill. Detects project stack, builds a repository-aware
  refactoring plan, and executes a per-file read-plan-write-validate loop using refactor_gen.
  Injects curated expert guidelines by stack (Python, Frontend, Backend Node.js, Fullstack).
license: MIT
metadata:
  author: cognitive-code-agent
  version: "1.0.0"
  guideline_sources:
    - python-expert
    - senior-frontend
    - vercel-react-best-practices
    - backend-patterns
---

# Refactoring Skill

Use this skill when the user explicitly asks to refactor existing code.

## Operational Rules

Use this block first when running inside CGN-Agent.

- **Execution mode:** Refactoring runs in `/execute` mode, not a standalone mode.
- **First action:** Always `query_findings(finding_type="refactoring_plan")` to load the structured plan from a prior `/analyze` session.
- **Primary tools:** `refactor_gen`, `write_file`, `edit_file`, `run_ruff`, `run_eslint`, `code_gen`.
- **Loop policy:** Process one file at a time (or very small batches), and validate before moving on.
- **Output policy:** Always return a manifest with changed files and short rationale.
- **Fallback policy:** If a validation tool fails unexpectedly, record the failure and continue with the next highest-impact file.
- **HITL:** Write operations may require user confirmation via interrupt gate. If a write is rejected, skip that file and continue.

## Phase 0 - Load Plan

Load the execution plan from findings. Do not autonomously re-plan.

1. Call `query_findings(finding_type="refactoring_plan")` to load the structured plan.
2. If a plan exists: use its `execution_order`, `files`, and `constraints` directly.
3. If no plan exists: ask the user for explicit instructions, then detect stack from project files before proceeding.

Stack detection (only when no plan exists):
- `pyproject.toml`, `requirements.txt`, `setup.py` → Python
- `package.json` with React/Next.js → Frontend
- `package.json` with Express/Fastify/NestJS, no frontend → Backend Node.js
- Both Python config + frontend package.json → Fullstack

## Phase 0.5 - Test Safety Net

Before modifying any file, establish a GREEN baseline:

1. Detect the project's test framework (`run_pytest` for Python, `run_jest` for JS/TS).
2. Run the existing test suite. If tests pass, proceed with refactoring. If tests fail, report the failures before making changes — the baseline is broken.
3. After completing each file's write-validate cycle, re-run the relevant tests to verify the refactoring did not introduce regressions.

## Phase 1 - Per-File Execution Cycle

For each target file in the plan's `execution_order`:

1. Read current file content.
2. Build a structured query for `refactor_gen` with these sections:
   - `<project_context>`
   - `<expert_guidelines>` (ONLY for detected stack)
   - `<refactoring_plan>` (from the plan entry for this specific file)
   - `<current_file path="..."> ... </current_file>`
3. Call `refactor_gen`.
4. Write full output with `write_file` (prefer full replacement over fragile partial edits).
5. Validate with stack-appropriate linter/tests.
6. If validation fails, re-run `refactor_gen` including error output. Maximum 2 retries per file.

Do not stop at snippets.

## Phase 2 - Final Manifest

Return this summary at the end:
- Refactored files list with: `path | change_type | short rationale`
- Any plan adjustments made by `refactor_gen`
- Validation results by file
- Remaining files (if iteration budget or time budget exhausted)

## Curated Expert Guidelines by Stack

Use ONLY the section matching the detected stack inside `<expert_guidelines>`.

### Python Guidelines (from python-expert)

- Never use mutable default arguments; use `None` sentinel.
- Avoid bare `except`; catch specific exception types.
- Add type hints for all function signatures and returns.
- Prefer `@dataclass` for data containers.
- Replace simple append loops with list comprehensions.
- Use generators for large streams to reduce memory usage.
- Use context managers for resources (files, locks, clients).
- Prefer stdlib primitives (`Counter`, `defaultdict`, `itertools`).
- Enforce PEP 8 naming and readable function boundaries.
- Keep public docstrings accurate after refactors.
- Validate inputs early and fail with explicit errors.

### Frontend Guidelines (from senior-frontend + vercel-react-best-practices)

- Parallelize independent async calls with `Promise.all`.
- Move awaits to usage branches; avoid eager data fetches.
- Avoid barrel imports in heavy packages; prefer direct imports.
- Dynamically import heavy client-only components.
- Keep derived state out of effects; derive during render.
- Use functional state updates to avoid stale closures.
- Use lazy initial state for expensive initialization.
- Use `useRef` for transient values that should not re-render.
- Minimize server-to-client payload shape; pass only needed fields.
- Preserve immutability (`toSorted`, `toSpliced`, etc.).
- Replace repeated linear lookups with `Map`/`Set` indexes.

### Backend Node.js Guidelines (from backend-patterns)

- Keep route handlers thin; move logic to service layer.
- Isolate data access through repositories.
- Avoid `SELECT *`; query only needed fields.
- Eliminate N+1 queries via batching.
- Use transactions for multi-step writes.
- Standardize API errors in centralized error middleware.
- Validate input schemas at boundaries before business logic.
- Add retries with backoff for transient external failures.
- Use cache-aside with TTL and invalidation strategy.
- Keep auth/authorization checks explicit in handlers/actions.
- Prefer structured logs with request context.

### Fullstack Guidelines

- Apply frontend guidelines to UI files and backend guidelines to API/services.
- Preserve contract compatibility between API responses and UI consumers.
- Refactor shared types/contracts before implementation drift appears.

## Query Construction Contract for refactor_gen

Use this exact shape:

```text
<project_context>
Stack: ...
Frameworks: ...
Constraints: ...
</project_context>

<expert_guidelines>
...selected stack guidelines only...
</expert_guidelines>

<refactoring_plan>
Target file: ...
Intended changes: ...
Non-goals: ...
</refactoring_plan>

<current_file path="...">
...full file content...
</current_file>

Return the complete refactored file content.
If you changed the plan, state the adjustment briefly before the code.
```
