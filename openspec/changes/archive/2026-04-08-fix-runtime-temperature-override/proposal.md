## Why

Frontend temperature presets (low/medium/high) are sent to the backend but never applied to the LLM. The `_build_and_register()` function receives `temp_override` but both code branches produce identical `ModeConfig` — the temperature value is discarded. `builder.get_llm()` reads from `config.yml` which hardcodes `temperature: 0.3` for all models. Result: 3 cached runtimes per (mode, model) with different cache keys but identical LLM instances all using temperature 0.3.

## What Changes

- Apply `llm.bind(temperature=temp_override)` after `builder.get_llm()` in `_build_mode_runtime()` so each temperature preset produces an LLM with the correct temperature value.
- Pass `temp_override` from `_build_and_register()` through to `_build_mode_runtime()`.
- Add unit tests verifying that different temperature presets result in distinct LLM temperature values.

## Capabilities

### New Capabilities
- `runtime-temperature-bind`: Apply temperature overrides to pre-compiled LLM runtimes using LangChain's `BaseChatModel.bind()` mechanism.

### Modified Capabilities

## Impact

- **Code**: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — `_build_mode_runtime()` and `_build_and_register()` functions.
- **Dependencies**: No new dependencies. Uses existing `BaseChatModel.bind()` from LangChain (already a dependency via `langchain_nvidia_ai_endpoints.ChatNVIDIA`).
- **APIs**: No API changes. Frontend already sends `temperature_preset`; backend already reads it and selects the correct cache key. The only change is that the cached runtime now actually uses the correct temperature.
- **Risk**: Low. `bind()` returns a `RunnableBinding` that wraps the original LLM transparently. Tool calling and streaming are unaffected.
