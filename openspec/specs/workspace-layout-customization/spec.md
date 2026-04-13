## ADDED Requirements

### Requirement: Workspace layout preferences SHALL be user-editable
The UI SHALL provide explicit controls so the user can edit workspace layout preferences (including sidebar state and chat/activity split preference) without editing code or using hidden settings.

#### Scenario: User edits layout preference from visible control
- **WHEN** the user interacts with a layout control in the workspace shell
- **THEN** the selected preference is applied immediately to the visible layout

### Requirement: Layout preferences SHALL persist locally with safe fallback
The UI SHALL persist layout preferences in local storage and SHALL restore them on reload. Invalid or missing values MUST fall back to safe defaults.

#### Scenario: Preferences restored after reload
- **WHEN** the user reloads the workspace after changing layout preferences
- **THEN** the same preferences are restored and applied

#### Scenario: Invalid persisted preference
- **WHEN** local storage contains an unsupported value for a layout preference
- **THEN** the UI ignores the invalid value and applies a default without crashing
