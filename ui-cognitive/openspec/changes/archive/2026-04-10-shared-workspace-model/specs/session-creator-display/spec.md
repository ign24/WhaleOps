## ADDED Requirements

### Requirement: Sidebar shows session creator initials
Each session entry in the sidebar SHALL display a visual indicator of its creator using the creator's initials.

#### Scenario: Session with known creator shows initials
- **WHEN** a session has `createdBy.name` set to a non-empty string
- **THEN** the sidebar entry SHALL show a circular badge with the first letter(s) of the creator's name (up to 2 characters, uppercase)

#### Scenario: System-owned session shows neutral indicator
- **WHEN** a session has `createdBy.id === "system"` or `createdBy.name === "Sistema"`
- **THEN** the sidebar entry SHALL show a neutral indicator (e.g., "?" or system icon) instead of initials

#### Scenario: Creator badge is visible without hovering
- **WHEN** the sidebar is in expanded state (not collapsed)
- **THEN** the creator badge SHALL be visible at all times, not only on hover

### Requirement: Creator tooltip shows full name on hover
The sidebar SHALL show the creator's full display name in a tooltip when the user hovers over the creator badge.

#### Scenario: Hover reveals full name
- **WHEN** the user hovers over the creator badge on a session entry
- **THEN** a tooltip SHALL appear showing the text "Creado por <name>"

#### Scenario: System session tooltip
- **WHEN** the user hovers over the creator badge of a system-owned session
- **THEN** the tooltip SHALL show "Creado por Sistema"

### Requirement: Creator display does not affect session interactivity
Adding the creator badge SHALL NOT interfere with existing session click, rename, or delete interactions.

#### Scenario: Click on session still navigates
- **WHEN** the user clicks anywhere on the session entry (excluding action buttons)
- **THEN** navigation to the session SHALL occur as before

#### Scenario: Creator badge click is a no-op
- **WHEN** the user clicks directly on the creator badge
- **THEN** no navigation or action SHALL occur (badge is display-only)
