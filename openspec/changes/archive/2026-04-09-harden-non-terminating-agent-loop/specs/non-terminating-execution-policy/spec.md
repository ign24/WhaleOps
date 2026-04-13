## ADDED Requirements

### Requirement: Guardrail denials SHALL be non-terminating
Runtime guardrails that deny tool execution (loop guard, per-turn parallel cap, per-request tool limits, spawn budget limits) SHALL block only the offending call(s), append an explanatory tool result, and continue the request loop.

#### Scenario: Guardrail denial keeps execution alive
- **WHEN** one or more tool calls are denied by deterministic guardrails in a turn
- **THEN** denied calls SHALL be converted into non-fatal tool feedback entries
- **AND** the workflow SHALL continue with remaining allowed calls or return control to the model for replanning

### Requirement: Guardrail denials SHALL NOT escalate to terminal request failure
Guardrail-triggered denials SHALL NOT be surfaced as terminal processing errors when normal loop continuation remains possible.

#### Scenario: Budget exhaustion returns controlled continuation
- **WHEN** a request exhausts its configured tool budget before all subtasks complete
- **THEN** the system SHALL avoid terminal failure status for the request
- **AND** SHALL proceed to synthesis using completed evidence plus explicit pending scope

### Requirement: Continuation semantics SHALL be deterministic
When a turn contains both allowed and denied tool calls, allowed calls SHALL execute first-class and denied calls SHALL not prevent their execution.

#### Scenario: Mixed call batch executes allowed subset
- **WHEN** a tool-call batch includes valid calls and calls denied by limits
- **THEN** valid calls SHALL still execute in the same loop iteration
- **AND** denied calls SHALL be reported as blocked without aborting the batch
