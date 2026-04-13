## Why

The agent loop dies on 5 of 7 failure paths (recursion limit, server error, context overflow, synthesis failure, ainvoke recovery failure) because current recovery strategies retry with the same bloated context and reduced budget — guaranteeing repeated failure. Retries without compaction repeat the same error; budget halving makes completion harder, not easier. The agent needs a progress-aware recovery loop that compacts state and resets budget when there is evidence of forward progress.

## What Changes

- Wrap the entire `astream + ainvoke fallback` block in `_response_fn` with an outer recovery loop (max N rounds, configurable per mode via `max_recovery_rounds`).
- On recoverable failure, measure progress via `state.messages` (count useful ToolMessages since last checkpoint). If progress exists, compact aggressively and reset recursion budget to original. If no progress, emit synthesis and exit.
- Progressive compaction: each recovery round reduces `compaction_retain_recent` (round 1: 4, round 2: 2, round 3+: 1) reusing existing `compress_state()` infrastructure.
- Make `CONTEXT_OVERFLOW` retryable — compaction before retry directly addresses the root cause.
- Demote synthesis-only from first fallback (after recursion limit) to last resort — only when no progress or max rounds exhausted.
- Replace the top-level `GraphRecursionError` handler's "halve budget + 1 ainvoke" with entry into the recovery loop (compact + fresh budget).

## Capabilities

### New Capabilities
- `progress-aware-recovery-loop`: Outer loop in `_response_fn` that detects forward progress via `state.messages`, compacts aggressively, resets budget, and continues. Covers recursion limit, server error, context overflow, and ainvoke failures.
- `progressive-compaction`: Per-round compaction aggressiveness (retain_recent decreasing each round) using existing `compress_state` infrastructure with caller-provided config override.

### Modified Capabilities
- `deterministic-fallback-policy`: CONTEXT_OVERFLOW changes from non-retryable to retryable with `compact_and_continue` action. Synthesis-only demoted from first fallback to last resort.
- `working-memory-summarization`: `compress_state` gains support for caller-provided compaction config override (retain_recent, thresholds) to enable aggressive compaction from the recovery loop.

## Impact

- Affected systems: `_response_fn` in `safe_tool_calling_agent.py` (recovery flow restructure), `compress_state` in `memory/working.py` (config override support), `FAILURE_POLICIES` dict, `config.yml` (new `max_recovery_rounds` per mode).
- Affected behavior: long-running analyze/execute on large repos — instead of dying at recursion/context limits, agent compacts and continues up to N rounds.
- Risk: over-compaction could lose critical context. Mitigated by progress detection (no-progress triggers synthesis immediately) and progressive retain_recent (starts conservative, gets aggressive only if needed).
