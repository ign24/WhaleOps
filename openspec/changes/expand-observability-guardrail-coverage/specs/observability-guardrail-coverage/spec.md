## ADDED Requirements

### Requirement: Observability summary SHALL expose guardrail/fallback coverage metrics
The observability aggregation layer SHALL expose machine-consumable metrics that explain non-terminating outcomes, including fallback classes, partial finalize rate, blocked-call counters, retry outcomes, and degraded-tool counts.

#### Scenario: Summary includes guardrail coverage block
- **WHEN** the dashboard summary endpoint is requested
- **THEN** the response SHALL include a guardrail coverage section with deterministic metric keys
- **AND** the section SHALL be present even when values are zero

### Requirement: Degraded-function incidents SHALL be classified separately
Events that indicate provider-level function degradation (for example `DEGRADED function cannot be invoked`) SHALL be classified independently from generic `tool_failure`.

#### Scenario: Degraded tool is counted in dedicated category
- **WHEN** traces contain a degraded-function invocation error
- **THEN** the aggregator SHALL classify it as `degraded_function`
- **AND** SHALL increment degraded-tool counters for the implicated tool/function

### Requirement: Budget pressure SHALL be visible per tool family
The summary SHALL expose request-level pressure indicators for deterministic limits (for example `budget_exhausted` and blocked calls by tool).

#### Scenario: Budget exhaustion appears in metrics
- **WHEN** traces include budget exhaustion events
- **THEN** the summary SHALL include blocked-call counters grouped by reason and tool
- **AND** SHALL include partial-finalize contribution attributable to budget limits
