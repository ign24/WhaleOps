## Context

The agent currently includes isolated safeguards (tool timeout handling, stream→ainvoke fallback, recursion exception handling, memory degradation warnings), but lacks a unified deterministic policy for long-running failure paths. In practice, sub-agent recursion failures can still produce low-confidence synthesis or early termination without a structured partial response contract.

The system already has multiple memory layers and mode/sub-agent budgets, but those are used mainly for context injection and retention, not as explicit recovery-state controls. We need a single runtime policy that governs retries, replanning, and graceful degradation without relying on prompt-only behavior.

## Goals / Non-Goals

**Goals:**
- Define deterministic failure classes and mandatory runtime actions for each class.
- Ensure recursion/timeouts/tool failures trigger bounded recovery (not endless loops, not hard stop as first behavior).
- Guarantee user-facing structured partial responses when completion is not possible.
- Enforce evidence-gated audit synthesis (no asserted finding without path/line/tool-backed evidence).
- Emit high-signal observability events for fallback activation, recovery outcome, and unresolved gaps.

**Non-Goals:**
- Re-architect LangGraph/NAT framework internals.
- Introduce new external storage systems for recovery state.
- Solve all model quality issues via prompting.

## Decisions

1. **Deterministic error taxonomy with policy table (chosen)**
   - Introduce explicit classes: `RECURSION_LIMIT`, `TOOL_TIMEOUT`, `TOOL_VALIDATION_ERROR`, `MEMORY_DEGRADED`, `EVIDENCE_INSUFFICIENT`, `UNKNOWN_RUNTIME`.
   - Each class maps to fixed actions (retry/no-retry, replan, partial output, telemetry tags).
   - Rationale: deterministic behavior under stress and easier operations/runbook execution.
   - Alternative rejected: free-form prompt guidance per mode/sub-agent only.

2. **Bounded recovery loop with single scoped retry**
   - On recoverable failures (recursion/timeout), perform at most one scoped replan/retry.
   - If unsuccessful, return structured partial output instead of generic failure.
   - Rationale: balances continuity and cost/latency control.
   - Alternative rejected: unlimited retries or immediate abort.

3. **Loop guard on equivalent tool calls**
   - Detect repeated equivalent tool calls (same tool and materially similar args) within one request budget window.
   - Force replan or finalize partial response when threshold is exceeded.
   - Rationale: prevent budget burn and recurring recursion failures.

4. **Evidence gate before final synthesis**
   - Security/audit findings must carry `path:line`, snippet/context, and source tool.
   - Findings missing evidence are emitted as `unconfirmed` (not asserted vulnerabilities).
   - Rationale: reduce hallucinated/security-misleading output.

5. **Recovery context integrated with memory policy (non-directive)**
   - Recovery metadata (failed tool attempts, blocked paths, completed checks) is captured in request-local state and may be summarized into memory context format when applicable.
   - Remains informational, never directive.
   - Rationale: avoid repeated dead-end attempts while preserving instruction hierarchy.

## Risks / Trade-offs

- **[Risk] Over-conservative gates reduce recall** → Mitigation: mark as `unconfirmed` instead of dropping completely; include “how to verify” next steps.
- **[Risk] Additional control logic increases complexity** → Mitigation: centralize failure-policy mapping and unit-test each class transition.
- **[Risk] Higher latency from retry/replan step** → Mitigation: single retry cap and strict per-class budgets.
- **[Risk] False positives in loop-equivalence detection** → Mitigation: normalize only stable argument fields; include allowlist for benign repeats.

## Migration Plan

1. Add policy definitions and telemetry tags without behavior changes (shadow mode logs).
2. Enable deterministic actions for `RECURSION_LIMIT` and `TOOL_TIMEOUT` first.
3. Enable evidence gate and structured partial-response contract in analyze/security paths.
4. Roll out loop guard with conservative thresholds; tune from observed traces.
5. Document runbook update and rollback switch (feature flag/env/config toggle).

Rollback strategy:
- Disable deterministic policy via config flag and revert to existing fallback behavior.
- Keep observability counters active for post-rollback analysis.

## Open Questions

- Should scoped retry happen inside sub-agent runtime only, or at orchestrator level with explicit task splitting?
- What is the canonical similarity function for “equivalent tool args” (exact hash vs normalized semantic hash)?
- Should `MEMORY_DEGRADED` ever escalate severity in execute/refactor modes, or remain advisory only?
