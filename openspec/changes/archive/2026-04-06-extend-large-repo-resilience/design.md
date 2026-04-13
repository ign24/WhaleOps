## Context

The `large-repo-resilience` change added `_guard_tool_outputs` with a global `max_chars=30000` applied uniformly to every tool. The `adaptive-clone-strategy` change added prompt guidance for shallow clones and excludePatterns on directory trees. Both are archived as complete.

Live logs from home-assistant-core analysis show the remaining failure path:

```
fs_tools__directory_tree("/tmp/analysis/home-assistant-core", excludePatterns=[...])
  → original_chars: 3,199,709
  → truncated_chars: 30,000   ← guard fires but 30K is still too large

next LLM call → [500] EngineCore encountered an issue  ← model crashes on context

SERVER_ERROR retry → same 30K context → same crash → loop ends with empty output
```

Three independent fixes are needed.

## Goals / Non-Goals

**Goals:**
- Cap `directory_tree` tool output at 5,000 chars by default (configurable per-tool).
- Add `maxDepth` usage guidance to `directory_tree_policy` in `analyze.md` and `execute.md`.
- Detect `SERVER_ERROR` following a `tool_output_truncated` event and retry with further-reduced context rather than identical context.

**Non-Goals:**
- Adding `maxDepth` as a new parameter to the underlying `fs_tools__directory_tree` NAT function (that's owned by the NAT layer; we work with what the tool exposes).
- Changing the global 30K guard for other tools.
- Redesigning the streaming/ainvoke fallback architecture.

## Decisions

### 1) Per-tool limits as a `dict[str, int]` alongside the global cap

Extend `_guard_tool_outputs` to accept `per_tool_max_chars: dict[str, int]`. The per-tool limit for a given tool name takes precedence over the global cap when present. Tool name is read from `getattr(msg, "name", None)`.

```python
def _guard_tool_outputs(
    state, max_chars=30000, per_tool_max_chars=None
) -> None:
    for i, msg in enumerate(state.messages):
        if not isinstance(msg, ToolMessage): continue
        tool_name = getattr(msg, "name", None) or ""
        limit = (per_tool_max_chars or {}).get(tool_name, max_chars)
        # truncate to limit ...
```

Default config: `{"directory_tree": 5000, "fs_tools__directory_tree": 5000}`.

**Alternatives considered:**
- Separate function for directory_tree only: rejected — generalizes cleanly to any tool that tends to produce large outputs.
- Prompt-only fix (instruct agent to call with maxDepth): rejected as probabilistic; runtime guard is the reliable backstop.

### 2) Directory tree depth guidance in prompts

The `<directory_tree_policy>` block in `analyze.md` and `execute.md` must add:
- Default: `maxDepth: 3` for all repos.
- Override: `maxDepth: 2` when the repo was cloned shallow (`shallow=True` in clone_repository response).

This is a prompt-only change. It instructs the model to self-limit depth before the runtime guard triggers, which is preferable (smaller output = faster, lower cost, no truncation needed).

### 3) Context-reduction retry on SERVER_ERROR with recent truncation

Current behavior: `SERVER_ERROR` triggers `exponential_backoff_retry` which re-streams with the same state — including the same 30K (or now 5K) truncated tool message that likely caused the crash.

New behavior: Before the backoff retry, check whether the most recent `ToolMessage` in state was already truncated (its content ends with `[OUTPUT TRUNCATED:`). If so, halve its length and retry once. Only if that second attempt also fails does the loop fall through to `stream_failed=True`.

```
on SERVER_ERROR:
  if last ToolMessage has truncation marker:
    halve it → retry (1 attempt, no backoff delay)
    if retry succeeds: continue
    else: fall through to normal backoff loop
  else:
    normal backoff loop (unchanged)
```

Track the context-reduction attempt with a `server_error_context_reduction` trace event.

**Alternatives considered:**
- Remove the last tool message entirely on retry: rejected — complete removal loses the tool call/result pairing and can cause tool_call_id mismatch (the exact bug we just fixed).
- Apply context reduction in ainvoke fallback too: accepted as a follow-up; keep this change to the streaming path for now to minimize scope.

## Risks / Trade-offs

- **[Risk] 5K cap on directory_tree may be too aggressive for shallow repos** → Mitigation: the cap is configurable via `per_tool_max_chars` in config.yml; operators can adjust per mode.
- **[Risk] Context-reduction retry adds latency** → Mitigation: it's a single extra attempt, no backoff delay; total added latency is one LLM call at most.
- **[Risk] Halved message might still be too large** → Mitigation: after halving, `_guard_tool_outputs` would have already capped it; the true risk is the new 5K cap still being too large for the full context — but this is negligible compared to the current 30K.
- **[Risk] Truncation marker string check is fragile** → Mitigation: `[OUTPUT TRUNCATED:` is written by `_guard_tool_outputs` — the same module — so the string is stable and co-located.

## Migration Plan

1. Add `per_tool_max_chars` parameter to `_guard_tool_outputs` and update callers.
2. Update `SafeToolCallAgentGraph.__init__` and `SafeToolCallAgentWorkflowConfig` with the new field.
3. Update `config.yml` with default `per_tool_max_chars` values.
4. Add context-reduction retry logic in the `SERVER_ERROR` branch of `run_and_stream`.
5. Update `analyze.md` and `execute.md` `<directory_tree_policy>` sections.
6. Add/adjust unit tests for all changed paths.
7. Run full test suite and linter.

## Open Questions

- Should `per_tool_max_chars` be configurable per mode (e.g., execute mode may want a different limit for directory_tree than analyze mode)?
- Is 5,000 chars the right default for `directory_tree`, or should it be lower (3,000)?
