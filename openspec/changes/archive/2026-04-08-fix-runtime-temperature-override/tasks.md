## 1. Core Fix

- [x] 1.1 Add `temp_override: float | None = None` parameter to `_build_mode_runtime()` and apply `llm = llm.bind(temperature=temp_override)` after `builder.get_llm()` when not None
- [x] 1.2 Pass `temp_override` from `_build_and_register()` through to `_build_mode_runtime()` call

## 2. Tests

- [x] 2.1 Unit test: verify that runtimes built with different temperature presets produce LLMs with distinct temperature values in their bound kwargs
- [x] 2.2 Unit test: verify that a bound LLM (via `.bind(temperature=X)`) is accepted by `SafeToolCallAgentGraph` without errors

## 3. Verification

- [x] 3.1 Run full test suite (`uv run pytest -x`) and confirm no regressions
