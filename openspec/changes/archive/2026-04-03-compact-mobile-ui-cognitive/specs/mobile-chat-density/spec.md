## ADDED Requirements

### Requirement: Mobile chat layout reduces non-essential vertical spacing
The mobile chat layout in `ui-cognitive` SHALL reduce non-essential vertical whitespace in containers, section gaps, and message-area framing to increase visible conversational content without changing behavior.

#### Scenario: Mobile viewport opens chat session
- **WHEN** viewport width is in mobile breakpoint
- **THEN** the chat/layout spacing uses compact values compared to desktop
- **AND** message rendering, ordering, and streaming behavior remain unchanged

### Requirement: Mobile header uses compact density
The mobile header SHALL use reduced height, padding, and internal spacing while preserving the same information hierarchy and controls.

#### Scenario: User views chat header on mobile
- **WHEN** viewport width is in mobile breakpoint
- **THEN** header consumes less vertical space than current baseline
- **AND** all existing header controls remain available and functional

### Requirement: Conversations controls and mobile drawer are compact
The conversations bar/button and mobile drawer SHALL use compact spacing and sizing to reduce visual footprint, without changing open/close behavior or navigation semantics.

#### Scenario: User opens conversations drawer on mobile
- **WHEN** user taps the conversations trigger in mobile viewport
- **THEN** the drawer opens with compact visual density
- **AND** conversation selection and close interactions behave exactly as before

### Requirement: Cards and typography follow mobile-first readability
Cards and text styles in mobile chat surfaces SHALL adopt a mobile-first type scale and compact card spacing that preserve readability and contrast.

#### Scenario: User reads cards and text on mobile
- **WHEN** viewport width is in mobile breakpoint
- **THEN** typography uses mobile-first size/line-height values and compact card paddings
- **AND** text remains legible with no loss of critical information
