## Why

The cognitive code agent runs as a NAT FastAPI server on port 8000, but it can only be consumed via its proprietary HTTP API. Exposing it as an MCP server lets any MCP-compatible client (Claude Code, Cursor, Windsurf, other agents) use it as a tool provider without custom HTTP integration. The agent already consumes MCP servers (fs_tools, github_tools, context7) -- becoming one itself closes the loop and makes it composable in multi-agent workflows.

### Alternatives Evaluated

1. **NAT native MCP server** (`nvidia-nat-mcp==1.4.1`, `nat mcp serve`): NAT ships a built-in MCP frontend plugin. Audit revealed it is prototype-grade: zero timeout handling on tool execution, full stream buffered in memory without size limits, no tests, hardcoded concurrency limit of 8 with no visibility, and no observability hooks. A hung workflow blocks a slot forever. Not production-solid.

2. **LangChain/LangGraph native**: No general-purpose "agent to MCP server" library exists. `langchain-mcp-adapters` goes the opposite direction (MCP server -> LangChain tool). LangSmith Platform auto-exposes MCP endpoints but requires SaaS deployment.

3. **Custom FastMCP wrapper** (chosen): ~200-300 lines of code we fully control. Uses `mcp` SDK already installed (v1.26.0). HTTP bridge to existing endpoint with explicit timeouts, output truncation, and error handling. Simplest option that meets production robustness requirements.

## What Changes

- Add a FastMCP server module that bridges MCP tool calls to the existing NAT `/chat/stream` endpoint
- Expose three MCP tools mapping to agent modes: `analyze_code`, `execute_task`, `agent_chat`
- Support stdio and Streamable HTTP transports for flexibility (local dev vs networked)
- Add a CLI entry point (`uv run mcp-server`) and optional Docker Compose service
- Hardened with: configurable timeouts (default 600s), output truncation (100K chars), structured error responses, startup health check
- No changes to the existing agent server, NAT framework, or tool internals

## Capabilities

### New Capabilities
- `mcp-bridge-tools`: MCP tool definitions that translate tool calls into NAT ChatRequest messages and return agent responses as tool results. Includes timeout enforcement, output truncation, and structured error handling.
- `mcp-transport`: Server transport configuration supporting stdio and Streamable HTTP, with connection to the backing NAT agent endpoint. Includes startup health check and CLI entry point.

### Modified Capabilities

None. The existing agent server remains unchanged.

## Impact

- **New dependency**: `mcp[cli]` (FastMCP Python SDK), `httpx` (async HTTP client)
- **New files**: MCP server module (~200-300 lines), entry point script
- **Docker**: Optional new service in docker-compose for MCP server process
- **Existing code**: Zero modifications to agent internals, tools, or NAT integration
- **API surface**: New MCP protocol surface (tools listing, tool execution) backed by existing HTTP API
