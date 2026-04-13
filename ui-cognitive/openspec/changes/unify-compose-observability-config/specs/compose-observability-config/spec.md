## ADDED Requirements

### Requirement: Compose observability environment contract
The system MUST support a single observability configuration contract for Docker Compose deployments in both local and VPS environments.

#### Scenario: Compose deployment uses unified backend and trace path
- **WHEN** the UI is started with Docker Compose
- **THEN** NAT backend resolution MUST use the configured service URL (defaulting to `http://nat:8000` in documented Compose topology)
- **AND** trace ingestion MUST use the configured trace file path (defaulting to `/app/traces/agent_traces.jsonl` in documented Compose topology)

### Requirement: Configuration mismatch must be diagnosable
The system MUST expose actionable diagnostics when observability configuration is invalid or unavailable.

#### Scenario: Backend endpoint is unreachable
- **WHEN** `NAT_BACKEND_URL` is misconfigured or backend NAT is down
- **THEN** observability summary responses MUST include a backend-unavailable diagnostic state

#### Scenario: Trace source is missing or inaccessible
- **WHEN** `TRACES_PATH` does not exist or is not mounted/readable
- **THEN** observability summary responses MUST include a trace-source-unavailable diagnostic state
