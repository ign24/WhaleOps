## Context

`run_and_stream` has two recovery paths after a streaming failure:

1. **Streaming path**: has `_RATE_LIMIT_MAX_RETRIES` (currently 3) retries with exponential backoff for `SERVER_ERROR` and `RATE_LIMITED`.
2. **ainvoke fallback** (lines 2219–2295): called when `stream_failed=True`. Has **zero** retries — a single `await rt.graph.ainvoke(...)` call wrapped in `except Exception`. If that call throws, it immediately yields a partial response.

When the stream fails with `RECURSION_LIMIT`, `recovery_notes` contains `"stream_failure:recursion_limit"`. The ainvoke fallback ignores this and runs the full agent from scratch with the same `recursion_cfg` — identical task, identical budget → guaranteed to either hit the same limit again or fail with 500 from the model being under load from a huge context.

## Goals / Non-Goals

**Goals:**
- Add exponential backoff retry to the ainvoke fallback for `SERVER_ERROR` and `RATE_LIMITED`, using the same `_RATE_LIMIT_MAX_RETRIES` / `_rate_limit_backoff_delay` already used by the streaming path.
- When `recovery_notes` contains a recursion-limit stream failure, build a synthesis-only ainvoke state: a reduced prompt asking for a concise summary of whatever partial work was done, with `recursion_limit=12` (enough for one synthesis turn).

**Non-Goals:**
- Rebuilding the evolved graph state after streaming failure (the graph state is internal to LangGraph and not exposed after a crash — initial state only is available).
- Adding retry to the `GraphRecursionError` outer catch at the bottom of `run_and_stream` (that path already has its own ainvoke retry).
- Changing `_RATE_LIMIT_MAX_RETRIES` or backoff parameters.

## Decisions

### 1) ainvoke retry mirrors streaming retry

The ainvoke exception handler wraps the single ainvoke call in a `for attempt in range(_RATE_LIMIT_MAX_RETRIES)` loop, same as lines 2036–2072 in the streaming path. Only `SERVER_ERROR` and `RATE_LIMITED` trigger retry; all other failure classes fall through immediately.

```
for attempt in range(_RATE_LIMIT_MAX_RETRIES):
    try:
        result = await rt.graph.ainvoke(invoke_state, config=recursion_cfg)
        break  # success
    except Exception as invoke_ex:
        failure_class = _classify_failure(invoke_ex)
        if failure_class in (SERVER_ERROR, RATE_LIMITED) and attempt < max - 1:
            delay = _rate_limit_backoff_delay(attempt)
            await asyncio.sleep(delay)
            continue
        # non-retryable or final attempt → yield partial
        ...
```

**Alternatives considered:**
- Single retry attempt: rejected — 3 attempts matches streaming path and is already tested.
- Retry all failure classes: rejected — RECURSION_LIMIT and UNKNOWN_RUNTIME retries are futile.

### 2) Recursion-limit stream failure → synthesis-only ainvoke

When `recovery_notes` contains `"stream_failure:recursion_limit"`, the ainvoke uses:
- A capped `recursion_limit=12` (6 LLM turns — enough for one synthesis turn with tool calls).
- An augmented `invoke_state` with an extra system message: `"The analysis run was interrupted by a recursion limit. Summarize any partial findings you have already gathered in your context. Do not re-run tools. Provide a best-effort summary of evidence found."`.

The `_build_recovery_invoke_state` helper already accepts notes and prepends a recovery HumanMessage. We add a second function `_build_synthesis_invoke_state` that does the same but with the synthesis instruction and a `synthesis_recursion_limit=12`.

**Alternatives considered:**
- Pass the synthesis instruction via `recovery_notes` content: rejected — `_build_recovery_invoke_state` uses notes for tracing context, not model instructions. Cleaner to have a dedicated helper.
- Use `recursion_limit=8`: accepted as minimum if 12 is too aggressive. 12 is enough for synthesis; 8 is the floor used by the existing outer recursion handler.

## Risks / Trade-offs

- **[Risk] ainvoke retry adds latency on repeated 500s** → Mitigation: same trade-off as in streaming path; 3 attempts × max 30s backoff = 90s max added. Already accepted for streaming.
- **[Risk] Synthesis prompt produces low-quality output when agent state has no findings** → Mitigation: the synthesis prompt says "best-effort summary" — an empty or brief response is acceptable and better than the current "Execution budget was exhausted" with zero content.
- **[Risk] `recovery_notes` string matching is brittle** → Mitigation: the string `"stream_failure:recursion_limit"` is written by the same module at a fixed line. Use a module-level constant `_STREAM_FAILURE_RECURSION = "stream_failure:recursion_limit"`.
