## ADDED Requirements

### Requirement: `generate_report` tool registration SHALL NOT block service startup
The system SHALL register `generate_report` during workflow initialization without causing builder-time type introspection failures.

#### Scenario: Startup with `generate_report` enabled
- **WHEN** NAT loads `generate_report` from configuration during application startup
- **THEN** workflow initialization SHALL complete without `issubclass() arg 1 must be a class` errors

#### Scenario: Report generation behavior remains stable after startup hardening
- **WHEN** `generate_report` is called after successful startup
- **THEN** it SHALL still write `{REPORT_OUTPUT_DIR}/YYYY-MM-DD.md` and return the absolute report path
