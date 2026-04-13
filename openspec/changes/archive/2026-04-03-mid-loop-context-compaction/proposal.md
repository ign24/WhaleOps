## Why

Long-running agent requests (60+ iterations in the planned work mode) accumulate 90–180 messages in the LangGraph state with no compression, degrading LLM reasoning quality and inflating token costs on every subsequent call. The between-request compaction in `working.py` exists but fires only at request boundaries and uses the expensive devstral model for summaries.

## What Changes

- Add `compress_state()` function to `working.py` that compacts LangGraph state mid-loop, preserving the user message, error messages, and the last N recent messages while summarizing evicted tool results and intermediate reasoning
- Add `should_compact()` trigger logic based on message count threshold and total content size estimate (not fixed iteration count, since tool outputs vary wildly)
- Add `summary_llm_name` and `summary_max_tokens` fields to `WorkingMemoryConfig` so a dedicated lighter LLM (kimi_reader) can be used for summaries independently of the reasoning LLM
- Wire the compaction hook into `SafeToolCallAgentGraph.agent_node` in `safe_tool_calling_agent.py` — before each LLM call, check if compaction is needed and apply it
- Calibrate `memory.yml`: raise `summary_max_tokens` from 200 to 400, set `summary_llm_name: kimi_reader`

## Capabilities

### New Capabilities

- `mid-loop-compaction`: State compression triggered inside the LangGraph execution loop when message volume or content size exceeds configured thresholds, using a dedicated summary LLM
- `summary-llm-routing`: Dedicated LLM selection for summarization tasks, decoupled from the mode's reasoning LLM

### Modified Capabilities

- `working-memory-summarization`: Existing between-request eviction compaction gains `summary_llm_name` config field and increased `summary_max_tokens` default

## Impact

- `src/cognitive_code_agent/memory/working.py` — new `compress_state()` and `should_compact()` functions
- `src/cognitive_code_agent/memory/__init__.py` — `WorkingMemoryConfig` new fields: `summary_llm_name`, updated `summary_max_tokens` default
- `src/cognitive_code_agent/configs/memory.yml` — new config fields
- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — `SafeToolCallAgentGraph` constructor accepts `summary_llm`, `agent_node` calls compaction hook
- No API changes, no breaking changes to existing memory behavior (compaction is additive and opt-in via threshold config)
- Prerequisite for work-mode unification (analyze+refactor+execute merge) which targets 60-iteration requests
