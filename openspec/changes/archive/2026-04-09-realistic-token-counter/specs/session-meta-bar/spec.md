## MODIFIED Requirements

### Requirement: Session meta bar displays session context
The chat panel SHALL display a `SessionMetaBar` component at the top showing: tool count, aggregate duration, active status, and a toggle button for the activity panel. When session-level token usage is available, the bar SHALL also display token totals with explicit precision (`real` or `estimado`).

#### Scenario: During active streaming with tools
- **WHEN** the agent is streaming and tool entries exist in the activity log
- **THEN** the meta bar shows tool count, running duration, and "active" indicator

#### Scenario: After streaming completes
- **WHEN** streaming has finished
- **THEN** the meta bar shows final tool count and total duration

#### Scenario: No activity
- **WHEN** no messages have been sent or no activity entries exist
- **THEN** the meta bar shows only the gateway status and panel toggle

#### Scenario: Token usage available for current session
- **WHEN** token usage has been computed for the active session
- **THEN** the meta bar includes token totals and indicates whether the value is real or estimated
