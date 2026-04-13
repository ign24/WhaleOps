## ADDED Requirements

### Requirement: Canonical model cost metadata
The system SHALL maintain a canonical model catalog that includes, for each selectable model, `costCategory`, `billingType`, and `riskLevel` metadata consumable by both UI and API layers.

#### Scenario: Registry model is loaded in UI
- **WHEN** the model selector renders available models
- **THEN** each model includes normalized cost metadata from the canonical catalog

#### Scenario: Unknown provider pricing
- **WHEN** a model has no reliable pricing source configured
- **THEN** the model SHALL be classified as `costCategory=unknown` and `riskLevel=high`

### Requirement: Environment policy for model usage
The system SHALL support per-environment policy tags for models (`allow`, `warn`, `block`) so high-risk models can be restricted in production.

#### Scenario: Model policy is block in production
- **WHEN** a user attempts to select a model tagged `block` in the current environment
- **THEN** the system denies the selection and returns a policy error reason

#### Scenario: Model policy is warn
- **WHEN** a user selects a model tagged `warn`
- **THEN** the UI displays a clear warning before continuing
