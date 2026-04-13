## ADDED Requirements

### Requirement: Temperature preset applied to LLM at build time
The system SHALL apply the resolved temperature value from `TEMPERATURE_PRESETS` to the LLM instance via `llm.bind(temperature=value)` during runtime pre-compilation in `_build_mode_runtime()`.

#### Scenario: Low temperature preset produces LLM with temperature 0.1
- **WHEN** a runtime is built with `temp_override=0.1` (preset "low")
- **THEN** the returned `_ModeRuntime.llm` SHALL have `temperature=0.1` in its bound kwargs

#### Scenario: Medium temperature preset produces LLM with temperature 0.3
- **WHEN** a runtime is built with `temp_override=0.3` (preset "medium")
- **THEN** the returned `_ModeRuntime.llm` SHALL have `temperature=0.3` in its bound kwargs

#### Scenario: High temperature preset produces LLM with temperature 0.7
- **WHEN** a runtime is built with `temp_override=0.7` (preset "high")
- **THEN** the returned `_ModeRuntime.llm` SHALL have `temperature=0.7` in its bound kwargs

### Requirement: Bound LLM supports tool calling
The system SHALL ensure that the `RunnableBinding` returned by `llm.bind()` works correctly with `SafeToolCallAgentGraph` for tool calling, streaming, and all Runnable protocols.

#### Scenario: Tool calling works with bound LLM
- **WHEN** a `SafeToolCallAgentGraph` is built with a bound LLM (via `.bind(temperature=X)`)
- **THEN** the graph SHALL execute tool calls without errors, identical to an unbound LLM

### Requirement: temp_override flows from _build_and_register to _build_mode_runtime
The function `_build_and_register()` SHALL pass its `temp_override` parameter through to `_build_mode_runtime()` so the temperature value reaches the LLM binding step.

#### Scenario: _build_and_register passes temp_override
- **WHEN** `_build_and_register()` is called with `temp_override=0.7`
- **THEN** `_build_mode_runtime()` SHALL receive `temp_override=0.7` and apply it via `llm.bind()`
