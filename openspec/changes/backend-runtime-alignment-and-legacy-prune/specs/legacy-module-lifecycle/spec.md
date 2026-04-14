## ADDED Requirements

### Requirement: Legacy modules MUST follow phased deprecation lifecycle
Any module identified as legacy or dormant SHALL follow a phased lifecycle: `observe`, `deprecated`, `disabled_by_default`, and `removed`. Transition between phases SHALL be gated by explicit criteria.

#### Scenario: Module enters deprecated phase before disablement
- **WHEN** a module is marked as legacy candidate
- **THEN** it is first moved to `deprecated` phase with explicit logs and no immediate removal

### Requirement: Legacy deactivation MUST be guarded by feature flags
The system SHALL provide per-component feature flags for legacy module activation so operators can re-enable behavior during incidents without code rollback.

#### Scenario: Operator re-enables legacy component
- **WHEN** a regression is detected after disabling a legacy component
- **THEN** the component can be re-enabled via configuration flag and service restart

### Requirement: Legacy removal MUST require observation evidence
The system SHALL require observation evidence (usage counters and time window) before final removal of any legacy module that might have external consumers.

#### Scenario: Removal blocked without evidence
- **WHEN** usage telemetry is missing or non-zero in the observation window
- **THEN** final removal is blocked and module remains in a non-removed phase
