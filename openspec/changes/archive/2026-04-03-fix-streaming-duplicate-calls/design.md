## Context

The agent's streaming path in `safe_tool_calling_agent.py` calls `rt.graph.astream(state, config=..., stream_mode="messages", version="v2")`. LangGraph 1.0.10 defines `DeprecatedKwargs` as an empty `TypedDict`, so `version="v2"` is silently accepted and discarded — the graph always runs in `v1` mode regardless.

In `v1` streaming mode with `stream_mode="messages"`, `StreamMessagesHandler` can emit the same `AIMessage` object multiple times as it propagates through internal reducers. Each emission passes through `_extract_message_token()`, which extracts `content` from the message. If that message contains `tool_calls`, LangGraph's conditional edges re-route to the tool nodes for every emission, causing the same tools to execute 10-16 times per LLM response when 25+ tools are registered.

The fix does not require a LangGraph upgrade. Switching to `stream_mode="updates"` changes the event shape from a stream of `BaseMessage` objects to a stream of `{node_name: AgentState}` dicts — one per completed graph step. Tool dispatch is driven by the graph's conditional edges and happens at most once per `AIMessage` in the state, so duplication is structurally impossible.

## Goals / Non-Goals

**Goals:**

- Eliminate duplicate tool invocations caused by re-emitted `AIMessage` objects in `v1` streaming mode.
- Keep the frontend SSE contract unchanged: tokens still arrive as `ChatResponseChunk` objects.
- Work on the currently installed LangGraph 1.0.10 with no dependency changes.
- Maintain the existing `ainvoke` fallback path.

**Non-Goals:**

- Upgrading LangGraph to 1.1+.
- Changing the graph topology, tool definitions, or agent prompt.
- Modifying the `ainvoke` fallback path (it is not affected by the bug).
- Improving streaming latency (out of scope for this bugfix).

## Decisions

### Decision 1: Use `stream_mode="updates"` instead of `stream_mode="messages"`

**Chosen**: Switch to `stream_mode="updates"`.

**Why**: The `"updates"` mode emits `{node_name: state_delta}` once per completed node, not once per message propagation. Tool dispatch happens inside the graph topology — not in the streaming handler — so no message can trigger tools more than once per graph step regardless of how many times the streaming loop iterates.

**Alternative considered**: Upgrade to LangGraph 1.1+ where `version="v2"` is recognized and deduplicated internally.
- Rejected: dependency upgrade with broader risk surface, unrelated to the specific bug. A targeted `stream_mode` change is lower risk and reversible.

**Alternative considered**: Deduplicate events client-side by tracking seen `tool_call_id` values.
- Rejected: masks the symptom, does not fix the root cause. Tool nodes would still execute multiple times and their side effects (filesystem writes, API calls) would still be duplicated.

### Decision 2: New helper `_extract_token_from_update(event)`

**Chosen**: Replace `_extract_message_token()` with a new helper that understands the `"updates"` event shape.

**Event shape** for `stream_mode="updates"`:
```python
{"agent": ToolCallAgentGraphState(messages=[..., AIMessageChunk(content="hello")])}
```

The helper reads the last message from the `"agent"` node's state, checks it is an `AIMessageChunk` with non-empty string content, and returns that content.

**Incremental token extraction**: LangGraph `"updates"` events include the full node output, not just the diff. To avoid sending repeated content, the helper must track `content_so_far` across iterations and emit only the new suffix. This is equivalent to the delta behavior `"messages"` mode provided inherently.

**Why not modify `_extract_message_token()`**: The existing function is typed against the old `{"type": "messages", "data": (...)}` shape. Reusing it would require adding branching that obscures intent. A distinct function keeps the old path readable if needed for debugging.

### Decision 3: Keep `version="v2"` removal

Remove the now-dead `version="v2"` kwarg to avoid misleading future readers. It had no effect on 1.0.10 and is not needed when using `stream_mode="updates"`.

## Risks / Trade-offs

- **Streaming granularity change**: `"messages"` mode can emit partial `AIMessageChunk` tokens mid-generation; `"updates"` mode emits the accumulated content once the node completes. This may increase perceived latency for long responses. Mitigation: LangGraph streams intermediate `AIMessageChunk` objects through `"updates"` when the underlying LLM supports streaming — verify that `add_messages` reducer accumulates chunks during the node run. If not, an intermediate streaming layer may need to be added in a follow-up change.
- **Content deduplication logic**: tracking `content_so_far` to extract deltas adds a small statefulness requirement to the streaming loop. Mitigation: unit test the helper with multiple update events carrying overlapping content.
- **Unknown node names**: the helper reads from the `"agent"` key. If the graph ever renames that node, the helper silently returns `None` and the fallback `ainvoke` path kicks in. Mitigation: log a warning when no recognized node key is found in an update event.

## Migration Plan

1. Implement `_extract_token_from_update()` and add unit tests.
2. Replace the `astream` call parameters and swap the helper.
3. Run the full test suite including the new duplicate-call regression test.
4. Deploy: no schema changes, no infrastructure changes, no migration needed.
5. Rollback: revert the two-line change to `astream` call and restore `_extract_message_token` usage. The old code path is preserved as a reference until the change is archived.

## Open Questions

- Does LangGraph 1.0.10 emit intermediate `AIMessageChunk` objects within the `"updates"` stream during token generation, or does it buffer until the node finishes? This determines whether the latency trade-off is material. Needs a local profiling run against a slow model.
