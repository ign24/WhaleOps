## ADDED Requirements

### Requirement: Immediate pending acknowledgement on new conversation creation
The `ui-cognitive` frontend SHALL show immediate pending feedback when the user initiates a new conversation, and SHALL prevent duplicate creation actions until navigation settles.

#### Scenario: Click shows immediate continuity state
- **WHEN** the user activates the new conversation control
- **THEN** the control enters a pending visual state in the same interaction frame
- **AND** the pending state remains visible until route transition is resolved or fails

#### Scenario: Duplicate creation is blocked while pending
- **WHEN** new conversation creation is already in flight
- **THEN** subsequent activations of the same control are ignored
- **AND** the control exposes disabled semantics for pointer and keyboard interaction

### Requirement: Pending state remains visually consistent across themes
Pending feedback styling SHALL use existing semantic tokens and SHALL remain legible and subtle in both dark and light themes.

#### Scenario: Theme-safe pending feedback
- **WHEN** the UI is rendered in dark mode or light mode during pending state
- **THEN** the pending indicator uses token-derived colors/opacity without hardcoded theme-specific values
- **AND** text and icon contrast remain consistent with the existing visual language
