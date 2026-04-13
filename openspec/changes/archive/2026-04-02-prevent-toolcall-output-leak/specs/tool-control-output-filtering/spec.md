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
