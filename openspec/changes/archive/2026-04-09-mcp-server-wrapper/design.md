## Context

The cognitive code agent runs on NVIDIA NAT 1.4.1, serving a FastAPI endpoint at `POST /chat/stream` that accepts `ChatRequest` (messages + optional mode prefix) and returns streaming `ChatResponseChunk`s. The agent has 4 modes (analyze, execute, refactor, chat), each with its own LangGraph runtime, tool set, and LLM configuration.

The agent already consumes 4 MCP servers as tool providers (fs_tools, github_tools, context7_tools, fs_tools_write). Exposing the agent itself as an MCP server makes it composable in multi-agent setups where a host (Claude Code, Cursor, or another orchestrator) can invoke it as a tool.

### Alternatives Evaluated

**NAT native MCP server** (`nat mcp serve`, `MCPFrontEndPlugin`): Audit of the source code in `nat.plugins.mcp.server` revealed:
- `tool_converter.py` calls `runner.result()` which buffers the entire stream in memory with no size limit. A large analysis response can OOM the process.
- Zero `asyncio.timeout()` anywhere in the tool execution path. A hung workflow blocks a concurrency slot permanently.
- Hardcoded `max_concurrency=8` not configurable from `MCPFrontEndConfig`. Slot exhaustion has no visibility.
- No test coverage in the MCP server module.
- Exception handling at line 191-199 re-raises raw Python tracebacks to MCP clients instead of structured errors.
- Verdict: good for lab/demo, not for sustained use.

**LangChain ecosystem**: `langchain-mcp-adapters` converts MCP servers into LangChain tools (opposite direction). LangSmith Platform auto-exposes MCP but requires SaaS. No local agent-to-MCP-server solution exists.

**Custom FastMCP wrapper** (chosen): Minimal code, full control over the gaps NAT leaves open.

## Goals / Non-Goals

**Goals:**
- Expose agent modes as MCP tools callable by any MCP-compatible client
- Support stdio transport (for local IDE integration) and Streamable HTTP (for networked use)
- Production-solid: explicit timeouts, output truncation, structured errors, health check
- Keep the wrapper thin -- protocol translation + hardening, no business logic
- Zero changes to existing agent code

**Non-Goals:**
- Exposing individual agent tools (shell_execute, clone_repository, etc.) as separate MCP tools
- Replacing the existing FastAPI server
- Adding authentication or multi-tenancy (reverse proxy for networked deployments)
- Streaming partial results via MCP (MCP tool results are atomic; stream internally, return complete)

## Decisions

### D1: FastMCP as the MCP SDK

Use `mcp[cli]` (FastMCP) -- the official Python MCP SDK, already installed at v1.26.0. Handles protocol framing, transport negotiation, and tool schema generation from type hints.

**Alternative**: Raw JSONRPC implementation. Rejected -- unnecessary boilerplate.
**Alternative**: NAT's `MCPFrontEndPlugin`. Rejected -- lacks timeout/truncation/error handling (see Context).

### D2: HTTP client bridge (not in-process import)

The MCP server calls the NAT agent via `httpx.AsyncClient` to `http://localhost:8000/chat/stream`. This keeps the MCP process fully decoupled from NAT's runtime, memory, and LangGraph state.

**Alternative**: Importing the workflow function directly. Rejected -- requires NAT's `Builder`, config loading, and LangGraph graph compilation. The HTTP boundary is the clean cut.

### D3: Three tools mapping to agent modes

| MCP Tool | Agent Mode | Use Case |
|---|---|---|
| `analyze_code` | `/analyze` | Read-only code analysis, QA, security review |
| `execute_task` | `/execute` | Code generation, refactoring, test writing |
| `agent_chat` | `/chat` | General conversation, clarifications |

Each tool accepts a `prompt` string parameter (mandatory) and an optional `context` string for additional background. The tool prefixes the prompt with the mode command (e.g., `/analyze <prompt>`) before forwarding to NAT.

**Alternative**: Single `ask_agent` tool with a `mode` parameter. Rejected -- distinct tools give MCP clients better schema information for tool selection.

### D4: Collect full response with timeout and truncation

MCP tool results are atomic (no streaming). The bridge:
1. POSTs to `/chat/stream` with `httpx.AsyncClient(timeout=httpx.Timeout(MCP_AGENT_TIMEOUT))`
2. Consumes the SSE stream, concatenating content chunks
3. Truncates at `MAX_OUTPUT_CHARS` (default 100,000) with a trailing `[Response truncated at 100K characters]` note
4. Returns the complete text as the tool result

On timeout: returns structured error `"Agent did not respond within {timeout}s"`.
On connection error: returns `"Agent unreachable at {url}"`.
On HTTP error: returns `"Agent returned HTTP {status}: {body}"`.

### D5: Entry points

- **stdio**: `uv run mcp-server` -- for IDE integration (Claude Code, Cursor config)
- **HTTP**: `uv run mcp-server --transport streamable-http --port 3100` -- for networked/Docker use
- **Docker Compose**: Optional service `mcp-server` that depends on the `agent` service

### D6: Configuration via environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_AGENT_URL` | `http://localhost:8000` | NAT agent base URL |
| `MCP_AGENT_TIMEOUT` | `600` | Request timeout in seconds |
| `MCP_MAX_OUTPUT_CHARS` | `100000` | Max response chars before truncation |
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `streamable-http` |
| `MCP_PORT` | `3100` | Port for Streamable HTTP transport |

No config file -- env vars are sufficient for a bridge this thin.

## Risks / Trade-offs

- **[Latency]** Full response collection adds wall-clock latency vs streaming. Mitigation: unavoidable with current MCP spec; future MCP streaming support would resolve this.
- **[Single point of failure]** MCP server depends on NAT agent being up. Mitigation: startup health check logs warning; tool calls return clear error if agent unreachable.
- **[Large responses]** Agent can produce very long analysis output. Mitigation: hard truncation at MAX_OUTPUT_CHARS with explicit marker.
- **[No auth]** MCP server has no authentication. Mitigation: acceptable for local/dev use; document reverse proxy for networked deployments.
- **[Timeout too short]** Complex multi-step analysis can exceed 600s. Mitigation: configurable via env var; document per-deployment tuning.
