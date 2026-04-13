## MODIFIED Requirements

### Requirement: Equivalent tool-call loops SHALL be detected
The workflow SHALL detect repeated equivalent tool calls within a single request budget window and prevent unbounded repetition.

Equivalent tool calls are calls with the same tool name and materially similar normalized arguments.

Loop-guard interventions SHALL be non-terminating: blocked repeated calls SHALL be denied while preserving loop progress for remaining calls or immediate model replanning.

#### Scenario: Repeated equivalent calls trigger loop guard
- **WHEN** the workflow attempts an equivalent tool call beyond the configured threshold
- **THEN** the loop guard SHALL block the repeated call
- **AND** SHALL preserve loop continuity by allowing remaining valid calls or returning control for scoped replan

#### Scenario: Non-equivalent calls are allowed
- **WHEN** calls share a tool name but have materially different normalized arguments
- **THEN** the loop guard SHALL allow execution under normal budget constraints

## ADDED Requirements

### Requirement: Loop-guard denial SHALL include explicit replan guidance
When loop guard blocks a repeated call, the denial payload SHALL include actionable guidance to narrow scope or alter arguments.

#### Scenario: Blocked call includes actionable guidance
- **WHEN** a call is blocked by loop guard
- **THEN** the denial output SHALL include replan guidance
- **AND** SHALL avoid generic terminal-failure language
