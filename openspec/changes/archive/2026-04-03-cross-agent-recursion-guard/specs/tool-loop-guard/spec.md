## MODIFIED Requirements

### Requirement: Equivalent tool-call loops SHALL be detected
The workflow SHALL detect repeated equivalent tool calls within a single request budget window and prevent unbounded repetition.

Equivalent tool calls are calls with the same tool name and materially similar normalized arguments.

For delegated subagent calls, loop equivalence SHALL include delegation identity (`subagent_name`) in the normalization key.

#### Scenario: Repeated equivalent calls trigger loop guard
- **WHEN** the workflow attempts an equivalent tool call beyond the configured threshold
- **THEN** the loop guard SHALL block the repeated call
- **AND** force either scoped replan or structured partial finalization

#### Scenario: Non-equivalent calls are allowed
- **WHEN** calls share a tool name but have materially different normalized arguments
- **THEN** the loop guard SHALL allow execution under normal budget constraints

#### Scenario: Equivalent delegated calls trigger subagent-aware loop guard
- **WHEN** delegated calls target the same `subagent_name` with materially similar normalized arguments beyond threshold
- **THEN** the loop guard SHALL block the repeated delegated call
- **AND** SHALL trigger deterministic subagent recovery escalation

### Requirement: Loop guard decisions SHALL be observable
Every loop-guard activation SHALL emit a trace event containing tool name, threshold, normalized-key hash, and selected fallback action.

#### Scenario: Loop-guard event is emitted
- **WHEN** a call is blocked by loop guard
- **THEN** a trace event SHALL be emitted with loop-guard metadata and mode context

#### Scenario: Delegated loop-guard event includes subagent metadata
- **WHEN** a delegated call is blocked by loop guard
- **THEN** trace metadata SHALL include `failure_source=subagent` and `subagent_name`
