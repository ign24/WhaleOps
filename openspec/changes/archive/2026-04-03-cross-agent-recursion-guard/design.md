## Context

The current deterministic fallback policy improves top-level agent resilience, but nested subagents can still fail with raw `GraphRecursionError` payloads that are treated as plain tool responses. This creates a reliability gap for long tasks: orchestration continues, but with degraded trust and inconsistent recovery semantics.

Subagents (`reader_agent`, `security_agent`, `qa_agent`, `review_agent`, `docs_agent`) are configured as generic `tool_calling_agent` nodes with independent iteration budgets. Their failures are not uniformly normalized before being re-consumed by the orchestrator.

## Goals / Non-Goals

**Goals:**
- Normalize nested subagent recursion/timeout/validation failures into deterministic classes.
- Ensure orchestrator applies bounded recovery and structured partial continuation for subagent-origin failures.
- Extend loop-guard controls to delegated subagent calls.
- Emit trace events that clearly identify source (`orchestrator` vs `subagent`) and recovery outcomes.

**Non-Goals:**
- Rewriting NAT/LangGraph internals.
- Unlimited retries or dynamic autonomous escalation.
- Replacing existing memory layers or changing persistence backends.

## Decisions

1. **Subagent failure adapter at orchestrator boundary**
   - Parse subagent tool error payloads and classify into deterministic failure classes before synthesis.
   - Why: fastest way to make all subagent types consistent without immediate deep migration.
   - Alternative rejected: migrate all subagents to a new workflow type in one step (higher rollout risk).

2. **Single bounded escalation pass for subagent recursion/timeout**
   - On recoverable subagent classes, run one scoped retry/replan; no second pass.
   - Why: preserves continuity while keeping latency/cost bounded.
   - Alternative rejected: immediate fail-fast or unbounded retries.

3. **Cross-agent loop signature namespace**
   - Loop guard key includes delegation identity (`subagent_name + tool + normalized_args`).
   - Why: prevents repetitive delegated scans with equivalent arguments.
   - Alternative rejected: tool-only signatures (insufficient for delegated call patterns).

4. **Partial contract preserved across nested failures**
   - If escalation is exhausted, always return structured partial output with verified/unverified scopes.
   - Why: no hard stop when the LLM can still provide bounded useful output.

## Risks / Trade-offs

- **[Risk] False-positive normalization of subagent errors** → Mitigation: strict parser for known patterns + fallback to `UNKNOWN_RUNTIME`.
- **[Risk] Extra latency from escalation pass** → Mitigation: one retry cap and scoped replan prompt.
- **[Risk] Overblocking due to loop guard** → Mitigation: conservative threshold default and trace-driven tuning.

## Migration Plan

1. Add subagent failure normalization in shadow mode (trace only).
2. Enable deterministic handling for `RECURSION_LIMIT` and `TOOL_TIMEOUT` from subagents.
3. Enable cross-agent loop signatures and guard enforcement.
4. Promote structured partial output on exhausted nested recovery paths.
5. Validate with integration scenarios for long security/repo audits.

Rollback:
- Disable subagent normalization/escalation via config flags and keep trace events for diagnosis.

## Open Questions

- Should per-subagent recursion budgets be static or mode-dependent defaults?
- Do we want a separate user-facing label for `subagent_unavailable` vs generic runtime failure?
