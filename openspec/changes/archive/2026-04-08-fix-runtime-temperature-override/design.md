## Context

The agent backend pre-compiles LangGraph runtimes at startup for every combination of `(mode, model, temperature_preset)`. The cache key correctly differentiates presets, but `_build_mode_runtime()` calls `builder.get_llm(llm_name)` which reads hardcoded values from `config.yml`. The `temp_override` parameter in `_build_and_register()` is received but never forwarded — both branches of the conditional produce identical `ModeConfig` without any temperature field.

`ChatNVIDIA` extends LangChain's `BaseChatModel`, which supports `.bind(**kwargs)` to produce a `RunnableBinding` that merges kwargs into every invocation. This is the standard LangChain mechanism for per-call parameter overrides.

## Goals / Non-Goals

**Goals:**
- Make temperature presets (low=0.1, medium=0.3, high=0.7) actually apply to the LLM at runtime
- Minimal code change — no NAT framework modifications, no new dependencies
- Maintain existing cache key structure and runtime selection logic

**Non-Goals:**
- Exposing arbitrary per-request parameters (top_p, max_tokens) from the frontend — future work
- Changing the frontend UI or API contract — both already work correctly
- Reducing runtime count or changing the pre-compilation strategy

## Decisions

### 1. Use `llm.bind(temperature=X)` after `builder.get_llm()`

**Rationale**: `BaseChatModel.bind()` is the idiomatic LangChain way to override model parameters without re-instantiating the client. It returns a `RunnableBinding` that is fully transparent to the graph — tool calling, streaming, and all Runnable protocols work unchanged.

**Alternative considered**: Modifying `NIMModelConfig` before passing to `builder.get_llm()`. Rejected because `builder.get_llm()` takes only `(llm_name, wrapper_type)` and reads config internally — there's no way to pass overrides without modifying NAT internals.

**Alternative considered**: Creating separate LLM entries in `config.yml` for each temperature (e.g., `devstral_low`, `devstral_high`). Rejected because it multiplies config entries by 3x and doesn't scale if more presets are added.

### 2. Apply bind in `_build_mode_runtime()`, not at request time

**Rationale**: The existing architecture pre-compiles separate runtimes per temperature preset. Applying `.bind()` during build keeps the pattern consistent — each cached runtime is fully self-contained. No request-time logic changes needed.

**Alternative considered**: Single runtime per (mode, model), apply `.bind()` per-request. More efficient in memory but requires restructuring the graph invocation path and testing that `RunnableBinding` works correctly when swapped at call time. Deferred as a separate optimization.

## Risks / Trade-offs

- **[RunnableBinding compatibility]** → `SafeToolCallAgentGraph` receives the LLM in its constructor and passes it to LangGraph nodes. `RunnableBinding` implements all `Runnable` protocols identically. Mitigated by unit test verifying tool calls work with a bound LLM.
- **[Temperature override vs config.yml]** → The bound temperature overrides `config.yml` values. This is the desired behavior — config.yml provides defaults, presets provide user choice. The precedence is clear: preset > config.
