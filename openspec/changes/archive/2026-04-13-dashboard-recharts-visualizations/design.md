## Context

The observability dashboard in `ui-cognitive` displays agent runtime metrics (latency, cost, tool usage, failures) using only text cards and manual CSS width-based bars. The data pipeline reads JSONL trace files via `lib/observability.ts:computeTraceStats()`, which aggregates everything into a single snapshot — no time-series data is preserved. The frontend renders this snapshot in `components/observability/dashboard-view.tsx` using a flat `MetricCard` grid and plain lists.

Current limitations:
- No temporal trends (can't see if latency or cost is improving/degrading)
- Tool usage bars use wrong denominator (`requests` instead of `max(count)`)
- Failure/error lists are text-only with no proportional comparison
- Session health in activity panel is text-only footer
- No charting library in the stack — React 19, Next.js 16, Tailwind CSS, Lucide icons

## Goals / Non-Goals

**Goals:**
- Add Recharts as the charting library for composable, themed chart components
- Provide temporal trend data by bucketing traces into time windows in the backend
- Fix the tool usage bar denominator bug
- Replace text-only displays with proportional visual indicators where they add clarity
- Maintain the existing design system (CSS custom properties: `--primary`, `--border`, `--surface`, etc.)
- Keep all chart components testable with TDD

**Non-Goals:**
- Real-time streaming charts (polling/refresh is sufficient)
- Historical data persistence beyond current trace file (no DB)
- Replacing the activity timeline component (only the summary footer changes)
- Adding new API endpoints — extend the existing `/api/observability/summary` response
- Dashboard layout framework (Tremor, etc.) — use Recharts directly with existing Tailwind layout

## Decisions

### 1. Charting library: Recharts over alternatives

**Choice**: Recharts 2.x

**Alternatives considered**:
- **Chart.js / react-chartjs-2**: Canvas-based, less composable with React, harder to theme with CSS vars
- **Tremor**: Dashboard framework on top of Recharts — adds unnecessary abstraction layer since we already have our own layout
- **Visx (Airbnb)**: Low-level D3 wrapper, more power but more boilerplate for standard charts
- **Nivo**: Beautiful defaults but heavier bundle, less control over theming

**Rationale**: Recharts is SVG-based (accessible, inspectable), React-native composition model, supports `ResponsiveContainer`, and at ~40KB gzipped is appropriate for a dashboard app. Theming via CSS custom properties works by reading them at render time.

### 2. Time-series data: bucket traces in backend, not frontend

**Choice**: Extend `computeTraceStats()` to return a `trendBuckets` array alongside the existing aggregate stats.

**Rationale**: The frontend has no access to raw trace files. The backend already streams and parses JSONL — adding time bucketing during the same pass is O(1) extra work per event. Each bucket contains: `{ timestamp, requests, failures, p50Ms, p95Ms, costUsd }`. Fixed 10-bucket window over the full trace range.

**Alternative considered**: Separate endpoint for trend data — rejected because it would double the file read.

### 3. Chart theme: derive colors from CSS custom properties

**Choice**: Read CSS vars (`--primary`, `--success`, `--error`, `--warning`) at component mount via `getComputedStyle` and pass to Recharts as hex/rgb values.

**Rationale**: Recharts doesn't support CSS custom properties natively in props like `stroke` or `fill`. A thin `useChartTheme()` hook resolves vars once and memoizes. This keeps charts consistent with the design system and respects dark/light mode.

### 4. Tool usage bar fix: denominator = max count in set

**Choice**: Change `pct = item.count / maxCount * 100` where `maxCount = topToolsByUsage[0].count`.

**Rationale**: The current formula `item.count / requests` is semantically wrong — a tool can be called multiple times per request. Using the highest tool count as 100% baseline gives correct proportional bars.

### 5. Session health indicator: segmented bar in footer

**Choice**: Replace the text-only `SessionSummary` footer with a horizontal segmented bar showing completed/failed/running proportions with color coding.

**Rationale**: The activity panel is narrow (380px). A segmented bar communicates health ratio at a glance without taking more vertical space than the current text footer. Numbers remain as labels below.

### 6. Chart wrapper components: thin, typed, reusable

**Choice**: Create 3-4 chart wrapper components in `components/observability/charts/`:
- `TrendLineChart` — time-series line chart (latency, cost, failure rate)
- `ProportionalBarList` — horizontal bars with correct proportional scaling
- `SegmentedBar` — stacked horizontal bar for composition (session health)
- `GaugeIndicator` — semicircular or linear gauge for context overflow

**Rationale**: Each wraps Recharts primitives with typed props and consistent theming. Dashboard view composes these instead of using Recharts directly — makes testing easier and keeps the dashboard view clean.

## Risks / Trade-offs

- **Bundle size increase** (~40KB gzipped for Recharts + d3 subset) — Acceptable for a dashboard app. Mitigation: dynamic import the chart components so they don't bloat the main chat bundle.
  
- **Trend data accuracy with limited traces** — If trace file has < 10 events, buckets will be sparse/empty. Mitigation: show "Insufficient data for trends" placeholder when bucket count < 3.

- **CSS var resolution timing** — `getComputedStyle` must run after mount. Mitigation: `useChartTheme` hook with `useLayoutEffect` and fallback hex values.

- **Recharts React 19 compatibility** — Recharts 2.x is tested with React 18. Mitigation: verify during `bun add`; Recharts 2.15+ has React 19 support per their changelog. If issues arise, pin to known-good version.
