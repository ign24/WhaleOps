## ADDED Requirements

### Requirement: Failed assistant responses SHALL expose a retry action
The chat UI SHALL render a retry action for assistant messages flagged as error responses.

#### Scenario: Error response shows retry action
- **WHEN** the latest assistant message is marked as error
- **THEN** the UI SHALL show a `Reintentar` action
- **AND** invoking it SHALL resend the latest user message content

#### Scenario: Retry action disabled while sending
- **WHEN** a request is already in progress
- **THEN** the retry action SHALL be disabled

### Requirement: Gateway inactive state SHALL expose connection retry
The gateway status UI SHALL provide a manual connection retry action when status is inactive.

#### Scenario: Inactive gateway shows retry connection button
- **WHEN** gateway health is `error`
- **THEN** the status component SHALL render `Reintentar conexión`
- **AND** clicking it SHALL trigger immediate health check

#### Scenario: Gateway status auto-refreshes
- **WHEN** the chat panel is mounted
- **THEN** gateway health SHALL be rechecked periodically
- **AND** polling SHALL stop when component unmounts
