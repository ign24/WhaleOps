## ADDED Requirements

### Requirement: Control-plane tool markers SHALL NOT be rendered as assistant prose
The chat UI SHALL prevent control-plane tool markers from appearing in visible assistant message content when the assistant response is committed after stream completion.

Control-plane markers include bracket-prefixed orchestration payloads such as `[TOOL_CALLS]...` and equivalent tool-control marker variants used for internal coordination.

#### Scenario: Tool-call marker appears in completed assistant content
- **WHEN** the completed assistant content contains a control marker like `[TOOL_CALLS]reader_agent{...}`
- **THEN** the committed assistant message SHALL NOT include the raw control marker payload
- **THEN** the committed assistant message SHALL contain the configured user-friendly fallback message

#### Scenario: Mixed content includes normal prose and tool marker payload
- **WHEN** the completed assistant content includes both user-facing prose and a control marker payload
- **THEN** the committed assistant message SHALL NOT expose the control marker payload
- **THEN** the UI SHALL apply the same leak-handling policy consistently (full replacement in this change)

#### Scenario: Tool and activity side-channel events remain functional
- **WHEN** tool-control markers are blocked from visible assistant prose
- **THEN** tool/activity events in their dedicated channels SHALL continue to be processed and displayed independently

## MODIFIED Requirements

### Requirement: tool-control-output-filtering — per-tool truncation trace events
The `tool_output_truncated` trace event emitted by `_guard_tool_outputs` MUST include a `limit_source` field that indicates whether the truncation was triggered by the global cap (`"global"`) or a per-tool limit (`"per_tool"`).

#### Scenario: Global cap truncation event
- **WHEN** a ToolMessage is truncated because its length exceeds the global `max_chars` limit
- **THEN** the `tool_output_truncated` event SHALL include `limit_source="global"`
- **THEN** the event SHALL include `tool_name`, `original_chars`, and `truncated_chars`

#### Scenario: Per-tool cap truncation event
- **WHEN** a ToolMessage is truncated because its length exceeds a per-tool limit from `per_tool_max_chars`
- **THEN** the `tool_output_truncated` event SHALL include `limit_source="per_tool"`
- **THEN** the event SHALL include `tool_name`, `original_chars`, and `truncated_chars`

### Requirement: tool-control-output-filtering — timeout payload shape
The `clone_repository` timeout response payload MUST include the `hint` field in addition to the existing fields (`status`, `message`, `repo_path`, `source_url`, `retryable`).

#### Scenario: Timeout payload structure
- **WHEN** `clone_repository` times out
- **THEN** response contains: `status=timeout`, `message`, `repo_path`, `source_url`, `retryable=true`, `hint`
