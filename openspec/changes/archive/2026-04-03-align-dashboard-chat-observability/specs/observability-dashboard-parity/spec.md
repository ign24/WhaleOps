## ADDED Requirements

### Requirement: Dashboard SHALL parse NAT traces with nested-first compatibility
The observability dashboard aggregation pipeline SHALL correctly parse runtime trace events from the active trace file when events use nested NAT payload fields (`payload.*`) and SHALL remain backward-compatible with flat aliases used by previous events.

#### Scenario: Nested trace event is counted as request activity
- **WHEN** a trace line contains `payload.event_type`, `payload.event_timestamp`, and `payload.metadata.provided_metadata.workflow_run_id`
- **THEN** the event is associated to the corresponding request/run bucket
- **AND** request volume metrics include that run

#### Scenario: Mixed nested and flat events in the same file
- **WHEN** the trace file contains both nested-format and flat-format events
- **THEN** aggregation processes both formats in a single pass
- **AND** the dashboard returns non-zero metrics when valid events exist

### Requirement: Dashboard SHALL expose parser diagnostics for schema drift
The summary response SHALL include diagnostics that explain parsing health, including processed lines, skipped lines, events missing run identifiers, and whether nested or flat field paths were observed.

#### Scenario: Trace file readable but events are skipped
- **WHEN** the parser cannot extract required identifiers from some lines
- **THEN** the summary payload includes non-zero skipped counters
- **AND** UI can present an explicit warning instead of silently reporting zero requests

### Requirement: Dashboard metrics SHALL be comparable with chat activity for the same runs
The system SHALL provide stable correlation identifiers and normalized tool event attributes so dashboard metrics can be compared against chat activity entries for the same `conversation_id` and `workflow_run_id` window.

#### Scenario: Recent chat run has tool activity
- **WHEN** chat activity shows tool events for a workflow run in the selected window
- **THEN** dashboard tool usage for that run window reflects corresponding tool activity
- **AND** any mismatch beyond the allowed lag window is surfaced as a parity warning
