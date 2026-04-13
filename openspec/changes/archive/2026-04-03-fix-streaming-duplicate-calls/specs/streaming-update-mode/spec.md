## ADDED Requirements

### Requirement: Graph streaming uses updates mode
The agent graph SHALL be streamed using `stream_mode="updates"` so that each event represents a completed node output rather than a propagated message, preventing duplicate tool invocations caused by re-emitted AIMessage objects.

#### Scenario: Single tool invocation per LLM turn
- **WHEN** the LLM produces an AIMessage with one or more tool_calls
- **THEN** each referenced tool node is invoked exactly once per LLM turn, regardless of how many streaming events the graph emits

#### Scenario: Correct event shape consumption
- **WHEN** `astream(stream_mode="updates")` emits an event
- **THEN** the event is a dict with node names as keys and `ToolCallAgentGraphState`-compatible values, and the streaming handler SHALL extract content only from the `"agent"` node output

#### Scenario: Version kwarg removed
- **WHEN** `astream()` is called
- **THEN** no `version` keyword argument is passed, as it has no effect on LangGraph 1.0.10 and is misleading

### Requirement: Token extraction from update events
A helper function `_extract_token_from_update` SHALL extract text tokens from `stream_mode="updates"` events for delivery to the SSE frontend stream.

#### Scenario: Token extracted from agent node
- **WHEN** an update event contains an `"agent"` key whose last message is an `AIMessageChunk` with non-empty string content
- **THEN** the helper returns only the new content not yet emitted (delta relative to previously accumulated content)

#### Scenario: Non-agent node events ignored
- **WHEN** an update event does not contain an `"agent"` key (e.g., tool node output)
- **THEN** the helper returns `None` and no token is emitted to the frontend

#### Scenario: Empty or non-string content ignored
- **WHEN** an update event's `"agent"` last message has empty content or non-string content (e.g., list of tool_use blocks)
- **THEN** the helper returns `None`

#### Scenario: Warning on unrecognized event structure
- **WHEN** an update event is a dict with no recognized node key
- **THEN** the handler logs a debug-level warning and continues without raising

### Requirement: Frontend SSE contract unchanged
The streaming response to the frontend SHALL remain structurally identical: tokens are delivered as `ChatResponseChunk` objects with the same fields as before the fix.

#### Scenario: Chunk structure preserved
- **WHEN** a text token is extracted from an update event
- **THEN** `ChatResponseChunk.create_streaming_chunk()` is called with the same arguments (content, id_, created, model, role) as in the pre-fix implementation

#### Scenario: Fallback path unaffected
- **WHEN** the `astream` loop raises an exception
- **THEN** the `ainvoke` fallback path is invoked as before, with no changes to its behavior

### Requirement: Duplicate tool call regression test
A unit test SHALL verify that tool nodes are not invoked more than once per LLM turn when the graph emits multiple streaming events containing the same AIMessage.

#### Scenario: Mock graph emits repeated agent updates
- **WHEN** a mock graph is configured to emit 3 identical update events each containing an AIMessage with one tool_call
- **THEN** the test asserts the tool mock was called exactly once

#### Scenario: Token accumulation correctness
- **WHEN** a mock graph emits 3 sequential update events where the `"agent"` node message content grows incrementally ("He", "Hello", "Hello world")
- **THEN** the SSE stream receives exactly 3 chunks: "He", "llo", " world"
