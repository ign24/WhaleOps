## ADDED Requirements

### Requirement: Workspace API exposure MUST be explicit
The system SHALL make `workspace_api` exposure explicit via startup registration policy and configuration flag, rather than implicit module presence.

#### Scenario: Workspace API disabled by policy
- **WHEN** workspace API flag is disabled
- **THEN** workspace routes are not mounted and startup logs include explicit disabled reason

#### Scenario: Workspace API enabled by policy
- **WHEN** workspace API flag is enabled
- **THEN** workspace routes are mounted exactly once and route registration is observable in startup logs

### Requirement: Workspace API deprecation MUST be announced before removal
If workspace API is targeted for removal, the system SHALL emit deprecation warnings and maintain a compatibility observation window before endpoint removal.

#### Scenario: Deprecation warning emitted on endpoint use
- **WHEN** a request hits a deprecated workspace endpoint during observation window
- **THEN** response includes deprecation metadata and usage telemetry increments

### Requirement: Workspace API path MUST preserve external safety
The system SHALL not remove or alter workspace API behavior in ways that break potential external consumers until observation confirms no active dependence or a migration path exists.

#### Scenario: External usage prevents hard removal
- **WHEN** telemetry detects active external usage in observation window
- **THEN** workspace API remains available and removal is postponed with migration guidance
