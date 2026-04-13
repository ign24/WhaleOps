## Context

The agent runtime uses mid-loop context compaction (`compress_state` in `memory/working.py`) to keep message history within token budgets during long-running requests. The compaction logic splits messages into an anchor, a middle window (evicted), and a recent window (kept verbatim). When the recent/middle boundary falls inside a tool call/result pair, the compaction removes the `ToolMessage` or `AIMessage` that holds the matching ID, producing orphaned IDs in the retained history. The next LLM call fails with `[400] Unexpected tool call id` — a hard API rejection that the current fallback does not handle specifically.

The fallback path (`fallback_activated` with `reason=unknown_runtime`) treats this 400 identically to any other unknown failure and escalates to an `ainvoke` call against a fixed NAT function ID. That function can itself be in a DEGRADED state, producing a second 400. There is no recovery after two consecutive 400s — the request ends with empty output.

Confirmed from live log:
```
context_compacted: messages_before=9, messages_after=7
spawn_agent → [400] Unexpected tool call id e9dac0058
fallback_activated reason=unknown_runtime → ainvoke
ainvoke → [400] DEGRADED function 7fe236cd-... cannot be invoked
loop ends
```

## Goals / Non-Goals

**Goals:**
- Guarantee that `compress_state` never produces a message list with orphaned tool call IDs.
- Classify `Unexpected tool call id` errors as a distinct failure class with a targeted repair-and-retry recovery.
- Give `spawn_agent` and the `ainvoke` fallback a DEGRADED function retry policy that avoids dead ends.

**Non-Goals:**
- Redesigning the compaction algorithm or changing compaction thresholds.
- Handling DEGRADED functions outside the agent loop (infra-level health checks are out of scope).
- Adding new agent modes or modifying mode prompts.
- Changing LangGraph graph structure.

## Decisions

### 1) Fix compaction at the boundary, not in post-processing

The `compress_state` boundary split (`middle = messages[1:-retain_recent]`) can split paired messages. The fix is to walk backward from the boundary and expand the recent window until no ToolMessage at the start of recent has its originating AIMessage in the middle — and no AIMessage at the end of middle has pending ToolMessages in recent.

**Algorithm:**
```
boundary = len(messages) - retain_recent
while boundary > 1:
    candidate = messages[boundary]
    if is_tool_message(candidate):
        # its AIMessage partner must be in recent too
        partner_idx = find_ai_message_with_tool_call(messages, candidate.tool_call_id, before=boundary)
        if partner_idx is not None and partner_idx < boundary:
            boundary -= 1  # pull boundary back to include the AIMessage
            continue
    prev = messages[boundary - 1]
    if is_ai_message_with_tool_calls(prev):
        # all ToolMessages for prev's tool_calls must be in recent
        result_indices = find_tool_results(messages, prev.tool_calls, from_idx=boundary)
        if any(idx >= boundary for idx in result_indices):
            boundary -= 1  # pull boundary back to include prev
            continue
    break
```

This is O(n) per compaction call, runs entirely in `compress_state`, and requires no changes to callers.

**Alternatives considered:**
- Post-process retained messages to strip orphaned ToolMessages: rejected — it silently drops execution context the agent may need.
- Expand recent window unconditionally by +2: rejected — fragile heuristic that doesn't generalize.

### 2) Classify `Unexpected tool call id` as `TOOL_CALL_ID_MISMATCH`

The existing `deterministic-fallback-policy` spec defines a failure taxonomy but does not include this class. Add `TOOL_CALL_ID_MISMATCH` as a new class in the taxonomy. Detection: check the error message string for `"Unexpected tool call id"` before classifying as `UNKNOWN_RUNTIME`.

Recovery action for `TOOL_CALL_ID_MISMATCH`:
1. Run `repair_message_history(state.messages)` — strip any ToolMessage whose `tool_call_id` has no matching AIMessage tool call entry, and strip any AIMessage tool_call entry with no matching ToolMessage.
2. Retry the LLM call with the repaired history (single retry, bounded).
3. If repair produces no change (nothing to strip), fall through to `UNKNOWN_RUNTIME` handling.

**Alternatives considered:**
- Resend the original request from scratch: rejected — loses completed work.
- Treat as UNKNOWN_RUNTIME and let existing fallback handle it: rejected — this is exactly what fails today.

### 3) Session-local DEGRADED function blacklist for `spawn_agent` / `ainvoke`

When a NAT function call returns `[400] DEGRADED function cannot be invoked`, record the function ID in a request-scoped set (`_degraded_function_ids`). On any subsequent invocation that would use a blacklisted function ID, skip remote invocation and run the task directly via `SafeToolCallAgentGraph.ainvoke_direct()` (the in-process path already used for the non-remote fallback).

The `ainvoke` fallback itself should also check `_degraded_function_ids` before attempting remote invocation, and go straight to direct execution if the target is already known degraded.

**Alternatives considered:**
- Global degraded-function registry (across requests): rejected — degraded state is transient, cross-request sharing would suppress valid retries after recovery.
- Retry the same degraded function with backoff: rejected — the DEGRADED state is a platform-level condition, not a transient network blip.

## Risks / Trade-offs

- **[Risk] Boundary expansion in compress_state grows the retained window unpredictably** → Mitigation: cap expansion at `retain_recent * 2`; if cap is hit, emit a `compaction_boundary_capped` trace event and proceed with the original boundary (keeping the pair potentially orphaned is better surfaced as a known edge case than silently expanding without bound).
- **[Risk] repair_message_history strips messages that were legitimately needed** → Mitigation: repair only removes provably orphaned entries (no matching pair anywhere in history); it never removes paired entries.
- **[Risk] Direct-execution fallback for DEGRADED functions bypasses spawn_agent concurrency** → Mitigation: acceptable for single-task recovery; parallelism is an optimization, not a correctness requirement.
- **[Risk] TOOL_CALL_ID_MISMATCH detection via string match is brittle** → Mitigation: string is from the NAT/LLM API error response and has been stable; add a secondary check on HTTP status 400 + `BadRequestError` type to gate classification.

## Migration Plan

1. Update `compress_state` in `memory/working.py` with the boundary-walk fix.
2. Add `repair_message_history` utility to `memory/working.py`.
3. Add `TOOL_CALL_ID_MISMATCH` to the failure taxonomy and classification logic in `safe_tool_calling_agent.py`.
4. Add `_degraded_function_ids` session set and check to `spawn_agent` tool and `ainvoke` fallback path.
5. Add unit tests for: boundary expansion cases, repair utility, new failure class classification, DEGRADED function blacklist.
6. Run full test suite; verify no regressions in compaction or fallback paths.

## Open Questions

- Should `repair_message_history` be callable as a standalone tool (so the agent can invoke it explicitly on budget exhaustion)? Or keep it as an internal runtime utility only?
- What is the right cap for boundary expansion (`retain_recent * 2`)? Should it be configurable via `WorkingMemoryConfig`?
