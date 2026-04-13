## ADDED Requirements

### Requirement: Recharts dependency installed and configured
The system SHALL include `recharts` as a production dependency in `ui-cognitive/package.json`. Chart components SHALL be dynamically imported to avoid bloating the main chat bundle.

#### Scenario: Recharts available after install
- **WHEN** the ui-cognitive application builds
- **THEN** `recharts` is resolved as a dependency and no build errors occur

#### Scenario: Chart components are code-split from chat bundle
- **WHEN** the chat page (`/chat/[sessionKey]`) loads
- **THEN** Recharts JS is NOT included in the initial bundle (only loaded when observability page or activity panel renders charts)

### Requirement: useChartTheme hook resolves design system colors
The system SHALL provide a `useChartTheme()` hook that reads CSS custom properties (`--primary`, `--success`, `--error`, `--warning`, `--border`, `--surface`, `--text-primary`) and returns resolved color values for use in Recharts components.

#### Scenario: Colors resolve on mount
- **WHEN** a chart component renders in a mounted DOM
- **THEN** `useChartTheme()` returns an object with hex/rgb color strings derived from the current CSS custom property values

#### Scenario: Fallback colors before mount
- **WHEN** `useChartTheme()` is called before DOM is available (SSR)
- **THEN** the hook returns hardcoded fallback color values so the component does not crash

#### Scenario: Theme respects dark/light mode
- **WHEN** the user toggles between dark and light mode
- **THEN** `useChartTheme()` returns updated color values matching the new theme on next render

### Requirement: ResponsiveContainer wraps all chart components
Every chart component SHALL use Recharts `ResponsiveContainer` with `width="100%"` to fill its parent container, adapting to the dashboard grid layout.

#### Scenario: Chart resizes with container
- **WHEN** the browser window is resized
- **THEN** all chart components resize proportionally without overflow or clipping
