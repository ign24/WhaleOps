## ADDED Requirements

### Requirement: Streaming status bar SHALL be visible for each active agent during visual writing
The system SHALL render a visible luminous status indicator for every agent entry in active state (`running` or `pending`) while `visualStreamingActive` is true for the live assistant message.

#### Scenario: Multiple active agents during live render
- **WHEN** two or more agent entries are active while the assistant message is still visually rendering
- **THEN** each active agent SHALL display its own luminous status indicator

#### Scenario: Active agent indicator turns off after visual completion
- **WHEN** `visualStreamingActive` becomes false and no agent entry remains active
- **THEN** luminous indicators SHALL be removed for all agents

### Requirement: Status indicator visibility SHALL be derived from activity state, not hardcoded labels
The system SHALL determine indicator visibility from normalized activity status and role metadata, without hardcoded checks for specific agent names or tool labels.

#### Scenario: Agent naming changes without logic changes
- **WHEN** a new agent label appears with status `running`
- **THEN** the indicator SHALL remain visible without adding agent-specific conditions in code

#### Scenario: Non-agent entries remain unaffected
- **WHEN** an entry is not an agent and does not meet active indicator rules
- **THEN** the component SHALL not render a false positive luminous indicator
