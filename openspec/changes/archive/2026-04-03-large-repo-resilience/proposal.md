## Why

The agent fails silently on large repositories. Live production logs confirmed that `directory_tree` on a real repo (ARGENDATA) returned 227,546 tokens — exceeding DeepSeek V3.2's 163,840 context limit. The streaming path crashes and falls back to `ainvoke` with a degraded, near-empty response. The user sees a bad answer without knowing why.

Secondary: token counting uses word count (not real LLM tokens), so there is zero visibility into actual cost or context saturation. This blocks any data-driven decision about multi-agent evolution.

## What Changes

- Harden `directory_tree` usage: prompt guidance to always use `excludePatterns` for `.git`, `node_modules`, `__pycache__`, `.venv`, `dist`, `build`; reinforce `reader_agent` as the primary exploration tool.
- Add tool output truncation as a safety net in the agent graph: cap tool responses before they enter the LLM context, preventing context overflow regardless of which tool produces large output.
- Capture real token usage from `AIMessage.response_metadata.usage_metadata` instead of word-count approximation.
- Log structured context-overflow events to JSONL traces when `GraphRecursionError` or context-exceeded errors occur, so they become visible and measurable.

## Capabilities

### New Capabilities
- `tool-output-guard`: Configurable truncation and overflow detection layer that sits between tool outputs and the LLM context. Prevents any single tool response from exceeding a token budget. Logs truncation events.
- `real-token-metrics`: Capture actual prompt/completion token counts from LLM response metadata per turn and per session. Expose via structured trace events.

### Modified Capabilities
- `working-memory-summarization`: Add awareness of tool output size before appending to state. Current spec only covers message eviction summarization; this extends it with a pre-append size guard.

## Impact

- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — token counting fix (lines 790-797), tool output guard integration, structured overflow logging
- `src/cognitive_code_agent/prompts/system/analyze.md` — directory_tree usage guidance, reader_agent reinforcement
- `src/cognitive_code_agent/prompts/system/refactor.md` — directory_tree usage guidance
- `src/cognitive_code_agent/configs/config.yml` — possible new config section for guard thresholds
- `openspec/specs/working-memory-summarization/spec.md` — delta spec for pre-append size guard
- JSONL trace format — new event types for context overflow and token metrics
