## Why

LangGraph 1.0.10 silently ignores `version="v2"` in `astream()` calls, causing the graph to run in `v1` streaming mode where `StreamMessagesHandler` can re-emit the same `AIMessage` multiple times. When that message contains `tool_calls`, each re-emission re-triggers the tools — producing 10-16x duplicate invocations with 25+ parallel tools, inflating cost, corrupting state, and producing incorrect outputs.

## What Changes

- Replace `stream_mode="messages"` with `stream_mode="updates"` in the `astream()` call inside `safe_tool_calling_agent.py` (lines 846-862).
- Replace `_extract_message_token(event)` with a new helper `_extract_token_from_update(event)` that extracts text tokens from the `"updates"` event shape: `{node_name: AgentState}`.
- Remove the now-unused `version="v2"` kwarg.
- Adjust token extraction logic to pull `content` from the last `AIMessage` in the `agent` node output, emitting only the delta between iterations.

## Capabilities

### New Capabilities

- `streaming-update-mode`: Correct LangGraph streaming using `stream_mode="updates"`, token extraction from graph node updates, and deduplication of tool call dispatch.

### Modified Capabilities

<!-- No existing spec-level behavior changes. The externally visible behavior (SSE token stream to frontend) remains identical — this is an internal implementation fix. -->

## Impact

- **File**: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — `astream()` call block + `_extract_message_token()` helper.
- **No API surface change**: frontend SSE contract is unchanged; tokens still arrive as `ChatResponseChunk` objects.
- **No dependency upgrade required**: fix works on LangGraph 1.0.10.
- **Tests**: need a new unit test that asserts tool nodes are invoked exactly once per LLM turn even when the graph emits multiple update events.
