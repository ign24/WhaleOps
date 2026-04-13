## ADDED Requirements

### Requirement: Activity panel renders timeline of agent activity
The system SHALL display a vertical timeline of `ActivityEntry[]` items in a dedicated side panel. Each entry SHALL show: status icon (colored by status), humanized label, timestamp, and duration. Entries SHALL be ordered chronologically by `startedAt`.

#### Scenario: Live streaming with tool calls
- **WHEN** the agent is streaming and `intermediate_data` events arrive
- **THEN** new entries appear at the bottom of the timeline with animated insertion
- **AND** the timeline auto-scrolls to the latest entry

#### Scenario: Empty activity log
- **WHEN** no activity entries exist (new session or no tools called)
- **THEN** the panel displays a placeholder message indicating no activity yet

### Requirement: Timeline entries are expandable
Each `TimelineEntry` SHALL be collapsed by default showing only the status icon, label, and duration. When expanded, it SHALL show additional detail based on `kind`.

#### Scenario: Expanding a tool entry
- **WHEN** user clicks a tool-kind timeline entry
- **THEN** the entry expands to show `toolArgs` as formatted JSON and `toolResult` as rendered markdown

#### Scenario: Expanding an agent entry
- **WHEN** user clicks an agent-kind timeline entry
- **THEN** the entry expands to show the `detail` field as rendered markdown

#### Scenario: Entry with missing optional fields
- **WHEN** a timeline entry has no `toolArgs`, `toolResult`, or `detail`
- **THEN** the entry SHALL still render with status icon, label, and duration but show no expandable section

### Requirement: Session info header
The activity panel SHALL display a `SessionInfo` header showing: the model name (from the first `ActivityEntry` with a non-null `model` field), the count of tool-kind entries, and the total duration across all entries.

#### Scenario: Model name available
- **WHEN** at least one activity entry has a `model` field
- **THEN** `SessionInfo` displays the model name

#### Scenario: No model information
- **WHEN** no activity entries have a `model` field
- **THEN** `SessionInfo` omits the model display

### Requirement: Session summary footer
The activity panel SHALL display a `SessionSummary` footer showing: total entry count, completed count, failed count, and aggregate duration.

#### Scenario: Session with mixed statuses
- **WHEN** the activity log contains entries with completed, failed, and running statuses
- **THEN** the summary shows counts for each status category and total duration of completed entries

### Requirement: Historical activity viewing
The activity panel SHALL support viewing `intermediateSteps` from past messages. When a user activates a historical message's inline summary, the panel SHALL switch to display that message's stored activity entries.

#### Scenario: User clicks inline summary on a past message
- **WHEN** user clicks the inline activity summary on a non-current assistant message
- **THEN** the activity panel displays that message's `intermediateSteps` as timeline entries
- **AND** a "back to live" indicator is visible

#### Scenario: Returning to live mode
- **WHEN** user clicks "back to live" or a new streaming session begins
- **THEN** the panel returns to displaying the current `activityLog`

### Requirement: Panel close button
The activity panel SHALL have a close button that collapses the panel.

#### Scenario: User closes the panel
- **WHEN** user clicks the close button on the activity panel
- **THEN** the panel collapses and the chat panel expands to fill the available width
