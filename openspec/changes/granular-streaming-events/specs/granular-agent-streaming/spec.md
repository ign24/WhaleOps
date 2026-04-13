## ADDED Requirements

### Requirement: Token-level LLM streaming via astream_events

The agent streaming path SHALL use `graph.astream_events(state, config=cfg, version="v2")` as the top-level event source, and SHALL emit one `ChatResponseChunk` per `on_chat_model_stream` event containing the chunk's `content` as the token payload.

#### Scenario: Each LLM token yields one chunk

- **WHEN** the LLM generates a response of N chunks (observed via `on_chat_model_stream`)
- **THEN** `_response_fn` SHALL yield exactly N `ChatResponseChunk` objects in order, each carrying the content of its source `AIMessageChunk`

#### Scenario: No chunk yielded for empty content

- **WHEN** an `on_chat_model_stream` event arrives with empty or None `content`
- **THEN** no `ChatResponseChunk` SHALL be yielded for that event

#### Scenario: on_chain and on_tool events do not produce token chunks

- **WHEN** events of type `on_chain_start`, `on_chain_end`, `on_tool_start`, or `on_tool_end` arrive
- **THEN** they SHALL NOT be emitted as `ChatResponseChunk` token events

### Requirement: agent_node uses streaming LLM call

`SafeToolCallAgentGraph.agent_node` SHALL call `self.agent.astream({"messages": state.messages}, config=merged_config)` and accumulate the returned `AIMessageChunk`s into a single final `AIMessage` before appending to `state.messages`.

#### Scenario: Accumulated message matches non-streaming equivalent

- **WHEN** the LLM streams 5 chunks each with content `"a", "b", "c", "d", "e"`
- **THEN** the final message appended to `state.messages` SHALL have `content == "abcde"`

#### Scenario: Tool calls are preserved after accumulation

- **WHEN** the final streamed chunk contains `tool_calls`
- **THEN** the accumulated `AIMessage` appended to state SHALL contain the same `tool_calls` list
- **AND** `additional_kwargs["tool_calls"]` SHALL be populated by the existing `_normalize_tool_call_ids` back-fill

#### Scenario: Streaming failure falls through to existing error classification

- **WHEN** `self.agent.astream` raises an exception mid-stream
- **THEN** the exception SHALL propagate to the existing `_classify_failure` path in `agent_node` without modification

### Requirement: Tool lifecycle events emitted via intermediate_data channel

When `astream_events` yields `on_tool_start` or `on_tool_end`, the agent SHALL emit a corresponding activity payload through NAT's `intermediate_data:` SSE channel so the frontend's existing `nat-client.ts` parser can consume it without modification.

#### Scenario: tool_start emits activity when a tool begins

- **WHEN** an `on_tool_start` event is observed with `name="fs_tools_read_file"` and `data.input` containing the call arguments
- **THEN** an activity payload SHALL be emitted with `type: "tool_start"`, `name: "fs_tools_read_file"`, and `tool_args` set to the input

#### Scenario: tool_end emits activity when a tool completes

- **WHEN** an `on_tool_end` event is observed with `name="fs_tools_read_file"` and `data.output` containing the result
- **THEN** an activity payload SHALL be emitted with `type: "tool_end"`, `name: "fs_tools_read_file"`, and `tool_result` set to the output (truncated per existing per-tool limits)

#### Scenario: Tool dispatch is not driven by astream_events

- **WHEN** the LLM emits a single tool_call in a streamed response
- **THEN** the tool SHALL be dispatched exactly once (regression test for the prior 10-16× duplicate bug)

### Requirement: Single helper encapsulates streaming loops

All 6 current streaming loops in `_response_fn` (main path, context-reduction retry, rate-limit backoff, and the recovery branches at lines 2484, 2518, 2597, 2672, 2831, 2873) SHALL delegate to a single async-generator helper `_stream_graph_events(graph, state, config, content_so_far, chunk_id, created, model_name, mode)`.

#### Scenario: Helper yields the same chunk shape as current code

- **WHEN** the helper is invoked for a successful stream
- **THEN** each yielded token event SHALL be a `ChatResponseChunk` built via `ChatResponseChunk.create_streaming_chunk(content=..., id_=chunk_id, created=created, model=model_name, role=ASSISTANT)`

#### Scenario: Failure semantics preserved

- **WHEN** the helper raises an exception
- **THEN** the caller SHALL receive the original exception so the existing `_classify_failure` + `FAILURE_POLICIES` logic in `_response_fn` continues to apply unchanged

#### Scenario: Deprecated _extract_message_token removed

- **WHEN** the refactor is complete
- **THEN** `_extract_message_token` (currently at safe_tool_calling_agent.py:1153) SHALL be removed from the codebase
- **AND** no remaining callers reference it

### Requirement: All three modes stream uniformly

The streaming transport SHALL be identical for `analyze`, `execute`, and `chat` modes. Mode-specific differences (tool set, max_iterations, max_history, HITL support) SHALL NOT introduce mode-specific streaming branches.

#### Scenario: Each mode produces token-level chunks

- **WHEN** a user sends a prompt in `analyze` mode
- **THEN** the response SHALL arrive as multiple `ChatResponseChunk`s (>1 chunk for any response longer than a single token)

- **WHEN** a user sends a prompt in `execute` mode
- **THEN** the response SHALL arrive as multiple `ChatResponseChunk`s

- **WHEN** a user sends a prompt in `chat` mode
- **THEN** the response SHALL arrive as multiple `ChatResponseChunk`s

## MODIFIED Requirements

<!-- No existing capability requirements are being modified under this capability -->
