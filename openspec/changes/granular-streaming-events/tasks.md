## 1. Branch setup

- [x] 1.1 Create branch `feat/granular-streaming-events` from current `main`
- [x] 1.2 Verify full test suite green on branch baseline (`uv run pytest -x`)

## 2. Backend — agent_node streaming (TDD)

- [x] 2.1 RED: Write unit test `test_agent_node_uses_astream_and_accumulates_chunks` — canned LLM stubbed to yield 3 `AIMessageChunk`s; assert final `state.messages[-1].content` equals concatenation; use a custom callback to assert `on_chat_model_stream` fires ≥ 3 times
- [x] 2.2 RED: Write unit test `test_agent_node_preserves_tool_calls_after_streaming` — stub streams chunks with tool_calls on the last chunk; assert accumulated `AIMessage` carries `tool_calls` and `additional_kwargs["tool_calls"]` is populated
- [x] 2.3 GREEN: Replace `self.agent.ainvoke(...)` at safe_tool_calling_agent.py:1530 with accumulation loop over `self.agent.astream(...)`; re-apply existing `_normalize_tool_call_ids(state)` post-accumulation
- [x] 2.4 GREEN: Update the repair-retry path (line 1552) with the same pattern
- [x] 2.5 REFACTOR: Verify `strip_think_blocks` sanitization still runs on accumulated content; fix if regressed

## 3. Backend — `_stream_graph_events` helper (TDD)

- [x] 3.1 RED: Write unit test `test_stream_graph_events_yields_token_chunks` — patch `graph.astream_events` to yield canned `on_chat_model_stream` events; assert helper yields matching `ChatResponseChunk` objects via `create_streaming_chunk`
- [x] 3.2 RED: Write unit test `test_stream_graph_events_filters_non_token_events` — yield mixed events (on_chain_*, on_tool_*, on_chat_model_end); assert only token chunks surface for content events and activity payloads for tool events
- [x] 3.3 RED: Write unit test `test_stream_graph_events_emits_activity_on_tool_start` — yield `on_tool_start` event; assert helper emits an intermediate activity payload with `type="tool_start"`, `name`, `tool_args`
- [x] 3.4 RED: Write unit test `test_stream_graph_events_emits_activity_on_tool_end` — yield `on_tool_end` event; assert payload with `type="tool_end"`, `tool_result` (truncated per existing per-tool limits)
- [x] 3.5 RED: Write regression test `test_no_duplicate_tool_dispatch_under_streaming` — stub a canned stream with one tool_call spread across 3 chunks; assert the tool is dispatched exactly once (guard against the prior 10-16× duplicate bug)
- [x] 3.6 RED: Write unit test `test_stream_graph_events_propagates_exceptions` — make `astream_events` raise `ConnectionError`; assert exception propagates so `_classify_failure` runs in caller
- [x] 3.7 GREEN: Implement `async def _stream_graph_events(graph, state, config, content_so_far, chunk_id, created, model_name, mode)` yielding a tagged union of `ChatResponseChunk` and intermediate activity payloads

## 4. Backend — integrate helper into `_response_fn`

- [x] 4.1 GREEN: Replace main streaming loop with helper call
- [x] 4.2 GREEN: Replace context-reduction retry loop with helper call
- [x] 4.3 GREEN: Replace rate-limit backoff loops with helper calls
- [x] 4.4 GREEN: Replace the 4th duplicated block (deep-nested backoff inside context-reduction fallback) with helper call. Note: only 4 blocks existed total, not 6 as originally estimated
- [x] 4.5 GREEN: Delete `_extract_message_token` — now unreferenced
- [x] 4.6 GREEN: Delete `_extract_token_from_update` — now unreferenced
- [x] 4.7 REFACTOR: Verify all existing `_emit_trace_event` calls around retry branches remain intact (29 preserved)

## 5. Backend — wire tool lifecycle to intermediate_data

- [x] 5.1 RED: Write integration test `test_tool_lifecycle_emitted_in_sse_stream` — boot the full agent with a stub tool, send a prompt that forces one tool_call, capture the SSE stream, assert both `intermediate_data:` lines with `tool_start` and `tool_end` appear in order
- [x] 5.2 GREEN: In `_response_fn`, when `_stream_graph_events` yields an activity payload, emit it through NAT's intermediate-step emission (async generator yield pattern supported by NAT 1.4.1)
- [x] 5.3 GREEN: Apply per-tool output truncation to `tool_result` using existing `rt.per_tool_max_chars` context

## 6. Frontend — typewriter bypass (TDD)

- [x] 6.1 RED: Write Vitest unit test `useTypewriter bypasses queue for small deltas during active streaming` in `ui-cognitive/hooks/__tests__/use-typewriter.test.ts` — simulate `isStreaming=true` with a 5-char delta; assert `displayedContent` updates on next render without queueing
- [x] 6.2 RED: Write test `useTypewriter uses queue for large deltas` — simulate a 800-char delta; assert queue drain behavior unchanged
- [x] 6.3 RED: Write test `useTypewriter drains queue after streaming ends` — flip `isStreaming` to false with items queued; assert drain continues at fast-drain rate
- [x] 6.4 GREEN: Modify `use-typewriter.ts` to branch on `isStreaming && delta.length <= 40` → direct append to `displayedContent`; else existing queue path
- [x] 6.5 GREEN: Verify `isVisualStreaming` remains `true` until the queue is empty in either path

## 7. Frontend — finer-grained activity events

- [x] 7.1 RED: Write Vitest test `chat-panel renders tool_start and tool_end entries from SSE stream` with mocked SSE that emits both events; assert activity timeline shows 2 entries in correct states
- [x] 7.2 GREEN: Verify no changes needed in `sse-parser.ts` / `nat-client.ts` (existing `toActivityEvent` already covers these shapes); add test coverage confirming this
- [x] 7.3 GREEN: If the test exposes a gap, add field mappings to `toActivityEvent` for any new payload keys

## 8. Integration smoke

- [x] 8.1 Run `uv run pytest -x` — all unit + integration tests green
- [x] 8.2 Run `cd ui-cognitive && bun run lint && bun run build` — frontend build green (pre-existing trend-area-chart.tsx error unrelated to streaming changes; lint 0 errors, 13 warnings pre-existing)
- [ ] 8.3 Start the agent locally and test `/chat/stream` with curl — assert multiple `data:` SSE lines arrive within the first 2 seconds of a long prompt (visual confirmation of token streaming)
- [ ] 8.4 Test `analyze`, `execute`, and `chat` modes in the browser; confirm tokens flow in real time and activity timeline updates mid-response

## 9. Archive

- [ ] 9.1 Commit each logical group as a separate commit (conventional commits: `feat:`, `refactor:`, `test:`)
- [ ] 9.2 Open PR with link to this change directory
- [ ] 9.3 After merge, run `/opsx:archive granular-streaming-events`
