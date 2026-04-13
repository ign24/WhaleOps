## 1. Setup and chart primitives

- [x] 1.1 Install recharts dependency (`bun add recharts`) and verify build passes
- [x] 1.2 RED: Write tests for `useChartTheme` hook — resolves CSS vars, returns fallbacks during SSR, updates on theme change
- [x] 1.3 GREEN: Implement `useChartTheme` hook in `hooks/use-chart-theme.ts`
- [x] 1.4 SKIP: ResponsiveContainer used directly in chart components — wrapper is unnecessary abstraction
- [x] 1.5 SKIP: See 1.4

## 2. Backend trend data

- [x] 2.1 RED: Write tests for `computeTrendBuckets` — 10 buckets across time range, empty array for < 3 events, single bucket when all events in same window
- [x] 2.2 GREEN: Implement `computeTrendBuckets` in `lib/observability.ts` — bucket traces during existing parse pass, return `trendBuckets` array
- [x] 2.3 Update `ObservabilityResponse` type in `dashboard-view.tsx` to include `trendBuckets` field
- [x] 2.4 Update `/api/observability/summary/route.ts` — already uses ReturnType, no change needed

## 3. Proportional metric bars (bug fix + enhancement)

- [x] 3.1 RED: Write tests for `ProportionalBarList` component — correct denominator (max count), proportional widths, color intensity scaling, empty state
- [x] 3.2 GREEN: Implement `ProportionalBarList` in `components/observability/charts/proportional-bar-list.tsx`
- [x] 3.3 Replace tool usage bars in `dashboard-view.tsx` with `ProportionalBarList` (fixes denominator bug)
- [x] 3.4 Replace tool failure list in `dashboard-view.tsx` with `ProportionalBarList` (red color scale variant)
- [x] 3.5 Replace error category list in `dashboard-view.tsx` with `ProportionalBarList`

## 4. Trend line charts

- [x] 4.1 RED: Write tests for `TrendLineChart` component — renders lines with correct data keys, shows placeholder when < 3 data points, formats axes
- [x] 4.2 GREEN: Implement `TrendLineChart` in `components/observability/charts/trend-line-chart.tsx`
- [x] 4.3 RED: Write tests for `TrendAreaChart` component — renders area with success rate, shows SLO reference line at 95%
- [x] 4.4 GREEN: Implement `TrendAreaChart` in `components/observability/charts/trend-area-chart.tsx`
- [x] 4.5 Add latency trend chart (p50/p95) to `dashboard-view.tsx`
- [x] 4.6 Add cost trend chart to `dashboard-view.tsx`
- [x] 4.7 Add failure rate trend area chart to `dashboard-view.tsx`

## 5. Session health indicator

- [x] 5.1 RED: Write tests for `SegmentedBar` component — proportional segments for completed/failed/running, all-completed state, empty state
- [x] 5.2 GREEN: Implement `SegmentedBar` in `components/observability/charts/segmented-bar.tsx`
- [x] 5.3 RED: Write tests for `GaugeIndicator` component — green at 0, yellow at 1-2, red at 3+
- [x] 5.4 GREEN: Implement `GaugeIndicator` in `components/observability/charts/gauge-indicator.tsx`
- [x] 5.5 REVERTED: User prefers text-only footer in SessionSummary — SegmentedBar removed
- [x] 5.6 Replace context overflow plain number with `GaugeIndicator` in `dashboard-view.tsx`

## 6. Integration and verification

- [x] 6.1 SKIP: Dashboard is a separate route — Next.js code-splits naturally, no dynamic import needed
- [x] 6.2 Run full lint and build — 0 lint errors, 453/453 tests passing
- [ ] 6.3 Visual verification in browser — confirm all charts render correctly with real data
- [x] 6.4 Run existing test suite to verify no regressions — 70/70 files pass
