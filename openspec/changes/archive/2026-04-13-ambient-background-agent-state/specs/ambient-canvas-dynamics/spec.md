## ADDED Requirements

### Requirement: Canvas parameters driven by agent mood
The `DotGridBackground` component SHALL read the current agent mood and apply mood-specific animation parameters: speed multiplier, connection distance, dot opacity, line opacity multiplier, and pulse amplitude.

#### Scenario: Idle mood
- **WHEN** the agent mood is `"idle"`
- **THEN** particles SHALL move at 0.3x base speed, connection distance SHALL be 260px, dot opacity SHALL be low (~0.4), and no pulse effect SHALL be applied

#### Scenario: Thinking mood
- **WHEN** the agent mood is `"thinking"`
- **THEN** particles SHALL move at 1.0x base speed, connection distance SHALL widen to ~300px, and dot opacity SHALL be medium (~0.7)

#### Scenario: Executing mood
- **WHEN** the agent mood is `"executing"`
- **THEN** particles SHALL move at 1.5x base speed, connection distance SHALL tighten to ~220px, and dot opacity SHALL be high (~0.85)

#### Scenario: Agitated mood
- **WHEN** the agent mood is `"agitated"`
- **THEN** particles SHALL move at 2.5x base speed, connection distance SHALL widen to ~350px, and a sinusoidal pulse effect SHALL modulate dot opacity and line width

### Requirement: Smooth interpolation between mood states
The canvas animation loop SHALL interpolate current parameter values toward target values using frame-by-frame linear interpolation (lerp). Transitions SHALL NOT be abrupt.

#### Scenario: Mood changes from idle to executing
- **WHEN** the mood transitions from `"idle"` to `"executing"`
- **THEN** particle speed, connection distance, and opacity SHALL gradually change over approximately 1-2 seconds

#### Scenario: Mood changes from agitated to idle
- **WHEN** the mood transitions from `"agitated"` to `"idle"`
- **THEN** particles SHALL gradually slow down and opacity SHALL decrease smoothly

### Requirement: Theme compatibility preserved
The canvas SHALL continue to use theme-aware color schemes (dark/light mode). Mood-driven opacity and multiplier values SHALL scale relative to the theme base values, not replace them.

#### Scenario: Dark mode with executing mood
- **WHEN** the document is in dark mode and mood is `"executing"`
- **THEN** particles SHALL use dark theme colors with mood-adjusted opacity

#### Scenario: Light mode with thinking mood
- **WHEN** the document is in light mode and mood is `"thinking"`
- **THEN** particles SHALL use light theme colors with mood-adjusted opacity

### Requirement: No frame drops under mood transitions
The canvas animation SHALL maintain 60fps performance during mood transitions. The lerp computation per frame SHALL add negligible overhead to the existing draw loop.

#### Scenario: Rapid mood transitions
- **WHEN** the mood changes multiple times within 5 seconds
- **THEN** the animation SHALL remain smooth with no perceptible frame drops
