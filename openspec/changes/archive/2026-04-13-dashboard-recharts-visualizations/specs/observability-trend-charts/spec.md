## ADDED Requirements

### Requirement: Backend returns time-bucketed trend data
The `computeTraceStats()` function SHALL return a `trendBuckets` array alongside existing aggregate stats. Each bucket SHALL contain `{ timestamp: number, requests: number, failures: number, p50Ms: number | null, p95Ms: number | null, costUsd: number }`. The trace time range SHALL be divided into a fixed number of buckets (10).

#### Scenario: Traces span multiple hours
- **WHEN** trace events span 5 hours with 100 events
- **THEN** `trendBuckets` contains 10 buckets, each covering 30 minutes, with aggregated metrics per window

#### Scenario: Too few traces for meaningful buckets
- **WHEN** fewer than 3 trace events exist
- **THEN** `trendBuckets` is returned as an empty array

#### Scenario: All traces in same time window
- **WHEN** all trace events have timestamps within the same 1-minute window
- **THEN** `trendBuckets` contains a single bucket with all data aggregated

### Requirement: Latency trend line chart
The dashboard SHALL display a `TrendLineChart` showing p50 and p95 latency over time. The X-axis SHALL show time labels. The Y-axis SHALL show milliseconds. Both lines SHALL be distinguishable by color (p50 = primary, p95 = warning).

#### Scenario: Trend data available
- **WHEN** `trendBuckets` contains 3 or more buckets with latency data
- **THEN** a line chart renders with two lines (p50 and p95) and time-axis labels

#### Scenario: Insufficient trend data
- **WHEN** `trendBuckets` is empty or has fewer than 3 buckets
- **THEN** the chart area shows a "Datos insuficientes para tendencias" placeholder message

### Requirement: Cost trend line chart
The dashboard SHALL display a `TrendLineChart` showing estimated cost per bucket over time. The Y-axis SHALL show USD values.

#### Scenario: Cost trend with data
- **WHEN** `trendBuckets` contains cost data
- **THEN** a line chart renders showing cost over time with USD-formatted Y-axis

### Requirement: Failure rate trend area chart
The dashboard SHALL display an area chart showing success rate percentage over time. A horizontal reference line at 95% SHALL indicate the SLO threshold.

#### Scenario: Failure rate trend rendering
- **WHEN** `trendBuckets` contains request and failure counts
- **THEN** an area chart renders with success rate percentage per bucket and a dashed 95% SLO line

#### Scenario: Perfect success rate
- **WHEN** all buckets have zero failures
- **THEN** the area fills at 100% with success color
