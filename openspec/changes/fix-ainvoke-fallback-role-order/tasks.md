## 1. RED — failing tests for the invariant

- [x] 1.1 Add `test_recovery_invoke_state_preserves_leading_system_messages` asserting no SystemMessage appears after a non-SystemMessage when the input starts with `[SystemMessage, SystemMessage, HumanMessage, AIMessage]`.
- [x] 1.2 Add `test_synthesis_invoke_state_preserves_leading_system_messages` with the equivalent assertion for `_build_synthesis_invoke_state`.
- [x] 1.3 Add `test_recovery_invoke_state_context_message_follows_system_block` asserting the `[Recovery Context` carrier is present and positioned after the system block.
- [x] 1.4 Add `test_synthesis_invoke_state_context_message_follows_system_block` asserting the `[Synthesis` carrier is present and positioned after the system block.
- [x] 1.5 Add `test_recovery_invoke_state_no_system_messages_still_works` asserting backward compatibility when no `SystemMessage` is supplied (carrier remains first).
- [x] 1.6 Add `test_sanitize_message_role_order_drops_mid_list_system_messages` asserting the sanitizer relocates mid-list `SystemMessage`s to the head and preserves counts.
- [x] 1.7 Add `test_sanitize_message_role_order_is_idempotent` asserting two applications yield the same result.
- [x] 1.8 Update `test_recovery_invoke_state_trims_trailing_tool_messages` to assert the invariant (no system after non-system) instead of `isinstance(state.messages[0], AIMessage)`, while keeping the trailing-`ToolMessage` assertion.
- [x] 1.9 Run the new tests and confirm they fail (RED) with a combination of `AssertionError: SystemMessage appeared after a non-system message` and `ImportError: cannot import name '_sanitize_message_role_order'`.

## 2. GREEN — implement the fix

- [x] 2.1 Add `from langchain_core.messages import SystemMessage` to `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` imports.
- [ ] 2.2 Implement `_sanitize_message_role_order(messages: list[BaseMessage]) -> list[BaseMessage]` as a pure, idempotent O(n) partition that returns `[*all_system_in_order, *all_non_system_in_order]`. Place it immediately before `_format_structured_partial_response` (above line 444) so the builders that follow can reference it.
- [ ] 2.3 Rewrite `_build_recovery_invoke_state` body so that after trimming trailing `ToolMessage`s and handling the empty-input seed, it (a) extracts the leading `SystemMessage` prefix from `sanitized`, (b) builds the `recovery_context` `AIMessage` unchanged, (c) returns `_sanitize_message_role_order([*leading_system, recovery_context, *suffix])`.
- [ ] 2.4 Rewrite `_build_synthesis_invoke_state` body with the same shape: extract the leading `SystemMessage` prefix, keep the `synthesis_msg` `AIMessage` and `cfg` dict unchanged, return `(ToolCallAgentGraphState(messages=_sanitize_message_role_order([*leading_system, synthesis_msg, *suffix])), cfg)`.
- [ ] 2.5 Confirm the recovery-context content still starts with the substring `[Recovery Context` and the synthesis-context content still starts with `[Synthesis Context` so downstream callers and tests that search by substring keep working.
- [ ] 2.6 Run the unit tests for the two builders and the sanitizer and confirm they pass (GREEN).

## 3. Regression suite & lint

- [ ] 3.1 Run the full `tests/unit/test_safe_tool_calling_agent.py` module and confirm every test passes (including every unchanged recovery / synthesis / ainvoke-retry / degraded-probe test).
- [ ] 3.2 Run `uv run ruff check src/cognitive_code_agent/agents/safe_tool_calling_agent.py tests/unit/test_safe_tool_calling_agent.py` and fix any lint issues introduced.
- [ ] 3.3 Run `uv run ruff format --check src/cognitive_code_agent/agents/safe_tool_calling_agent.py tests/unit/test_safe_tool_calling_agent.py` and reformat if needed.
- [ ] 3.4 Run `uv run pytest -x -q` (full unit suite) and confirm no collateral failures.

## 4. OpenSpec validation & archive prep

- [ ] 4.1 Run `openspec validate fix-ainvoke-fallback-role-order` (or the project-local validator) and fix any spec-format issues.
- [ ] 4.2 Run `openspec status --change fix-ainvoke-fallback-role-order` and confirm the change reports `isComplete: true` or all `applyRequires` as done.
- [ ] 4.3 Stop short of archiving — archive is a separate step after user review of the landed code.
