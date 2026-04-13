## Why

The observability dashboard (`ui-cognitive/components/observability/dashboard-view.tsx`) displays agent metrics using only manual CSS bars and plain text. There are no real charts — no trend lines, no proportional distributions, no visual breakdowns. This makes it hard to spot regressions in latency, cost spikes by model, or failure rate trends across sessions. The tool usage bar also has a denominator bug (divides by total requests instead of max tool count), producing misleading percentages.

Adding a proper charting library enables temporal analysis, proportional comparisons, and visual health indicators that are essential for operating an autonomous agent system.

## What Changes

- Install **Recharts** as the charting library (composable, React 19 compatible, ~40KB gzipped)
- **Fix tool usage bar bug**: change denominator from `requests` to max tool count for correct proportional bars
- **Add latency trend sparklines**: p50/p95 line chart over recent traces
- **Add cost breakdown chart**: per-model stacked bar or horizontal bar showing budget distribution
- **Add failure rate trend**: area chart with success/failure rate over time
- **Improve tool failure display**: proportional horizontal bars with color scale instead of flat list
- **Replace session summary footer**: segmented health bar (completed/failed/running) instead of text-only
- **Add context overflow gauge**: visual threshold indicator replacing plain number

## Capabilities

### New Capabilities
- `recharts-chart-primitives`: Themed, reusable Recharts wrapper components (colors, tooltips, responsive containers) that match the existing design system variables
- `observability-trend-charts`: Temporal trend visualizations for latency, cost, and failure rate using trace history
- `proportional-metric-bars`: Corrected horizontal bar charts for tool usage and tool failures with proper denominators and color scales
- `session-health-indicator`: Visual segmented bar and gauge components for session summary and context overflow

### Modified Capabilities
- `activity-panel`: SessionSummary footer changes from text to visual segmented bar

## Impact

- **New dependency**: `recharts` (+ transitive `d3-*` subset) added to `ui-cognitive/package.json`
- **Modified files**:
  - `components/observability/dashboard-view.tsx` — refactored to use chart components
  - `components/activity/session-summary.tsx` — segmented health bar
  - `lib/observability.ts` — needs to return time-series data (not just aggregates)
  - `app/api/observability/summary/route.ts` — endpoint must include historical trend data
- **Bundle size**: Recharts adds ~40KB gzipped; acceptable for a dashboard app
- **No breaking API changes**: all changes are additive to the existing UI
