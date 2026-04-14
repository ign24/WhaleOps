## ADDED Requirements

### Requirement: Startup MUST validate runtime-config alignment
The system SHALL validate at startup that tools imported/registered in runtime are consistent with `workflow.tool_names` and each mode `tool_names` in `config.yml`. The validation SHALL emit structured diagnostics for missing tools, extra tools, and mode-level mismatches.

#### Scenario: Startup detects missing configured tool
- **WHEN** `config.yml` declares a tool that is not registered at runtime
- **THEN** the system records a `runtime.tool_binding.mismatch_total` event and emits a structured warning or error according to enforcement mode

### Requirement: Runtime alignment enforcement MUST be feature-flagged
The system SHALL support a feature flag for startup alignment enforcement with at least two modes: `warn` and `strict`. `warn` logs mismatches without aborting startup; `strict` aborts startup on mismatch.

#### Scenario: Warning mode preserves availability
- **WHEN** alignment mismatch occurs and enforcement mode is `warn`
- **THEN** server startup continues and mismatch is visible in logs/metrics

#### Scenario: Strict mode prevents invalid runtime
- **WHEN** alignment mismatch occurs and enforcement mode is `strict`
- **THEN** server startup fails with actionable mismatch diagnostics

### Requirement: Config and test fixtures MUST share the same memory source precedence
The system SHALL define and test a single precedence order for memory config resolution (dedicated memory config, legacy config fallback, defaults) and SHALL keep production and tests aligned to that order.

#### Scenario: Dedicated memory config takes precedence
- **WHEN** both dedicated memory config and legacy config are present
- **THEN** runtime and tests resolve memory settings from dedicated memory config
