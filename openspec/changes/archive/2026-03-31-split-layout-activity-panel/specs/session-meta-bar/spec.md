## ADDED Requirements

### Requirement: Session meta bar displays session context
The chat panel SHALL display a `SessionMetaBar` component at the top showing: tool count, aggregate duration, active status, and a toggle button for the activity panel.

#### Scenario: During active streaming with tools
- **WHEN** the agent is streaming and tool entries exist in the activity log
- **THEN** the meta bar shows tool count, running duration, and "active" indicator

#### Scenario: After streaming completes
- **WHEN** streaming has finished
- **THEN** the meta bar shows final tool count and total duration

#### Scenario: No activity
- **WHEN** no messages have been sent or no activity entries exist
- **THEN** the meta bar shows only the gateway status and panel toggle

### Requirement: Model name display
The meta bar SHALL display the model name when available from activity entries.

#### Scenario: Model name present in activity log
- **WHEN** at least one activity entry has a non-null `model` field
- **THEN** the meta bar displays the model name (truncated if needed)

### Requirement: Activity panel toggle
The meta bar SHALL contain a button to open/close the activity panel.

#### Scenario: Panel is closed
- **WHEN** user clicks the toggle button while the panel is closed
- **THEN** the activity panel opens

#### Scenario: Panel is open
- **WHEN** user clicks the toggle button while the panel is open
- **THEN** the activity panel closes

### Requirement: Inline activity summary replaces ActivityTracker
Assistant message bubbles SHALL display a compact one-line summary instead of the full `ActivityTracker` accordion. The summary SHALL show tool count and total duration.

#### Scenario: Message with activity entries
- **WHEN** an assistant message has `intermediateSteps` or live `activityLog` entries
- **THEN** a one-line summary like "3 tools · 7.6s" is displayed inside the bubble

#### Scenario: User clicks inline summary
- **WHEN** user clicks the inline activity summary on any assistant message
- **THEN** the activity panel opens (if closed) showing that message's activity entries
