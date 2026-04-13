## Context

The cognitive agent exposes all 3 modes (`analyze`, `execute`, `chat`) through NAT's SSE endpoint `/chat/stream`. The frontend already handles streaming correctly — it parses `data:` token chunks, `event: metadata`, `event: activity`, `event: usage`, `event: error` — and includes deduplication at both proxy and consumer levels.

The bottleneck is entirely in the backend:

1. **LLM-level buffering**: In `SafeToolCallAgentGraph.agent_node` (safe_tool_calling_agent.py:1530), the code calls `self.agent.ainvoke({"messages": state.messages}, config=merged_config)`. `self.agent` is `prompt_runnable | self.bound_llm`. `ainvoke` on ChatNVIDIA makes a non-streaming HTTP request to NIM and returns the full `AIMessage` only after the model finishes generating.

2. **Graph-level buffering**: `_response_fn` uses `rt.graph.astream(state, config=cfg, stream_mode="updates")` (line 2278 and 5 retry duplicates). `stream_mode="updates"` emits one event per completed node `{node_name: AgentState}`. Tokens are extracted only from the "agent" node's message delta via `_extract_token_from_update`, which always sees the full message at once.

**Prior attempt and scar**: The codebase previously used `stream_mode="messages"` (see deprecated `_extract_message_token` at line 1153). That mode caused 10-16× duplicate tool dispatches because message events fired repeatedly and the loop treated each as a new tool invocation. The switch to `"updates"` fixed it but gave up streaming granularity.

**Stack**:
- LangGraph 1.0.10 (supports `astream_events(version="v2")`)
- langchain-core 1.2.17
- langchain-nvidia-ai-endpoints 1.1.0 (supports `_astream`)
- NAT 1.4.1 (provides FastAPI SSE integration + `intermediate_data:` channel)

## Goals / Non-Goals

**Goals:**
- LLM tokens flow from NIM → agent_node → graph → SSE → UI with no intermediate buffer.
- Tool lifecycle events (`tool_start`, `tool_end`) emitted natively by LangGraph callbacks, not reconstructed from message state.
- All 3 modes benefit uniformly — no mode-specific streaming branches.
- Single unified SSE stream (`data:` for tokens, `intermediate_data:` for activity), no new transports.
- 6 retry/recovery blocks collapse into 1 helper so future changes live in one place.
- Zero additional LLM token cost — `astream` and `ainvoke` consume identical tokens; only the transport changes.

**Non-Goals:**
- Expand/collapse UI for long agent outputs (separate future change).
- Changes to deduplication logic, budget preflight, thinking-tag parsing, or SSE envelope format.
- Changes to fallback paths' semantics (rate-limit backoff, context-reduction retry, ainvoke synthesis) — only their streaming loops are refactored.
- Changes to the workspace_api or any non-agent endpoints.

## Decisions

### Decision 1: Use `astream_events(version="v2")` instead of `stream_mode="messages"`

**Choice**: Replace `graph.astream(stream_mode="updates")` with `graph.astream_events(state, config=cfg, version="v2")`.

**Rationale**: 
- `astream_events` is callback-based (observational), not state-diff-based. It captures `on_chat_model_stream`, `on_tool_start`, `on_tool_end` events emitted by the LangChain callback chain during node execution. It does NOT drive tool dispatch — dispatch still happens through graph conditional edges.
- `stream_mode="messages"` is state-diff-based: it emits whenever messages change in the graph state. The prior bug came from this: repeated message events were interpreted as repeated tool calls. `astream_events` sidesteps this entirely because tool_calls arrive once via `on_tool_start` when the tool is actually dispatched.
- We get token granularity (`on_chat_model_stream`) AND native tool lifecycle for free, from a single stream.

**Alternatives considered**:
- *Dual stream mode `["updates", "messages"]`*: Still state-diff-based; inherits the duplicate risk.
- *Custom LangChain callback handler*: Reinvents what `astream_events(v2)` already provides.
- *Keep `stream_mode="updates"` and just change agent_node*: The graph would still only emit at node completion — the tokens from `on_chat_model_stream` wouldn't surface. `astream_events` is required for token-level.

### Decision 2: `agent_node` must use `astream` internally

**Choice**: Replace `response = await self.agent.ainvoke(...)` with accumulation loop over `self.agent.astream(...)`.

**Rationale**: 
- `ainvoke` on ChatNVIDIA calls `_agenerate`, which makes a non-streaming HTTP request. The callback chain cannot emit `on_chat_model_stream` events because the underlying call doesn't stream.
- `astream` on ChatNVIDIA calls `_astream`, which makes a streaming HTTP request and yields `AIMessageChunk`s. The callback chain emits `on_chat_model_stream` per chunk.
- The node still returns a single `AIMessage` (accumulated from chunks) so the rest of the graph (tool dispatch, state management, existing `_normalize_tool_call_ids` and tool_call back-fill at line 1042) is unchanged.

**Alternatives considered**:
- *Patch NAT's ToolCallAgentGraph upstream*: Out of scope, and NAT 1.4.1 is pinned.
- *Use `astream_events` without changing agent_node*: Verified impossible — `ainvoke` bypasses the streaming callback path.

