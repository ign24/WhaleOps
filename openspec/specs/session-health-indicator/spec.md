## ADDED Requirements

### Requirement: Segmented health bar in session summary
The `SessionSummary` component SHALL replace the text-only footer with a horizontal segmented bar showing the proportion of completed (success color), failed (error color), and running (warning color) entries. Numeric labels SHALL appear below the bar.

#### Scenario: Mixed status entries
- **WHEN** a session has 8 completed, 2 failed, and 1 running entry
- **THEN** the bar shows ~73% green, ~18% red, ~9% yellow segments, with "8 completados", "2 con error", "1 en curso" labels below

#### Scenario: All entries completed
- **WHEN** all entries have status "completed"
- **THEN** the bar is fully green with no failure or running segments

#### Scenario: No entries
- **WHEN** the entries array is empty
- **THEN** the bar is not rendered and the footer shows "Sin actividad"

### Requirement: Context overflow gauge indicator
The dashboard SHALL display a visual gauge indicator for context overflow count instead of a plain number. The gauge SHALL use thresholds: 0 = green, 1-2 = yellow, 3+ = red.

#### Scenario: Zero overflows
- **WHEN** `contextOverflowCount` is 0
- **THEN** the gauge shows green with "0" label

#### Scenario: Warning threshold
- **WHEN** `contextOverflowCount` is 2
- **THEN** the gauge shows yellow/warning color with "2" label

#### Scenario: Critical threshold
- **WHEN** `contextOverflowCount` is 5
- **THEN** the gauge shows red/error color with "5" label

## MODIFIED Requirements

### Requirement: SessionSummary footer displays session health
The `SessionSummary` component SHALL render a segmented health bar followed by metric labels. The previous text-only display with pipe-separated counts SHALL be replaced. The component SHALL continue to receive `entries: ActivityEntry[]` as its only prop.

#### Scenario: Footer layout
- **WHEN** `SessionSummary` renders with entries
- **THEN** a horizontal segmented bar appears at the top of the footer, with total count and duration labels below it
