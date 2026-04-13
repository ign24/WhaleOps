## 1. Config Layer

- [x] 1.1 Add `summary_llm_name: str | None = None` field to `WorkingMemoryConfig` in `memory/__init__.py`
- [x] 1.2 Raise `summary_max_tokens` default from `200` to `400` in `WorkingMemoryConfig`
- [x] 1.3 Add compaction config fields to `WorkingMemoryConfig`: `compaction_char_threshold: int = 40000`, `compaction_message_threshold: int = 30`, `compaction_retain_recent: int = 8`, `compaction_cooldown_messages: int = 10`
- [x] 1.4 Update `memory.yml` with new fields: `summary_llm_name: kimi_reader`, `summary_max_tokens: 400`, and all four compaction thresholds with their defaults

## 2. Working Memory — Compaction Logic

- [x] 2.1 Add `should_compact(state, config: WorkingMemoryConfig) -> bool` to `working.py` — returns True when char threshold OR message count threshold is exceeded
- [x] 2.2 Add `compress_state(state, llm, config: WorkingMemoryConfig) -> ToolCallAgentGraphState` to `working.py` — evicts non-critical messages, calls `summarize_evicted_messages()`, returns new state with `[Context Summary]:` block
- [x] 2.3 Ensure `compress_state` always preserves: first message, last `retain_recent` messages, and any `ToolMessage` with `status="error"`
- [x] 2.4 Ensure `compress_state` is non-fatal: on LLM exception, log warning and return original state unchanged

## 3. Agent Wiring

- [x] 3.1 Add `summary_llm` optional parameter to `SafeToolCallAgentGraph.__init__()` in `safe_tool_calling_agent.py`, defaulting to `None`
- [x] 3.2 Add `_compaction_cooldown_counter: int` instance attribute to `SafeToolCallAgentGraph` to track messages since last compaction
- [x] 3.3 In `SafeToolCallAgentGraph.agent_node`, call `maybe_compact_state()` before `self.agent.ainvoke()` — checks cooldown, calls `should_compact` + `compress_state` if triggered, resets cooldown counter
- [x] 3.4 Emit `context_compacted` trace event on successful compaction (messages_before, messages_after, chars_before)

## 4. Startup Wiring

- [x] 4.1 In `safe_tool_calling_agent_workflow`, after loading memory config, resolve `summary_llm` via `builder.get_llm(memory_config.working.summary_llm_name)` if set — wrap in try/except, default to `None` on failure
- [x] 4.2 Pass resolved `summary_llm` to `SafeToolCallAgentGraph` constructor in `_build_mode_runtime`

## 5. Tests

- [x] 5.1 Unit test `should_compact()`: verify fires on char threshold, message count threshold, and is suppressed during cooldown
- [x] 5.2 Unit test `compress_state()`: verify user message preserved, last 8 messages preserved, error ToolMessages preserved, evicted messages replaced by `[Context Summary]:` block
- [x] 5.3 Unit test `compress_state()` failure path: LLM raises exception → original state returned unchanged
- [x] 5.4 Unit test `WorkingMemoryConfig` new fields: defaults correct, fields read from dict correctly
- [x] 5.5 Integration test: run `SafeToolCallAgentGraph` with a mock summary LLM and a state that exceeds threshold — verify compaction fires and trace event emitted
