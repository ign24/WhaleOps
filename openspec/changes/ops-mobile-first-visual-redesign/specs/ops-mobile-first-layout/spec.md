## ADDED Requirements

### Requirement: `/ops` layout SHALL be mobile-first and responsive without horizontal scroll
The system SHALL implement `/ops` layout using a mobile-first strategy and SHALL avoid horizontal scrolling for viewport widths from 320px and above during normal usage.

#### Scenario: Mobile viewport does not overflow horizontally
- **WHEN** a user opens `/ops` on a viewport between 320px and 767px wide
- **THEN** the page content fits the viewport width without requiring horizontal scroll

#### Scenario: Desktop viewport maintains responsive containment
- **WHEN** a user opens `/ops` on a viewport of 1024px or wider
- **THEN** layout containers remain within viewport bounds and do not produce horizontal overflow

### Requirement: `/ops` containers SHALL provide dedicated mobile variants
The system SHALL render key `/ops` containers in a mobile-optimized variant (stacked or card-based) on small viewports while preserving content parity with desktop.

#### Scenario: Mobile renders stacked/card container composition
- **WHEN** `/ops` is rendered on a small viewport
- **THEN** multi-panel desktop sections are presented as vertically stacked or card-based containers

#### Scenario: Mobile keeps core content parity
- **WHEN** a user compares mobile and desktop `/ops` views for the same session state
- **THEN** core operational information is available in both views, with only layout/presentation changes

### Requirement: `/ops` desktop layout SHALL be visually refined without workflow regression
The system SHALL refine desktop spacing, alignment, and panel rhythm to improve readability while preserving existing monitoring workflows.

#### Scenario: Desktop maintains quick-scanning workflow
- **WHEN** a user navigates `/ops` on desktop
- **THEN** primary operational signals remain immediately visible without extra navigation steps

#### Scenario: Desktop refinement improves visual hierarchy
- **WHEN** the refined desktop layout is rendered
- **THEN** spacing and typographic hierarchy clearly distinguish primary panels from secondary context

### Requirement: `/ops` styling SHALL align with `ui-cognitive` visual tokens
The system SHALL use existing `ui-cognitive` design tokens for color, typography, spacing, radius, and elevation, adding new tokens only when no equivalent token exists.

#### Scenario: Existing tokens are reused first
- **WHEN** `/ops` styles are implemented
- **THEN** token references prioritize existing design-system variables over hardcoded style values

#### Scenario: New tokens are explicit and scoped
- **WHEN** a missing design token is required for `/ops`
- **THEN** the token is added with a clear semantic name and documented usage

### Requirement: `/ops` SHALL satisfy baseline accessibility checks
The system SHALL provide baseline accessibility for `/ops`, including semantic structure, visible keyboard focus, and sufficient contrast for core UI elements.

#### Scenario: Keyboard users can follow focus
- **WHEN** a user navigates `/ops` with keyboard only
- **THEN** interactive elements expose visible focus indicators in logical order

#### Scenario: Core text and controls meet contrast baseline
- **WHEN** `/ops` is evaluated for baseline contrast on primary text and controls
- **THEN** the rendered styles meet the project's minimum contrast requirements

### Requirement: `/ops` SHALL define cross-device acceptance criteria
The system SHALL define and validate acceptance criteria for both mobile and desktop behavior before marking the redesign complete.

#### Scenario: Mobile acceptance criteria are met
- **WHEN** the redesign is validated on target mobile breakpoints
- **THEN** responsive layout, container variants, and baseline accessibility checks pass

#### Scenario: Desktop acceptance criteria are met
- **WHEN** the redesign is validated on target desktop breakpoints
- **THEN** refined layout, token consistency, and baseline accessibility checks pass
