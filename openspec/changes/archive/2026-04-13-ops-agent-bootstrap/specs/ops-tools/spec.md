## ADDED Requirements

### Requirement: vps_status tool
The system SHALL register a `vps_status` NAT tool in `src/cognitive_code_agent/tools/ops_tools.py` that calls `D03Client.get_status()` and returns a structured string summarising CPU %, memory %, disk %, and uptime formatted for human reading.

#### Scenario: vps_status returns formatted health summary
- **WHEN** the agent invokes `vps_status` and D03 responds with valid status data
- **THEN** the tool returns a string containing labelled values for CPU, memory, disk, and uptime

#### Scenario: vps_status surfaces D03 errors as tool output
- **WHEN** D03 returns a non-200 status or the client times out
- **THEN** the tool returns a descriptive error string (not a Python exception) so the agent can relay it to the user

### Requirement: list_services tool
The system SHALL register a `list_services` NAT tool that calls `D03Client.list_services()` and returns a formatted table (or bulleted list) of service names and states (`active` / `inactive` / `failed`).

#### Scenario: list_services returns service table
- **WHEN** the agent invokes `list_services` and D03 responds with a service list
- **THEN** the tool returns a string with each service name and state on its own line

#### Scenario: list_services surfaces failed services prominently
- **WHEN** one or more services have state `failed`
- **THEN** the tool output marks those services with a CRIT label so the agent can include it in the response

### Requirement: get_logs tool
The system SHALL register a `get_logs` NAT tool that accepts `service: str` and `lines: int = 50` parameters, calls `D03Client.get_logs(service, lines)`, and returns the log entries as a single string (one line per entry).

#### Scenario: get_logs returns journal tail
- **WHEN** the agent invokes `get_logs` with a valid service name
- **THEN** the tool returns the last N log lines as a single newline-joined string

#### Scenario: get_logs limits lines to API maximum
- **WHEN** the caller passes `lines > 500`
- **THEN** the tool clamps the value to 500 before calling the client

#### Scenario: get_logs returns error on unknown service
- **WHEN** D03 returns HTTP 404 for the requested service
- **THEN** the tool returns a descriptive error string indicating the service was not found

### Requirement: Ops tools enforce Tier 0 (no write operations)
All three ops tools SHALL be read-only. No tool in `ops_tools.py` SHALL send POST, PUT, PATCH, or DELETE requests to any endpoint.

#### Scenario: No write HTTP method used by ops tools
- **WHEN** any ops tool is invoked
- **THEN** only GET HTTP requests are issued to D03

### Requirement: Ops tools registered in NAT via @register_function
Each tool function in `ops_tools.py` SHALL use the `@register_function` decorator so NAT discovers and exposes it when listed in `config.yml` tool_names.

#### Scenario: Tools discoverable by NAT at startup
- **WHEN** the agent server starts with `vps_status`, `list_services`, `get_logs` in the `ops` mode tool_names
- **THEN** all three tools are bound and available without import errors
