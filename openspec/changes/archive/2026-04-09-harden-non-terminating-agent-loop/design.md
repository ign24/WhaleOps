## Context

The agent runtime already has deterministic controls (parallel cap, loop guard, per-tool timeout, recursion limits, output guards), but behavior under stress is not consistently non-terminating. Recent failures show two gaps: (1) budget exhaustion can end in generic processing failure instead of controlled continuation, and (2) fallback logic can fail with message-type assumptions (e.g., `ToolMessage` vs `AIMessage`).

This change spans runtime policy, fallback handling, spawn-agent budgeting, and response contract behavior across analyze/refactor/execute loops.

## Goals / Non-Goals

**Goals:**
- Enforce a strict non-terminating policy for guardrail-triggered denials (budget, loop guard, per-tool caps).
- Enforce a global request-level spawn budget for `spawn_agent` calls.
- Guarantee fallback/recovery code paths are type-safe and cannot fail on message-shape assumptions.
- Guarantee constrained runs still produce structured, parseable partial output.
- Preserve planning quality by allowing decomposition while enforcing deterministic execution budgets.

**Non-Goals:**
- Replacing the current mode architecture or model routing.
- Introducing recursive subagent spawning.
- Adding new external infra dependencies.
- Redesigning all prompt files beyond minimal decomposition guidance updates.

## Decisions

### 1) Adopt a hard runtime contract: guardrails are soft-fail only
Guardrail checks SHALL block offending calls and append explicit tool feedback, but SHALL NOT terminate request processing. This centralizes behavior in runtime code instead of prompt compliance.

**Alternatives considered:**
- Keep mixed behavior (some guardrails terminal, others non-terminal): rejected because it produces unpredictable operator experience.
- Push behavior entirely to prompts: rejected as probabilistic and not enforceable.

### 2) Enforce global spawn budget at tool-limit layer
Use per-request tool-total limits for `spawn_agent` as the budget authority, applied before tool execution in `tool_node` so all calls (including parallel batches) are normalized uniformly.

**Alternatives considered:**
- Enforce budget inside `spawn_agent` implementation only: rejected because orchestration-level observability and consistent blocking messages become fragmented.
- Per-agent budget: rejected; requirement is request-global budget.

### 3) Make fallback pipeline message-type-safe
All recovery/fallback paths SHALL treat state messages as heterogeneous and avoid direct assumptions about `.tool_calls` availability. Recovery context injection and finalization will use defensive extraction helpers.

**Alternatives considered:**
- Catch-all try/except around current logic: rejected as patchy and harder to reason about than explicit typed handling.

### 4) Standardize constrained-output structure
When execution budget is exhausted or calls are denied, output SHALL still conform to structured partial-response sections with explicit completed vs pending scope.

**Alternatives considered:**
- Free-form fallback text: rejected because downstream automation and operators need stable parsing.

### 5) Keep decomposition in prompt, limits in runtime
Prompt guidance will instruct broad-task decomposition into smaller subtasks. Runtime enforces the hard limits (spawn/tool budgets), preserving quality without losing determinism.

**Alternatives considered:**
- Hard-code decomposition plans in code: rejected due to brittle semantics across heterogeneous user requests.

## Risks / Trade-offs

- **[Risk] More loops after soft blocks could increase token/tool usage** → Mitigation: retain loop-guard threshold, per-tool request caps, and max-iteration limits; require blocked-call replan messages to encourage convergence.
- **[Risk] Overly strict spawn budgets may under-cover large repositories** → Mitigation: structured partial output with explicit pending scope and actionable continuation steps.
- **[Risk] Behavior changes may alter existing tests/snapshots** → Mitigation: add focused unit tests for non-termination behavior and update expected outputs deliberately.
- **[Risk] Prompt guidance may drift from runtime policy** → Mitigation: keep prompts minimal and treat runtime policy as source of truth.

## Migration Plan

1. Add/adjust spec deltas for non-terminating policy, spawn budget semantics, and partial response contract.
2. Implement runtime soft-fail behavior and fallback type-safety updates.
3. Configure explicit per-mode `max_tool_calls_per_request` values including `spawn_agent`.
4. Add/adjust tests for blocked-call continuation and fallback robustness.
5. Roll out with tracing checks for blocked-call events and absence of terminal loop interruptions from guardrails.
6. If regressions appear, rollback to previous guardrail behavior by reverting runtime policy changes and config caps.

## Open Questions

- What default global `spawn_agent` budget should be used per mode (`analyze` likely higher than `refactor`/`execute`)?
- Should budget-exhaustion summaries be emitted only in final synthesis or also as intermediate assistant updates?
- Do we want a dedicated trace event type for `budget_exhausted` separate from existing `tool_total_limit`?
