## ADDED Requirements

### Requirement: Recoverable nested failures SHALL use bounded escalation
For nested subagent failures classified as recoverable (`RECURSION_LIMIT`, `TOOL_TIMEOUT`), the orchestrator SHALL perform at most one scoped escalation pass before finalization.

#### Scenario: Single escalation pass for nested recursion
- **WHEN** a delegated subagent fails with `RECURSION_LIMIT`
- **THEN** the orchestrator SHALL run one scoped replan/retry for that delegated objective
- **AND** SHALL NOT run a second escalation for the same delegated objective in the same request

#### Scenario: Exhausted nested escalation finalizes with structured partial output
- **WHEN** the single escalation pass fails to recover the delegated objective
- **THEN** the assistant SHALL return structured partial output with verified and unverified scopes
- **AND** SHALL include explicit blocked reason tied to the subagent failure source
