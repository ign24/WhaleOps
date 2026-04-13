## ADDED Requirements

### Requirement: Session and user budget enforcement
The chat API SHALL evaluate budget usage before each model request using configurable `softLimit` and `hardLimit` thresholds at session and user scope.

#### Scenario: Budget below soft limit
- **WHEN** estimated cumulative spend is below configured `softLimit`
- **THEN** the request proceeds without budget warning

#### Scenario: Budget crosses soft limit
- **WHEN** estimated cumulative spend reaches or exceeds `softLimit` but remains below `hardLimit`
- **THEN** the request proceeds and returns a structured budget warning payload

#### Scenario: Budget crosses hard limit
- **WHEN** estimated cumulative spend reaches or exceeds `hardLimit`
- **THEN** the system SHALL execute the configured hard-limit action (`fallback` or `block`)

### Requirement: Deterministic fallback on hard limit
When hard-limit action is `fallback`, the system SHALL route to a configured lower-cost allowed model and record the fallback event in session telemetry.

#### Scenario: Valid fallback model exists
- **WHEN** hard limit is reached and fallback model is configured and allowed
- **THEN** the request is executed with fallback model and response includes fallback metadata

#### Scenario: Fallback model unavailable
- **WHEN** hard limit is reached and fallback model is missing, blocked, or invalid
- **THEN** the request is rejected with a budget-limit error and no model call is executed
