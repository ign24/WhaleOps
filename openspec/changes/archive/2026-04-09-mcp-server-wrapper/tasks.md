## 1. Dependencies and Project Setup

- [x] 1.1 Add `mcp[cli]` and `httpx` dependencies to pyproject.toml
- [x] 1.2 Add `mcp-server` script entry point to pyproject.toml `[project.scripts]`
- [x] 1.3 Run `uv sync` to install new dependencies

## 2. Core Bridge Module

- [x] 2.1 Create `src/cognitive_code_agent/mcp_server.py` with FastMCP server instance, env var config (MCP_AGENT_URL, MCP_AGENT_TIMEOUT, MCP_MAX_OUTPUT_CHARS, MCP_TRANSPORT, MCP_PORT), and logging setup
- [x] 2.2 Implement `_call_agent(prompt: str) -> str` -- POST to NAT `/chat/stream`, consume SSE stream, concatenate chunks, enforce timeout via `httpx.Timeout`, truncate at MAX_OUTPUT_CHARS with marker
- [x] 2.3 Implement structured error handling in `_call_agent`: connection errors -> "Agent unreachable at {url}", HTTP errors -> "Agent returned HTTP {status}: {body}", timeout -> "Agent did not respond within {timeout}s", stream parse errors -> partial content + "[Stream interrupted: {error}]"
- [x] 2.4 Implement `analyze_code(prompt: str, context: str | None) -> str` MCP tool -- prefix `/analyze`, inject context, call `_call_agent`
- [x] 2.5 Implement `execute_task(prompt: str, context: str | None) -> str` MCP tool -- prefix `/execute`, inject context, call `_call_agent`
- [x] 2.6 Implement `agent_chat(prompt: str) -> str` MCP tool -- no mode prefix, call `_call_agent`
- [x] 2.7 Add startup health check (5s timeout, log warning if unreachable, don't block)
- [x] 2.8 Add `main()` entry point with argparse for `--transport` and `--port` (CLI flags override env vars)

## 3. Tests

- [x] 3.1 Unit tests for `_call_agent`: mock httpx responses for success, truncation at limit, timeout, connection error, HTTP 500, HTTP 429, malformed SSE
- [x] 3.2 Unit tests for tool functions: verify prompt prefixing (`/analyze`, `/execute`, no prefix), context injection, context omission when None
- [x] 3.3 Unit test for startup health check: reachable vs unreachable (verify logging, no crash)
- [x] 3.4 Integration test: start MCP server in stdio mode, call each tool via MCP client SDK, verify end-to-end flow with mocked NAT endpoint

## 4. Docker and Config

- [x] 4.1 Add optional `mcp-server` service to docker-compose.yml (depends_on agent, MCP_AGENT_URL=http://agent:8000, MCP_TRANSPORT=streamable-http, expose 3100)
- [x] 4.2 Add Claude Code MCP config snippet to README (stdio mode: `{"command": "uv", "args": ["run", "mcp-server"]}`)
