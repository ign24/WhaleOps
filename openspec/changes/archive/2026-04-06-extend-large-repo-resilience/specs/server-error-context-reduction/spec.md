## ADDED Requirements

### Requirement: SERVER_ERROR after truncated output SHALL trigger context-reduction retry
When a `SERVER_ERROR` (HTTP 500 / EngineCore crash) occurs and the most recent ToolMessage in state was already truncated (content ends with the `[OUTPUT TRUNCATED:` marker), the agent SHALL halve the truncated content and retry the LLM call once before falling through to the normal backoff loop.

#### Scenario: Context-reduction retry on SERVER_ERROR with truncated tool output
- **WHEN** a `SERVER_ERROR` occurs during `run_and_stream`
- **AND** the most recent ToolMessage in state has content ending with `[OUTPUT TRUNCATED:`
- **THEN** the agent SHALL halve the content of that ToolMessage
- **THEN** the agent SHALL retry the LLM call once (no backoff delay)
- **THEN** if the retry succeeds, the agent SHALL continue the loop normally

#### Scenario: Context-reduction retry failure escalates to normal backoff
- **WHEN** the context-reduction retry also fails with SERVER_ERROR
- **THEN** the agent SHALL fall through to the existing exponential backoff retry loop
- **THEN** the halved content SHALL remain in state for subsequent retries

#### Scenario: SERVER_ERROR without truncated output uses normal backoff
- **WHEN** a `SERVER_ERROR` occurs and the most recent ToolMessage does NOT have the truncation marker
- **THEN** the agent SHALL proceed directly to the existing exponential backoff retry loop
- **THEN** no context-reduction is attempted

#### Scenario: Context-reduction retry emits trace event
- **WHEN** the context-reduction retry is triggered
- **THEN** a `server_error_context_reduction` trace event SHALL be emitted with `original_chars`, `reduced_chars`, and `tool_name` fields

### Requirement: Truncation marker string SHALL be stable and co-located
The string `[OUTPUT TRUNCATED:` used as the detection marker for truncated tool output SHALL be defined as a constant in the same module as `_guard_tool_outputs`, ensuring the detection logic and the marker source are always in sync.

#### Scenario: Truncation marker detection is reliable
- **WHEN** `_guard_tool_outputs` truncates a ToolMessage
- **THEN** the appended marker SHALL use the same constant string checked by the context-reduction retry logic
- **THEN** no external dependency on the marker format is required
