## MODIFIED Requirements

### Requirement: Activity panel renders timeline of agent activity
The system SHALL display a vertical timeline of `ActivityEntry[]` items in a dedicated side panel. Each entry SHALL show: status icon (colored by status), humanized label, timestamp, and duration. Entries SHALL be ordered chronologically by `startedAt`. For tool-related entries, the panel SHALL preserve and expose stable correlation and execution context fields when available, including workflow/run identifier, conversation identifier, tool name, sandbox/repo path, and command summary.

#### Scenario: Live streaming with tool calls
- **WHEN** the agent is streaming and `intermediate_data` events arrive
- **THEN** new entries appear at the bottom of the timeline with animated insertion
- **AND** the timeline auto-scrolls to the latest entry

#### Scenario: Empty activity log
- **WHEN** no activity entries exist (new session or no tools called)
- **THEN** the panel displays a placeholder message indicating no activity yet

#### Scenario: Tool event includes execution context
- **WHEN** a tool activity event includes fields for command or sandbox path in args/result payloads
- **THEN** the expanded timeline entry shows those fields in structured form
- **AND** the values remain associated to that entry for later parity comparison with dashboard traces
