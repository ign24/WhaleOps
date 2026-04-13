## ADDED Requirements

### Requirement: stdio transport support
The MCP server SHALL support stdio transport as the default mode. When launched without transport arguments, it SHALL communicate via stdin/stdout using the MCP JSONRPC protocol.

#### Scenario: Default launch uses stdio
- **WHEN** the server is started with `uv run mcp-server`
- **THEN** it communicates via stdin/stdout using MCP JSONRPC framing

### Requirement: Streamable HTTP transport support
The MCP server SHALL support Streamable HTTP transport when configured. It SHALL listen on a configurable port (default 3100).

#### Scenario: HTTP transport launch
- **WHEN** the server is started with `uv run mcp-server --transport streamable-http --port 3100`
- **THEN** it accepts MCP connections over HTTP on port 3100

#### Scenario: Custom port via env var
- **WHEN** `MCP_PORT` env var is set to 4000 and transport is streamable-http
- **THEN** the server listens on port 4000

#### Scenario: CLI flag overrides env var
- **WHEN** `MCP_PORT=4000` is set and `--port 5000` is passed via CLI
- **THEN** the CLI flag wins and the server listens on port 5000

### Requirement: Agent URL configuration
The MCP server SHALL read the NAT agent base URL from the `MCP_AGENT_URL` environment variable, defaulting to `http://localhost:8000`.

#### Scenario: Default agent URL
- **WHEN** `MCP_AGENT_URL` is not set
- **THEN** the server connects to `http://localhost:8000`

#### Scenario: Custom agent URL
- **WHEN** `MCP_AGENT_URL` is set to `http://agent:8000`
- **THEN** the server connects to `http://agent:8000`

### Requirement: CLI entry point
The MCP server SHALL be launchable via `uv run mcp-server` using a pyproject.toml script entry point.

#### Scenario: Entry point registered
- **WHEN** the project is installed
- **THEN** the `mcp-server` command is available and starts the MCP server

### Requirement: Startup health check
The MCP server SHALL attempt to verify the NAT agent is reachable on startup with a 5-second timeout. If unreachable, it SHALL log a warning but still start (the agent may come up later).

#### Scenario: Agent reachable on startup
- **WHEN** the MCP server starts and the NAT agent responds within 5 seconds
- **THEN** the server logs "Agent connected at {url}" and proceeds

#### Scenario: Agent unreachable on startup
- **WHEN** the MCP server starts and the NAT agent does not respond within 5 seconds
- **THEN** the server logs a warning "Agent not reachable at {url}, will retry on first tool call" and starts anyway

### Requirement: Docker Compose service
An optional `mcp-server` service SHALL be defined in docker-compose.yml that depends on the `agent` service and exposes the Streamable HTTP transport.

#### Scenario: Docker compose up includes MCP server
- **WHEN** `docker compose up mcp-server` is run
- **THEN** the agent service starts first, then the MCP server starts with `MCP_AGENT_URL=http://agent:8000` and `MCP_TRANSPORT=streamable-http`
