## MODIFIED Requirements

### Requirement: Split layout with chat and activity panels
The chat session page SHALL render a `ChatSessionLayout` component that displays the chat panel and activity panel side by side using a CSS grid. The activity panel SHALL be collapsible, and desktop users SHALL be able to resize panel width freely within bounded min/max limits defined by the UI.

#### Scenario: Desktop view with panel open
- **WHEN** viewport width is >= 1024px and the activity panel is open
- **THEN** the layout renders as a two-column grid with chat on the left and activity panel on the right

#### Scenario: Desktop view with panel closed
- **WHEN** viewport width is >= 1024px and the activity panel is closed
- **THEN** the chat panel fills the full content width

#### Scenario: Below 1024px with panel open
- **WHEN** viewport width is < 1024px and the user opens the activity panel
- **THEN** the panel renders as an overlay (slide-over from right) with a backdrop

#### Scenario: User resizes desktop activity panel
- **WHEN** viewport width is >= 1024px and the user drags the resize handle for the activity panel
- **THEN** the grid updates continuously to the requested width within configured limits without breaking chat or activity rendering

### Requirement: Panel state persistence
The activity panel open/closed state SHALL be persisted to `localStorage` so it survives page reloads, and resized panel width SHALL also persist using safe defaults when missing or invalid.

#### Scenario: User closes panel and reloads
- **WHEN** user closes the activity panel and refreshes the page
- **THEN** the panel remains closed on reload

#### Scenario: User changes panel width and reloads
- **WHEN** user resizes the panel width and refreshes the page
- **THEN** the same width is reapplied when valid

#### Scenario: Persisted panel width is invalid
- **WHEN** a persisted panel width is invalid
- **THEN** the UI falls back to the default panel width
