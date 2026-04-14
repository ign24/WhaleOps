## ADDED Requirements

### Requirement: D03 REST API contract
The D03 mini REST API SHALL expose three read-only endpoints authenticated via a static bearer token:
- `GET /status` — returns overall VPS health (CPU %, memory %, disk %, uptime)
- `GET /services` — returns a list of managed service names and their current state (`active` / `inactive` / `failed`)
- `GET /logs/{service}` — returns the last N lines of the named service journal log; supports `?lines=N` query param (default 50, max 500)

Authentication: `Authorization: Bearer <D03_API_TOKEN>` header on every request.
Response format: JSON.

#### Scenario: /status returns VPS health
- **WHEN** `GET /status` is called with a valid bearer token
- **THEN** the response is HTTP 200 with JSON containing `cpu_percent`, `memory_percent`, `disk_percent`, and `uptime_seconds`

#### Scenario: /services returns service list
- **WHEN** `GET /services` is called with a valid bearer token
- **THEN** the response is HTTP 200 with JSON array where each item has `name` and `state` fields

#### Scenario: /logs/{service} returns journal tail
- **WHEN** `GET /logs/nginx` with `?lines=100` is called with a valid bearer token
- **THEN** the response is HTTP 200 with JSON containing `service`, `lines`, and `entries` (list of log line strings)

#### Scenario: Invalid token rejected
- **WHEN** any endpoint is called with a missing or invalid bearer token
- **THEN** the response is HTTP 401

#### Scenario: Unknown service returns 404
- **WHEN** `GET /logs/nonexistent-service` is called
- **THEN** the response is HTTP 404

### Requirement: D03 async HTTP client
The system SHALL implement `D03Client` in `src/cognitive_code_agent/tools/d03_client.py` as an `httpx.AsyncClient` wrapper. It SHALL:
- Read `D03_API_URL` and `D03_API_TOKEN` from environment at instantiation
- Raise `RuntimeError` with a descriptive message if either env var is missing
- Set a default request timeout of 10 seconds
- Inject the `Authorization: Bearer` header on every request
- Expose coroutine methods: `get_status()`, `list_services()`, `get_logs(service, lines)`

#### Scenario: Client raises on missing env var
- **WHEN** `D03Client` is instantiated with `D03_API_URL` unset
- **THEN** a `RuntimeError` is raised before any HTTP call is made

#### Scenario: Client injects auth header
- **WHEN** any client method makes an HTTP request
- **THEN** the `Authorization: Bearer <token>` header is present in the outgoing request

#### Scenario: Client returns parsed JSON
- **WHEN** the D03 API returns a valid JSON response
- **THEN** the client method returns a Python dict or list (not a raw response object)

#### Scenario: Client raises on timeout
- **WHEN** the D03 API does not respond within 10 seconds
- **THEN** an `httpx.TimeoutException` propagates to the caller (not swallowed)
