## MODIFIED Requirements

### Requirement: Model name display
The meta bar SHALL display the active model name when available from activity entries and SHALL also display model cost category and session budget state when provided by chat/session metadata.

#### Scenario: Model name present in activity log
- **WHEN** at least one activity entry has a non-null `model` field
- **THEN** the meta bar displays the model name (truncated if needed)

#### Scenario: Cost metadata is available
- **WHEN** active model metadata includes cost classification
- **THEN** the meta bar displays a visible cost badge (`FREE`, `LOW`, `MED`, `HIGH`, or `UNKNOWN`)

#### Scenario: Session budget warning is active
- **WHEN** session budget state is `warning` or `limited`
- **THEN** the meta bar displays the corresponding budget indicator without hiding the model name
