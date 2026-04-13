## ADDED Requirements

### Requirement: Nested subagent failures SHALL be normalized before synthesis
The orchestrator SHALL normalize nested subagent tool failures into deterministic failure classes before using the output for synthesis or next-step planning.

#### Scenario: Subagent recursion error is normalized
- **WHEN** a delegated subagent tool response contains `GraphRecursionError`
- **THEN** the orchestrator SHALL classify it as `RECURSION_LIMIT`
- **AND** SHALL mark `failure_source` as `subagent`

#### Scenario: Subagent timeout error is normalized
- **WHEN** a delegated subagent tool response indicates timeout budget exceeded
- **THEN** the orchestrator SHALL classify it as `TOOL_TIMEOUT`
- **AND** SHALL include `subagent_name` in telemetry metadata

### Requirement: Raw nested runtime payloads SHALL NOT be treated as successful evidence
The orchestrator SHALL NOT treat raw subagent runtime error text as confirmed analytical evidence.

#### Scenario: Recursion payload is excluded from evidence set
- **WHEN** a subagent returns raw recursion error text
- **THEN** the response pipeline SHALL exclude that payload from confirmed findings
- **AND** SHALL trigger fallback recovery policy for nested failure handling
