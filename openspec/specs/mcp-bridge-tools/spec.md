# mcp-bridge-tools Specification

## Purpose
TBD - created by archiving change mcp-server-wrapper. Update Purpose after archive.
## Requirements
### Requirement: analyze_code tool exposed via MCP
The MCP server SHALL expose an `analyze_code` tool that accepts a `prompt` (string, required) and `context` (string, optional) parameter. The tool SHALL forward the prompt prefixed with `/analyze` to the NAT agent endpoint and return the complete agent response as the tool result.

#### Scenario: Successful analysis request
- **WHEN** an MCP client calls `analyze_code` with prompt "Review this module for security issues"
- **THEN** the server sends a ChatRequest with message "/analyze Review this module for security issues" to the NAT endpoint and returns the full response text

#### Scenario: Analysis with context
- **WHEN** an MCP client calls `analyze_code` with prompt "Check error handling" and context "Python FastAPI service"
- **THEN** the server prepends the context to the prompt before forwarding to NAT

### Requirement: execute_task tool exposed via MCP
The MCP server SHALL expose an `execute_task` tool that accepts a `prompt` (string, required) and `context` (string, optional) parameter. The tool SHALL forward the prompt prefixed with `/execute` to the NAT agent endpoint and return the complete agent response as the tool result.

#### Scenario: Successful execution request
- **WHEN** an MCP client calls `execute_task` with prompt "Add type hints to all public functions in utils.py"
- **THEN** the server sends a ChatRequest with message "/execute Add type hints to all public functions in utils.py" to the NAT endpoint and returns the full response text

### Requirement: agent_chat tool exposed via MCP
The MCP server SHALL expose an `agent_chat` tool that accepts a `prompt` (string, required) parameter. The tool SHALL forward the prompt to the NAT agent endpoint without a mode prefix and return the complete agent response as the tool result.

#### Scenario: Chat request
- **WHEN** an MCP client calls `agent_chat` with prompt "What testing framework does this project use?"
- **THEN** the server sends a ChatRequest with the prompt to the NAT endpoint and returns the full response text

### Requirement: Response collection from streaming endpoint
The MCP server SHALL consume the full SSE stream from the NAT `/chat/stream` endpoint, concatenate all content chunks, and return the complete text as the MCP tool result.

#### Scenario: Stream fully consumed
- **WHEN** the NAT agent streams 15 response chunks
- **THEN** the MCP tool result contains all 15 chunks concatenated in order

### Requirement: Output truncation
The MCP server SHALL enforce a configurable maximum output size (default 100,000 characters via `MCP_MAX_OUTPUT_CHARS`). Responses exceeding this limit SHALL be truncated with a trailing marker.

#### Scenario: Response truncation on large output
- **WHEN** the agent response exceeds the configured max output chars
- **THEN** the tool result is truncated at the limit with a trailing note "[Response truncated at {limit} characters]"

#### Scenario: Response within limit
- **WHEN** the agent response is 50,000 characters and the limit is 100,000
- **THEN** the full response is returned without truncation

### Requirement: Request timeout enforcement
Each tool call SHALL enforce a configurable timeout (default 600 seconds via `MCP_AGENT_TIMEOUT`). The timeout SHALL apply to the entire HTTP request lifecycle including connection and stream consumption.

#### Scenario: Request completes within timeout
- **WHEN** a tool call completes in 30 seconds with a 600s timeout
- **THEN** the full response is returned normally

#### Scenario: Request exceeds timeout
- **WHEN** a tool call takes longer than the configured timeout
- **THEN** the HTTP connection is closed and the tool returns an error "Agent did not respond within {timeout}s"

### Requirement: Structured error responses
The MCP server SHALL return structured, actionable error messages for all failure modes instead of raw exceptions or tracebacks.

#### Scenario: Agent not running
- **WHEN** an MCP client calls any tool and the NAT endpoint is unreachable
- **THEN** the tool returns an error "Agent unreachable at {url}. Ensure the agent server is running."

#### Scenario: Agent returns HTTP 500
- **WHEN** the NAT endpoint returns HTTP 500 with body "Internal Server Error"
- **THEN** the tool returns an error "Agent returned HTTP 500: Internal Server Error"

#### Scenario: Agent returns HTTP 429
- **WHEN** the NAT endpoint returns HTTP 429
- **THEN** the tool returns an error "Agent returned HTTP 429: rate limited. Retry after a delay."

#### Scenario: Malformed SSE stream
- **WHEN** the SSE stream from NAT contains unparseable chunks
- **THEN** the tool returns partial content collected so far with a trailing note "[Stream interrupted: {error}]"

