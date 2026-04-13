## ADDED Requirements

### Requirement: Timeline entries display a vertical connector line
Each entry in the activity timeline SHALL render a vertical line connecting it to the next entry, creating a continuous log-style visual chain.

#### Scenario: Connector line visible between entries
- **WHEN** two or more timeline entries are rendered
- **THEN** a vertical line SHALL be visible along the left side connecting entries, aligned with the center of the status icon

#### Scenario: Last entry has no dangling connector
- **WHEN** a timeline entry is the last in the list
- **THEN** the connector line SHALL NOT extend below the entry's icon

### Requirement: Timeline entry status is shown as a pill badge with text
The colored dot indicating entry status SHALL be replaced by a pill badge containing a short Spanish label.

#### Scenario: Running entry shows "En curso" badge
- **WHEN** an entry has status "running"
- **THEN** a pill badge with text "En curso" SHALL be rendered using the primary color scheme

#### Scenario: Completed entry shows "Listo" badge
- **WHEN** an entry has status "completed"
- **THEN** a pill badge with text "Listo" SHALL be rendered using the success color scheme

#### Scenario: Failed entry shows "Error" badge
- **WHEN** an entry has status "failed"
- **THEN** a pill badge with text "Error" SHALL be rendered using the error color scheme

#### Scenario: Pending entry shows "Pendiente" badge
- **WHEN** an entry has status "pending"
- **THEN** a pill badge with text "Pendiente" SHALL be rendered using the warning color scheme

### Requirement: Tool call arguments render in a two-column key/value table
Tool arguments in the tool-call-card SHALL be displayed in a definition-list style two-column table with the key on the left and the value on the right.

#### Scenario: Arguments displayed in table layout
- **WHEN** a tool call has arguments
- **THEN** each argument SHALL render as a row with the humanized key label in a fixed-width left column and the value in the right column

#### Scenario: Code-like values use monospace font
- **WHEN** a tool argument value is a file path, command string, or code snippet
- **THEN** the value SHALL render in a monospace font with a subtle background

### Requirement: Context chips in tool-call-card use pill border style
The context chips (command summary, sandbox path, return code) SHALL render as proper pill badges with a visible border.

#### Scenario: Return code zero renders as success pill
- **WHEN** the return code summary indicates exit 0
- **THEN** the chip SHALL use the success color scheme (green border + tinted background)

#### Scenario: Non-zero return code renders as error pill
- **WHEN** the return code summary indicates a non-zero exit
- **THEN** the chip SHALL use the error color scheme (red border + tinted background)

#### Scenario: Neutral chips render with muted border
- **WHEN** a chip carries no success/error semantic (e.g. sandbox path, command summary)
- **THEN** the chip SHALL render with a muted border and neutral background

### Requirement: Session stats display inline with vertical separators
The session-info and session-summary stats SHALL be displayed on a single line with vertical pipe separators between values, rather than a grid layout.

#### Scenario: Stats visible in one row
- **WHEN** the session-info component renders
- **THEN** tool count, duration, and model SHALL appear on one line separated by vertical dividers

### Requirement: Model vendor badge uses tinted background
The model-vendor-badge SHALL display a subtle tinted background based on the vendor color tier rather than a plain border.

#### Scenario: Badge renders with tinted background
- **WHEN** a model vendor badge is rendered
- **THEN** the badge background SHALL use a color-mix tint derived from --primary or --text-primary at low opacity

### Requirement: Session workspace section headers use pill-style with count badge
Each section in session-workspace (Repos, Files, Commands, etc.) SHALL display its item count as a small badge next to the section label.

#### Scenario: Section count badge visible
- **WHEN** a workspace section has items
- **THEN** the section header SHALL show the item count in a compact badge (e.g. "Archivos 3")

#### Scenario: Empty sections are visually de-emphasized
- **WHEN** a workspace section has zero items
- **THEN** the section SHALL still render its header but with muted/reduced opacity styling
