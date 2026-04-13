## Why

The ainvoke fallback path silently dies with HTTP 400 `Unexpected role 'system' after role 'assistant'` every time streaming fails and recovery activates. The user never sees real partial output — only the generic "Execution budget was exhausted… Ainvoke fallback failed" template. This masks a fixable bug as a budget problem and blocks the single retry path that was supposed to salvage the run.

Root cause: `_build_recovery_invoke_state` and `_build_synthesis_invoke_state` in `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` prepend an `AIMessage` carrier in front of the existing history. That history always begins with one or more `SystemMessage`s (base prompt, active-skills block, memory context block). The resulting order `[AIMessage, SystemMessage, ..., HumanMessage, ...]` has a `system` after an `assistant`, which NIM and other OpenAI-compatible providers reject. Every stream→fallback transition hits this.

## What Changes

- Preserve leading `SystemMessage`s at the head of the recovery/synthesis invoke state — inject the carrier (recovery context or synthesis instruction) AFTER the system block, not before it.
- Add `_sanitize_message_role_order(messages)` helper that relocates any mid-list `SystemMessage` to the head so the invariant "no system after a non-system" holds for any future code path that touches fallback state.
- Apply the sanitizer defensively in both builders before returning the state.
- Preserve existing trimming of trailing `ToolMessage`s and the empty-input fallback seeds.
- Existing tests that assumed the first element was an `AIMessage` are updated to assert the invariant instead (no system after non-system), which is the real contract.

No behavior change when the original history has zero `SystemMessage`s — the carrier remains first and the original trailing sequence is preserved.

## Capabilities

### New Capabilities
- `ainvoke-fallback-role-order-safety`: Role-order invariants the recovery and synthesis invoke states SHALL satisfy before being passed to `rt.graph.ainvoke`, and the helper contract that enforces them.

### Modified Capabilities
- None. Existing specs (`ainvoke-recursion-limit-synthesis`, `ainvoke-server-error-retry`, `deterministic-fallback-policy`, `structured-partial-response-contract`) keep their current requirements; the new capability layers an additional invariant on top of the state builders they already depend on.

## Impact

- **Code**: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — import `SystemMessage`, add `_sanitize_message_role_order`, rewrite `_build_recovery_invoke_state` and `_build_synthesis_invoke_state` to split leading system messages and inject the carrier after them.
- **Tests**: `tests/unit/test_safe_tool_calling_agent.py` — 7 new RED tests asserting role-order invariants + sanitizer contract; updated `test_recovery_invoke_state_trims_trailing_tool_messages` to assert the invariant instead of first-element identity.
- **Dependencies**: None. Uses `langchain_core.messages.SystemMessage` already available.
- **Runtime**: Fix is hot-path for every recovery. Expected effect: users stop seeing the budget-exhausted template on transient stream failures, and the ainvoke fallback actually returns partial synthesis content as designed.
- **Risk surface**: Narrow. The sanitizer only reorders `SystemMessage` instances; it never drops content or reorders non-system messages.
