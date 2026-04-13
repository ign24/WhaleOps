## ADDED Requirements

### Requirement: Interactive layout controls SHALL expose consistent affordance states
Interactive controls in layout/navigation areas SHALL provide consistent hover, focus-visible, and disabled states so users can identify actionable elements quickly.

#### Scenario: Hover and focus on layout action
- **WHEN** the user hovers or focuses a layout action button/link
- **THEN** the control displays a visible affordance state consistent with the design system tokens

### Requirement: Critical layout actions SHALL provide explanatory tooltips
Critical actions related to workspace navigation and layout editing SHALL expose concise explanatory tooltips, especially when icon-only or collapsed states are shown.

#### Scenario: Collapsed sidebar icon action
- **WHEN** the sidebar is collapsed and the user hovers or focuses an icon-only action
- **THEN** a tooltip explains the action intent

### Requirement: Affordance policy SHALL remain accessibility-compliant
Affordance enhancements MUST preserve keyboard usability and visual contrast requirements in light and dark themes.

#### Scenario: Keyboard-only navigation through layout controls
- **WHEN** the user navigates with keyboard focus across layout controls
- **THEN** focus indicators remain visible and actionable without requiring pointer hover