### Decision 3: Single helper `_stream_graph_events()` replaces 6 retry blocks

**Choice**: Extract the streaming loop into `async def _stream_graph_events(graph, state, config, content_so_far, chunk_id, created, model_name, mode) -> AsyncGenerator[ChatResponseChunk | ActivityEvent, None]`.

**Rationale**:
- 6 near-identical blocks exist today (main + context-reduction retry + rate-limit backoff + ainvoke-fallback error branch + degraded-probe + synthesis). Changing the transport today would require 6 identical edits.
- The helper returns an async generator that yields typed events (`ChatResponseChunk` for tokens, a lightweight `ActivityEvent` dataclass for tool lifecycle) so callers can route them to the correct SSE channel.
- Helper is pure w.r.t. failure policy — it only handles the inner streaming loop. Retry/fallback logic stays in `_response_fn`.

**Alternatives considered**:
- *Decorator-based retry*: Harder to test; hides control flow.
- *Inline in each branch*: Preserves the duplication problem.

### Decision 4: Tool lifecycle events use NAT's existing `intermediate_data:` channel

**Choice**: When the helper yields an `ActivityEvent`, emit it through NAT's existing `intermediate_data:` SSE line (the same channel that today parses in `ui-cognitive/lib/nat-client.ts:292`).

**Rationale**:
- The frontend already consumes this channel and maps payloads via `toActivityEvent()`. Deduplication via `buildActivityDedupeKey` is already in place at both proxy and consumer.
- No new SSE event type to invent, no new frontend parser.
- NAT's NIM front-end supports intermediate_step emissions from async generator functions; we use the supported pathway.

**Alternatives considered**:
- *New `event: tool` type*: `extractToolEvent` already exists but only affects `activeToolChange`, not the timeline — routing tool events there would lose the activity-timeline integration.

### Decision 5: Frontend bypasses typewriter when streaming real tokens

**Choice**: In `use-typewriter.ts`, when `isStreaming === true` AND the incoming delta is short (e.g., ≤ 40 chars), append directly to `displayedContent` without queueing.

**Rationale**:
- The typewriter was designed to animate large blocks arriving at node-completion boundaries. With real token streaming, chunks are 1-5 characters and arrive at ~20-80ms intervals — the model IS the typewriter. Queueing adds 40ms per word of animation delay on top.
- Keep the queue path active for the drain phase (when `isStreaming` flips false and queue still has items) and for the non-streaming fallback (ainvoke synthesis yields one big chunk).

**Alternatives considered**:
- *Remove typewriter entirely*: Breaks the fallback/drain UX and regresses `message-stream-animations` spec.
- *Parameterize drain rate*: Adds config surface without solving the core issue.

## Risks / Trade-offs

- **[Risk] NIM streaming leaves `additional_kwargs["tool_calls"]` empty** → Mitigation: preserve the existing back-fill at `safe_tool_calling_agent.py:1042-1077`. Verified already handles `AIMessageChunk` accumulation.
- **[Risk] `astream_events(v2)` high event volume inflates SSE bandwidth** → Mitigation: filter to `on_chat_model_stream`, `on_tool_start`, `on_tool_end`, `on_chat_model_end`. Drop `on_chain_*` (per-node lifecycle — not useful to end users).
- **[Risk] Tool args streaming mid-call confuses the UI** → Mitigation: only emit `tool_start` after `on_tool_start` (args are complete by then — LangGraph fires `on_tool_start` after the LLM completes tool_call JSON, not during).
- **[Risk] Re-introducing the 10-16× duplicate tool bug** → Mitigation: `astream_events` does not drive dispatch. Add regression unit test: stream a canned 3-chunk response with one tool_call and assert the tool is dispatched exactly once.
- **[Trade-off] Agent node now holds the whole chunk list in memory until accumulation completes** → Acceptable: NIM max_tokens is 32768, which is a few hundred KB of chunks. Negligible vs. existing state memory.
- **[Trade-off] `astream_events(v2)` is a LangChain beta API** → LangGraph 1.0.10 is stable enough; if v2 is removed in a future LangChain version, the helper centralizes the migration to v3.

## Migration Plan

1. Create branch `feat/granular-streaming-events` from `main`.
2. Implement per `tasks.md` (TDD: RED → GREEN for each task).
3. Run full test suite (`uv run pytest -x`) and the manual smoke on all 3 modes (analyze, execute, chat) with a short prompt.
4. Merge to `main` only after verifying token streaming visible in browser DevTools SSE inspector.
5. **Rollback**: Revert the merge commit. No DB migrations, no config changes, no user data touched.

## Open Questions

- Should `on_chat_model_start` emit a lifecycle event (e.g., "thinking…" indicator)? Lean yes — cheap, matches the NAT/frontend existing `thinking_start` synthetic event. Decide in apply phase when we see the event payload shape.
- Do we surface `on_tool_error` as a distinct activity `status: failed`, or let the existing error-classification path handle it? Lean: surface it — frontend already renders `status: failed` entries.
