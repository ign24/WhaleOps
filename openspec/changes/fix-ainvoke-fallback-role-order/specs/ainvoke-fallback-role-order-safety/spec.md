## ADDED Requirements

### Requirement: Recovery and synthesis invoke states SHALL preserve leading SystemMessages at the head

`_build_recovery_invoke_state` and `_build_synthesis_invoke_state` SHALL NOT place any non-`SystemMessage` before a `SystemMessage` in the returned `ToolCallAgentGraphState.messages`. All `SystemMessage`s present in the caller-supplied `messages` list SHALL remain at the head of the returned list, in their original relative order, so OpenAI-compatible providers (NIM, etc.) do not reject the request with `Unexpected role 'system' after role 'assistant'`.

#### Scenario: recovery state with leading SystemMessages keeps them at the head
- **WHEN** `_build_recovery_invoke_state` is called with a message list whose first N elements are `SystemMessage` instances and whose remaining elements include `HumanMessage` and `AIMessage`
- **THEN** the returned state's `messages` list SHALL begin with those same N `SystemMessage` instances in the same relative order
- **AND** no `SystemMessage` SHALL appear after any non-`SystemMessage` in the returned list

#### Scenario: synthesis state with leading SystemMessages keeps them at the head
- **WHEN** `_build_synthesis_invoke_state` is called with a message list whose first N elements are `SystemMessage` instances and whose remaining elements include `HumanMessage` and `AIMessage`
- **THEN** the returned state's `messages` list SHALL begin with those same N `SystemMessage` instances in the same relative order
- **AND** no `SystemMessage` SHALL appear after any non-`SystemMessage` in the returned list

#### Scenario: recovery state with no SystemMessages keeps carrier at the head
- **WHEN** `_build_recovery_invoke_state` is called with a message list that contains no `SystemMessage`
- **THEN** the returned state's first message SHALL be the recovery context carrier
- **AND** the invariant "no system after non-system" SHALL trivially hold

#### Scenario: synthesis state with no SystemMessages keeps carrier at the head
- **WHEN** `_build_synthesis_invoke_state` is called with a message list that contains no `SystemMessage`
- **THEN** the returned state's first message SHALL be the synthesis instruction carrier
- **AND** the invariant "no system after non-system" SHALL trivially hold

### Requirement: Recovery and synthesis carriers SHALL be injected after the system block

When the caller-supplied `messages` contain leading `SystemMessage`s, the recovery context carrier (in `_build_recovery_invoke_state`) and the synthesis instruction carrier (in `_build_synthesis_invoke_state`) SHALL be inserted immediately after the last leading `SystemMessage` and before the first non-`SystemMessage`. The carrier SHALL remain present — it is never dropped — and its content format SHALL remain backward-compatible with the existing `[Recovery Context …]` and `[Synthesis Context …]` prefixes so downstream consumers and tests can locate it.

#### Scenario: recovery carrier sits between system block and first non-system message
- **WHEN** `_build_recovery_invoke_state` is called with `[SystemMessage, HumanMessage, AIMessage]`
- **THEN** the returned messages SHALL be `[SystemMessage, <recovery carrier>, HumanMessage, AIMessage]`
- **AND** the recovery carrier's content SHALL contain the substring `[Recovery Context`

#### Scenario: synthesis carrier sits between system block and first non-system message
- **WHEN** `_build_synthesis_invoke_state` is called with `[SystemMessage, HumanMessage, AIMessage]`
- **THEN** the returned messages SHALL be `[SystemMessage, <synthesis carrier>, HumanMessage, AIMessage]`
- **AND** the synthesis carrier's content SHALL contain the substring `[Synthesis`

### Requirement: Trailing ToolMessages SHALL still be trimmed before ainvoke

Both builders SHALL continue to remove dangling trailing `ToolMessage`s from the caller-supplied list before constructing the invoke state, so provider serialization edge cases for orphan tool results are not reintroduced alongside the role-order fix.

#### Scenario: recovery state trims a trailing ToolMessage
- **WHEN** `_build_recovery_invoke_state` is called with a list ending in a `ToolMessage`
- **THEN** the returned state's last message SHALL NOT be a `ToolMessage`

#### Scenario: synthesis state trims a trailing ToolMessage
- **WHEN** `_build_synthesis_invoke_state` is called with a list ending in a `ToolMessage`
- **THEN** the returned state's last message SHALL NOT be a `ToolMessage`

### Requirement: A module-level helper SHALL enforce the role-order invariant defensively

`safe_tool_calling_agent.py` SHALL expose a module-level function `_sanitize_message_role_order(messages)` that returns a new list in which every `SystemMessage` has been moved to the head (preserving relative order among `SystemMessage`s and among non-`SystemMessage`s), so that future code paths that touch fallback state cannot reintroduce the provider role-order rejection by accident. `_build_recovery_invoke_state` and `_build_synthesis_invoke_state` SHALL apply this sanitizer to their output before returning.

#### Scenario: sanitizer relocates a mid-list SystemMessage
- **WHEN** `_sanitize_message_role_order` is called with `[SystemMessage, HumanMessage, AIMessage, SystemMessage, HumanMessage]`
- **THEN** the returned list SHALL contain both `SystemMessage`s at indices 0 and 1 (in their original relative order)
- **AND** the non-`SystemMessage`s SHALL follow in their original relative order

#### Scenario: sanitizer is idempotent
- **WHEN** `_sanitize_message_role_order` is called twice on the same input
- **THEN** the two outputs SHALL contain the same message types in the same order and the same content

#### Scenario: sanitizer preserves every message
- **WHEN** `_sanitize_message_role_order` is called with any list of `BaseMessage`
- **THEN** the returned list SHALL contain exactly the same set of message instances (same length, same contents), only reordered so that all `SystemMessage`s precede all non-`SystemMessage`s
