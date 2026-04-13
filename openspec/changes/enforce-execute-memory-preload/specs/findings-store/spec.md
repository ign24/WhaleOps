## ADDED Requirements

### Requirement: query_findings SHALL support execute preflight usage
`query_findings` SHALL support deterministic preflight invocation from `execute` mode with bounded latency and graceful degradation semantics.

#### Scenario: Bounded preflight call returns quickly
- **WHEN** `execute` invokes `query_findings` as preflight
- **THEN** the query uses a bounded timeout and capped result size
- **AND** returns within the configured latency budget or degrades

#### Scenario: Degraded backend returns machine-readable fallback
- **WHEN** Milvus is unavailable, circuit-open, or request times out during preflight
- **THEN** `query_findings` returns a machine-readable degraded response
- **AND** includes a stable status/message that runtime can map to `preflight.status=degraded`
