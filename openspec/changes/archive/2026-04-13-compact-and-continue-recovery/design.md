## Context

The agent's `_response_fn` in `safe_tool_calling_agent.py` handles failures through a layered system: stream retries, ainvoke fallback, synthesis-only mode, and a top-level `GraphRecursionError` handler. Two prior changes (`fix-agent-loop-recovery`, `harden-non-terminating-agent-loop`) hardened individual failure paths but didn't address the fundamental pattern: every recovery path retries with the **same bloated context** and **equal or reduced budget**, guaranteeing repeated failure on large repos.

Current state of each death path:

| # | Failure | Current Recovery | Outcome |
|---|---------|-----------------|---------|
| 1 | SERVER_ERROR/RATE_LIMITED after 3 retries | Same context, same budget | Dies |
| 2 | DEGRADED_FUNCTION probe fails | Single ainvoke probe | Dies (model is down — unrecoverable) |
| 3 | Synthesis-only fails (post recursion) | budget=12, no tools | Dies |
| 4 | ainvoke recovery fails | Same context, recovery msg prepended | Dies |
| 5 | Top-level GraphRecursionError retry fails | budget//2, 1 attempt | Dies |
| 6 | Top-level GraphRecursionError not retryable | No retry | Dies |
| 7 | Unhandled exception | raise | Propagated (correct) |

The existing `compress_state()` in `memory/working.py` runs mid-loop inside `agent_node` with a 10-message cooldown. It never runs in recovery paths.

## Goals / Non-Goals

**Goals:**
- Agent continues making progress on large-repo tasks instead of dying at recursion/context limits
- Recovery loop uses existing compaction infrastructure — no new summarization system
- Progress detection prevents infinite loops (no-progress → synthesis immediately)
- Configurable per mode (analyze may need more rounds than chat)
- Covers 5 of 7 failure paths (#1, #3, #4, #5, #6) plus CONTEXT_OVERFLOW

**Non-Goals:**
- Recovering from DEGRADED_FUNCTION (model is down, compaction doesn't help)
- Recovering from unhandled exceptions (correct to propagate)
- Changing the mid-loop compaction in `agent_node` (that stays as-is)
- Changing the streaming protocol or SSE chunk format
- Adding token counting or context budget estimation (character-based proxy is sufficient)

## Decisions

### D1: Outer recovery loop wraps the entire astream+fallback block

The recovery loop lives in `_response_fn`, wrapping lines 2165-2558 (the `try: astream ... except` block and the `if stream_failed` ainvoke fallback block). Each iteration is a "recovery round" that gets a fresh recursion budget.

**Alternative considered**: Putting the loop inside `agent_node` or as a LangGraph edge. Rejected because the failure points span both the stream path and the ainvoke fallback — they're in `_response_fn`, not in the graph itself.

### D2: Progress measured from state.messages, not parsed logs

`_measure_progress(messages, checkpoint_idx)` counts ToolMessages since checkpoint with `status != "error"` and `len(content) > 50`. This uses `state.messages` which is mutated by the graph during execution — it IS the agent's execution log.

**Alternative considered**: Parsing trace events or adding a counter. Rejected because state.messages already contains all needed information with zero overhead.

### D3: Progressive compaction via compress_state with overridden config

Each recovery round creates a temporary `CompactionConfig` with decreasing `compaction_retain_recent`:
- Round 1: retain_recent=4 (moderate)
- Round 2: retain_recent=2 (aggressive)
- Round 3+: retain_recent=1 (maximum — anchor + summary only)

`compress_state()` already accepts a config parameter. The change is that the caller (recovery loop) provides a config override instead of using the instance default. No changes to `compress_state`'s signature are needed — it already takes `config: Any`.

**Alternative considered**: A separate `aggressive_compress()` function. Rejected because `compress_state` already handles all the pair-boundary logic, error preservation, and summarization. Duplicating that would be wasteful.

### D4: CONTEXT_OVERFLOW becomes retryable

Change `FAILURE_POLICIES[FailureClass.CONTEXT_OVERFLOW]` from `retryable=False` to `retryable=True, action="compact_and_continue"`. Context overflow is caused by large state — compaction directly addresses the root cause.

The recovery loop handles this: on CONTEXT_OVERFLOW, compact aggressively, then retry with the compacted state and fresh budget.

### D5: Synthesis-only demoted to last resort

Currently: recursion limit in stream → synthesis-only ainvoke (budget=12, no tools) as FIRST fallback.

New: recursion limit → enters recovery loop → compact + fresh budget → continue with tools. Synthesis-only only triggers when:
- `_measure_progress()` returns False (no useful work since last checkpoint)
- OR `max_recovery_rounds` exhausted

This gives the agent a real chance to finish the task before being forced into summarize-only mode.

### D6: Top-level GraphRecursionError uses recovery loop

Replace the current handler (lines 2606-2700) which halves budget and does 1 ainvoke attempt. Instead, catch GraphRecursionError and feed it into the same recovery loop. The counterproductive budget halving is eliminated.

### D7: _RecoverableFailure sentinel for recovery loop control flow

Introduce a lightweight internal exception `_RecoverableFailure(failure_class, state)` raised from within the astream/ainvoke block when a failure is eligible for compact-and-continue. The outer loop catches this to trigger compaction. Non-recoverable failures (DEGRADED, UNKNOWN_RUNTIME with no progress) skip the sentinel and finalize immediately.

Recoverable conditions:
- `RECURSION_LIMIT` (always)
- `CONTEXT_OVERFLOW` (always)
- `SERVER_ERROR` after backoff retries exhausted AND progress exists
- `RATE_LIMITED` after backoff retries exhausted AND progress exists
- ainvoke fallback failure when progress exists

## Risks / Trade-offs

**[Over-compaction loses critical context]** → Mitigated by progressive retain_recent (starts at 4, only goes to 1 if prior rounds failed) and progress detection (no-progress exits immediately instead of compacting further).

**[Recovery loop adds latency]** → Each round includes compaction (LLM call for summarization) + full graph execution. Acceptable because the alternative is total failure. Configurable `max_recovery_rounds` caps worst-case latency.

**[Compaction LLM failure blocks recovery]** → `compress_state` already handles this: returns original messages on failure. If compaction fails, the recovery round proceeds with uncompacted state (may fail again, which counts as a no-progress round).

**[Interaction with mid-loop compaction]** → The mid-loop compaction in `agent_node` still runs normally within each recovery round. The recovery-loop compaction is an additional, more aggressive pass between rounds. They compose correctly because both use `compress_state`.

**[Streaming chunks already yielded before failure]** → Content yielded in prior rounds is already sent to the client. The recovery round may produce overlapping context. Mitigated: the compacted state doesn't include the streamed content (it's the graph state, not the SSE output). The `content` variable accumulates across rounds.
