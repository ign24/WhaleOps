## Context

The agent runs on NVIDIA NAT 1.4.1 + LangGraph 1.0.10. Tool outputs are appended directly to `ToolCallAgentGraphState.messages` with no size check. A single `directory_tree` call on a medium-large repo (ARGENDATA) produced 227k tokens — 39% over DeepSeek V3.2's 163k context window. The streaming path throws `BadRequestError`, falls back to `ainvoke` with a degraded response, and the user never knows.

Token counting in the usage chunk (lines 790-797 of `safe_tool_calling_agent.py`) uses `len(str(msg.content).split())` — word count, not tokens. Real usage data is available in `AIMessage.response_metadata` but discarded.

`GraphRecursionError` is caught (line 815) but only logged as a warning — no structured trace event is emitted, making it invisible in the JSONL traces used by the judge evaluator.

## Goals / Non-Goals

**Goals:**
- Prevent context overflow from any tool output, regardless of tool
- Capture real LLM token counts per turn from response metadata
- Make context overflows and truncation events visible in JSONL traces
- Guide the agent to use `excludePatterns` on `directory_tree` and prefer `reader_agent` for repo exploration
- All changes backward-compatible — no new infra required

**Non-Goals:**
- Multi-agent orchestration (Proposal 2)
- Parallel tool execution / async subprocess (separate change)
- Redis Stack installation for episodic memory (separate change)
- Dashboard or alerting (requires metrics first)
- Changes to the LangGraph graph structure or NAT framework

## Decisions

### D1: Tool Output Guard as post-tool-node interceptor

**Choice:** Add a `_guard_tool_outputs()` function that runs after `tool_node()` in `SafeToolCallAgentGraph`, inspecting each `ToolMessage` and truncating content that exceeds a configurable `max_tool_output_chars` threshold.

**Why over alternatives:**
- *Wrapper per tool* — would require modifying every tool; fragile, doesn't catch MCP tools.
- *LangGraph middleware* — NAT's graph build path doesn't expose easy middleware hooks.
- *Pre-LLM guard in agent_node* — too late; the message is already in state.
- Post-tool-node intercept is a single point of control, catches all tools (custom + MCP), and is testable in isolation.

**Default threshold:** 30,000 characters (~7,500 tokens). Configurable via `config.yml` under `workflow.tool_output_guard.max_chars`. When truncated, append `\n\n[OUTPUT TRUNCATED: {removed:,} chars removed. Use targeted queries for details.]`.

### D2: Real token capture from AIMessage metadata

**Choice:** After each `agent_node` call, extract `usage_metadata` from the last `AIMessage` in state and accumulate per-session totals. Replace the word-count estimation at the end of the response with the accumulated real values.

**Why:** The LLM already returns `prompt_tokens`, `completion_tokens`, `total_tokens` in `response_metadata`. The data flows through and gets discarded. Zero cost to capture.

**Fallback:** If `usage_metadata` is absent (streaming path doesn't always include it), fall back to the existing word-count approximation. Log a debug message when falling back.

### D3: Structured trace events for overflow and truncation

**Choice:** Emit structured JSON events to the NAT file tracer for:
- `tool_output_truncated` — when the guard fires (tool name, original chars, truncated chars)
- `context_overflow` — when `BadRequestError` with "context length" is caught, or `GraphRecursionError` fires
- `session_token_usage` — at session end, accumulated real token counts by model

**Why:** The JSONL trace is the only observability surface. The judge evaluator (`run_judge_from_traces.py`) already parses these files. Adding structured events makes overflow visible without new infra.

### D4: Prompt-level guidance for directory_tree and reader_agent

**Choice:** Add explicit instructions to `analyze.md` and `refactor.md`:
1. When calling `directory_tree`, ALWAYS include `excludePatterns: [".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".next", ".tox", "vendor"]`
2. For repository overview (Phase 0), use `reader_agent` — not direct `fs_tools` calls
3. Prefer `list_directory` + targeted `read_text_file` over full `directory_tree` on large repos

**Why over code-level enforcement:** The `directory_tree` tool is an MCP server tool — we can't modify its behavior server-side without forking the package. Prompt guidance is the fastest and most maintainable approach. The tool output guard (D1) acts as a safety net if the agent ignores the guidance.

## Risks / Trade-offs

- **[Truncation loses information]** → Mitigated by: (a) 30k chars is generous for most tools, (b) truncation message tells the agent to use targeted queries, (c) threshold is configurable.
- **[Agent may still ignore prompt guidance]** → Mitigated by: the tool output guard catches overflow regardless of agent behavior. Prompt guidance reduces frequency; guard prevents damage.
- **[Token capture may be incomplete in streaming path]** → Mitigated by: fallback to word-count, accumulate from non-streaming turns where metadata is always present.
- **[Trace event format may need evolution]** → Start with simple JSON objects. The judge parser can be extended to consume them later.
