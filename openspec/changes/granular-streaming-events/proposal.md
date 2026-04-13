## Why

The agent buffers LLM output at two levels: `agent_node` calls `self.agent.ainvoke()` (non-streaming HTTP to NIM), and `_response_fn` uses `graph.astream(stream_mode="updates")` which emits only one event per completed node. The user sees nothing until the entire agent step finishes, then a block of text drops. The frontend already has SSE, typewriter, and activity timeline plumbing — but receives buffered content. All three modes (analyze, execute, chat) suffer the same bottleneck.

## What Changes

- Switch the LLM call inside `agent_node` from `self.agent.ainvoke()` to `self.agent.astream()` with chunk accumulation; the node still returns the full state, but the underlying LLM streams tokens through the LangChain callback chain.
- Replace `graph.astream(stream_mode="updates")` with `graph.astream_events(version="v2")` in `_response_fn` across all 6 retry/recovery branches.
- Extract the 6 near-identical streaming loops into a single helper `_stream_graph_events()` so the transport change lives in one place and future changes touch one function.
- Dispatch events by type: `on_chat_model_stream` → token `ChatResponseChunk`; `on_tool_start` / `on_tool_end` → activity events via NAT's existing `intermediate_data:` channel.
- Remove deprecated `_extract_message_token()` (line 1153) — no longer referenced after the refactor.
- Frontend: bypass the typewriter when `isStreaming=true` to avoid double-buffering real token chunks; preserve it for the final drain and non-streaming paths.
- Add handling for the finer-grained tool lifecycle activity events already deduped by `buildActivityDedupeKey`.
- **BREAKING**: The shape of chunks observed in tests changes from per-node-completion to per-LLM-token. Existing unit tests that assert on the number/timing of `ChatResponseChunk` yields must be updated.

## Capabilities

### New Capabilities
- `granular-agent-streaming`: Token-level LLM streaming and native tool lifecycle events emitted from the agent loop through a single unified SSE channel, replacing node-completion buffering.

### Modified Capabilities
- `message-stream-animations`: Typewriter bypasses animation when real token streaming is active; keeps word-batching only for drain and non-streaming fallback paths.

## Impact

- **Backend**: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — `agent_node` (line 1530), `_response_fn` streaming loops (lines 2278, 2317, 2351, 2389 + recovery paths at 2484, 2518, 2597, 2672, 2831, 2873), new helper function, removal of `_extract_message_token`.
- **Frontend**: `ui-cognitive/hooks/use-typewriter.ts` (bypass when streaming), possibly `ui-cognitive/components/chat/chat-panel.tsx` (new activity event types).
- **Tests**: `tests/unit/test_safe_tool_calling_agent.py` — the tool-dispatch test (lines 1047-1120) and incremental-chunk test (lines 1122-1168) need rewriting for the new event shape; new tests for `_stream_graph_events()` helper covering all 6 retry branches.
- **Dependencies**: No new packages. Uses existing LangGraph 1.0.10 `astream_events(version="v2")` and langchain-nvidia-ai-endpoints 1.1.0 streaming support.
- **Risk**: A prior attempt with `stream_mode="messages"` caused 10-16x duplicate tool dispatches. `astream_events(v2)` is callback-based (observational), not state-diff, and does not drive dispatch — but NIM's known empty `additional_kwargs` on streaming (existing fix at line 1042) must remain in place.
- **Branch**: `feat/granular-streaming-events`. Revertible to `main` with no data migrations.
