## Context

The agent runs LangGraph graphs where state is a flat list of messages (`ToolCallAgentGraphState.messages`). Each iteration appends an `AIMessage` (reasoning + tool calls) and one or more `ToolMessage` (tool results). After 30 iterations the state holds ~90 messages; tool outputs like `directory_tree` or file reads can be thousands of characters each, inflating every subsequent LLM call.

Current compaction (`working.py: prepare_messages_with_summary`) fires only at request boundaries (before the graph starts), using the mode's reasoning LLM (devstral). Inside the graph loop there is no compression. The `SafeToolCallAgentGraph` overrides `ToolCallAgentGraph` from NAT and controls the `agent_node`, giving us the right hook point without touching NAT internals.

## Goals / Non-Goals

**Goals:**
- Compress LangGraph state mid-loop before it degrades LLM quality
- Use kimi_reader as the dedicated summary LLM, decoupled from the reasoning LLM
- Trigger compaction based on content size (chars), not fixed iteration count
- Preserve correctness: user message, recent messages, and error messages are never evicted
- Add config fields for threshold tuning without code changes

**Non-Goals:**
- Compacting state inside subagents (NAT's `ToolCallAgentGraph` is not extensible here)
- Token-accurate counting (char-based estimate is sufficient and cheap)
- Changing the between-request compaction behavior in `working.py`

## Decisions

### D1 — Trigger: char-based size estimate, not iteration count

**Decision**: Compact when `sum(len(str(m.content)) for m in state.messages) > char_threshold` (default: 40_000 chars).

**Why**: Tool outputs vary 10x in size. `directory_tree` on ART returns ~8k chars; `read_text_file` on a large module returns ~15k. A fixed iteration counter (e.g., "every 15 steps") misfires — it compacts too early on lightweight tasks and too late on file-heavy ones. A secondary message count guard (`> 30 messages`) catches edge cases where many small messages accumulate.

**Alternatives considered**: Token counting via tiktoken — more accurate but adds a dependency and ~5ms overhead per call. Not worth it for a heuristic trigger.

### D2 — Hook point: inside `SafeToolCallAgentGraph.agent_node`

**Decision**: In `agent_node`, before `self.agent.ainvoke(...)`, call `maybe_compact_state(state, summary_llm)`.

**Why**: `SafeToolCallAgentGraph` already overrides `agent_node` for tool normalization, deduplication, and loop guard logic. Adding compaction here is consistent with existing patterns and fires at the right moment — before the LLM sees the full state, not after.

**Alternatives considered**: A dedicated "compress" graph node with a conditional edge from agent_node. Adds graph complexity and an extra LangGraph step per compaction event. Overkill for what is essentially a pre-processing step.

### D3 — What to preserve vs. compact

**Decision**:
- **Always preserve**: first message (user task), last `retain_recent` messages (default: 8), any `ToolMessage` with `status="error"`
- **Compact**: all `AIMessage` entries in the evictable window, all `ToolMessage` entries with `status="ok"` or no status in the evictable window

**Why**: The user's original task message is the anchor — losing it means the LLM loses its goal. Recent messages provide immediate context for the next tool call. Error messages must survive so the LLM doesn't repeat failed approaches.

### D4 — Summary LLM: kimi_reader, injected at construction time

**Decision**: `SafeToolCallAgentGraph` receives an optional `summary_llm` parameter. In `safe_tool_calling_agent.py`, the builder fetches `kimi_reader` (already configured) and passes it to the graph constructor.

**Why**: Devstral costs ~5x more than kimi_reader per token. Summaries are compression tasks — they don't require deep reasoning. Kimi's 4k output limit is sufficient for 400-token summaries.

**Config path**: `memory.yml → working.summary_llm_name: kimi_reader`. The wiring reads this field at startup in `_build_mode_runtime`.

### D5 — Cooldown: minimum messages between compactions

**Decision**: After a compaction, do not compact again until at least `cooldown_messages` new messages have been added (default: 10). Track via a counter on the graph instance.

**Why**: Without cooldown, compaction could trigger on every agent_node call if the state stays near threshold after compaction (e.g., due to one large tool result). Cooldown prevents pathological re-compaction.

## Risks / Trade-offs

**[Risk] Summary loses a critical intermediate finding** → Mitigation: The summary prompt explicitly instructs to preserve all tool-backed findings, file paths, error messages, and decisions. Findings that matter should also be persisted via `persist_findings` by the orchestrator — compaction is not a substitute for explicit persistence.

**[Risk] kimi_reader API latency adds overhead to each compaction** → Mitigation: Compaction is infrequent (cooldown + threshold guards). Expected frequency: once per 10-15 iterations in heavy tasks. At 1-2s per summary call, overhead is acceptable relative to a 60-iteration session.

**[Risk] Char-based trigger fires inconsistently across repos** → Mitigation: Both triggers (char threshold AND message count) must pass. Threshold is configurable in memory.yml without code changes.

**[Risk] Breaking existing test fixtures that mock agent_node** → Mitigation: `summary_llm` defaults to `None`; if None, compaction is skipped entirely. Existing tests don't pass a summary LLM and are unaffected.

## Migration Plan

1. Deploy with `summary_llm_name: kimi_reader` in memory.yml and default thresholds
2. Monitor `tool_output_truncated` and new `context_compacted` trace events to validate trigger frequency
3. If compaction fires too aggressively, raise `compaction_char_threshold` in memory.yml
4. No rollback required — if `summary_llm` is None or compaction fails, agent continues without compaction (graceful degradation already in working.py pattern)

## Open Questions

- Should the summary be injected as a `system` message or an `assistant` message? Current between-request compaction uses `assistant` role with `[Context Summary]:` prefix. Consistent to follow the same pattern.
- Should `retain_recent` be per-mode (e.g., larger for refactor than for analyze)? Start with a global default; make it per-mode only if evaluation shows a need.
