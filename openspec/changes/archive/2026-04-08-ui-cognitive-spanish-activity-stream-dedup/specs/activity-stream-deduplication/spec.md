## ADDED Requirements

### Requirement: Live activity ingestion de-duplicates equivalent streaming events
The chat activity ingestion pipeline SHALL compute a deterministic identity for each incoming live activity event and SHALL append it to `activityLog` only if that identity has not been seen in the active response stream.

#### Scenario: Equivalent event arrives twice from different streaming paths
- **WHEN** two incoming live events represent the same tool/activity step and resolve to the same dedupe identity
- **THEN** only one entry is appended to `activityLog`
- **AND** aggregate counters in meta/summary UI reflect a single step

#### Scenario: Two legitimate repeated calls remain visible
- **WHEN** two events target the same tool name but have different identities (e.g., different timestamps or sequence ids)
- **THEN** both entries are appended and rendered

### Requirement: De-duplication state is scoped to one assistant response stream
The system SHALL reset the set of seen dedupe identities when a new assistant response stream starts.

#### Scenario: New user prompt starts fresh activity stream
- **WHEN** a new user message starts a new assistant response
- **THEN** previously seen dedupe identities are cleared
- **AND** events from the new stream are evaluated independently
