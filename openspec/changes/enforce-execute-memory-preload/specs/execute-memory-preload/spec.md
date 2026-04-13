## ADDED Requirements

### Requirement: Execute mode SHALL run deterministic memory preflight
Before invoking code-modifying tools in `execute` mode, the runtime SHALL perform a bounded preflight that attempts to load historical findings context.

#### Scenario: Preflight runs before first write-capable action
- **WHEN** a request is routed to `execute` mode and no preflight was run yet
- **THEN** the runtime runs a memory preflight step before the first write-capable tool call
- **AND** stores preflight result in structured execution state

#### Scenario: Preflight hit provides findings context
- **WHEN** the preflight query returns one or more findings
- **THEN** execution state records `status=hit` with summary metadata
- **AND** downstream execution can consume that context without re-querying first

#### Scenario: Preflight miss continues safely
- **WHEN** the preflight completes successfully with zero findings
- **THEN** execution state records `status=miss`
- **AND** the request continues without blocking

#### Scenario: Preflight degraded does not block execution
- **WHEN** the preflight fails due to timeout, circuit-open, or backend unavailability
- **THEN** execution state records `status=degraded` with reason
- **AND** execution continues in fail-open mode

### Requirement: Preflight observability SHALL be emitted
The runtime SHALL emit structured telemetry for the preflight outcome to support auditability.

#### Scenario: Telemetry includes outcome and reason
- **WHEN** preflight finishes in any state (`hit`, `miss`, `degraded`, `skipped`)
- **THEN** logs/traces include the mode, outcome, and reason details
- **AND** the event is queryable in existing observability outputs
