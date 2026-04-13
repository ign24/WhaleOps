## ADDED Requirements

### Requirement: Capture real token counts from LLM responses
The system SHALL extract `prompt_tokens`, `completion_tokens`, and `total_tokens` from `AIMessage.response_metadata.usage_metadata` after each agent_node execution and accumulate them per session.

#### Scenario: LLM returns usage metadata
- **WHEN** the LLM response includes `usage_metadata` with `input_tokens` and `output_tokens`
- **THEN** the system accumulates those values into session-level totals
- **AND** the final `Usage` object in the response chunk uses the accumulated real values instead of word-count estimates

#### Scenario: LLM response lacks usage metadata (streaming)
- **WHEN** the LLM response does not include `usage_metadata` (common in streaming path)
- **THEN** the system falls back to word-count estimation for that turn
- **AND** a debug-level log message indicates the fallback

#### Scenario: Mixed streaming and non-streaming turns
- **WHEN** some turns include real usage metadata and some do not
- **THEN** the session total is the sum of real values from turns that had metadata plus estimates from turns that did not

### Requirement: Emit session token usage to traces
The system SHALL emit a structured `session_token_usage` event to the JSONL trace at session end containing model name, accumulated prompt tokens, completion tokens, total tokens, and mode.

#### Scenario: Session completes normally
- **WHEN** a session reaches the final yield (finish_reason="stop")
- **THEN** a `session_token_usage` event is written to the trace file with `{event_type: "session_token_usage", model: "<model_name>", mode: "<mode>", prompt_tokens: N, completion_tokens: N, total_tokens: N}`

### Requirement: Structured context overflow events
The system SHALL emit a structured `context_overflow` event to the JSONL trace when a context-exceeded error or `GraphRecursionError` occurs, including the session mode, model, and error details.

#### Scenario: BadRequestError for context length
- **WHEN** the LLM API returns a `BadRequestError` containing "context length" in the message
- **THEN** a `context_overflow` event is written to the trace with `{event_type: "context_overflow", reason: "context_length_exceeded", model: "<model>", mode: "<mode>", error: "<message>"}`

#### Scenario: GraphRecursionError
- **WHEN** the graph execution raises `GraphRecursionError`
- **THEN** a `context_overflow` event is written to the trace with `{event_type: "context_overflow", reason: "recursion_limit", model: "<model>", mode: "<mode>", max_iterations: N}`
