## Context

`src/cognitive_code_agent/agents/safe_tool_calling_agent.py` runs a LangGraph-based tool-calling agent against NIM (OpenAI-compatible). The happy path streams via `rt.graph.astream`. When that fails — recursion limit, tool timeout, server error, degraded function — the agent builds a recovery or synthesis invoke state and retries via `rt.graph.ainvoke`. Two helpers construct that state:

- `_build_recovery_invoke_state` — normal fallback, injects a `[Recovery Context …]` carrier and keeps the original messages.
- `_build_synthesis_invoke_state` — used after a stream recursion-limit failure, injects a `[Synthesis Context …]` carrier and caps `recursion_limit` at `_SYNTHESIS_RECURSION_LIMIT`.

Both helpers today return `[carrier_AIMessage, *sanitized_messages]`. The upstream pipeline guarantees that `state.messages` starts with one or more `SystemMessage` instances:

- The NAT prompt scaffolding seeds a base `SystemMessage` with the contents of `src/cognitive_code_agent/prompts/system/base.md`.
- `raw_messages.insert(0, {"role": "system", "content": active_skills_block})` at line 2185 of `safe_tool_calling_agent.py`.
- `raw_messages.insert(0, {"role": "system", "content": memory_block})` at line 2202.
- `trim_messages(..., include_system=True, start_on="human")` (line 2214) preserves that leading system block.

So the recovery/synthesis list becomes `[AIMessage, SystemMessage, SystemMessage, HumanMessage, …]`. NIM rejects it with HTTP 400 `Unexpected role 'system' after role 'assistant'`, the `except` branch classifies this as `UNKNOWN_RUNTIME`, the retry policy does not retry it, and the agent emits the `_format_structured_partial_response` template. The user sees "Execution budget was exhausted" with `Blocked By: Ainvoke fallback failed: [###] …`. The budget was not actually exhausted — the fallback was DOA due to a message-ordering bug.

Existing related specs: `ainvoke-recursion-limit-synthesis`, `ainvoke-server-error-retry`, `deterministic-fallback-policy`, `structured-partial-response-contract`. None of them currently express a role-order invariant, which is why this silently regressed.

## Goals / Non-Goals

**Goals:**
- Eliminate the `Unexpected role 'system' after role 'assistant'` class of 400s from the ainvoke fallback path without changing any other recovery behavior.
- Preserve existing guarantees of both builders: trailing `ToolMessage` trimming, empty-input seed fallback, carrier content prefixes (`[Recovery Context`, `[Synthesis`), cap on `_SYNTHESIS_RECURSION_LIMIT`.
- Add a defensive sanitizer so any future code path that composes fallback state inherits the invariant for free.
- Encode the invariant as a testable spec so regressions cannot ship silently.

**Non-Goals:**
- Changing how the upstream pipeline constructs the initial `SystemMessage` block (base prompt, skills, memory).
- Changing the failure-class taxonomy, retry policies, or the partial-response template.
- Reclassifying 400 role-order errors as retryable — we are making them not happen in the first place.
- Touching the `compress_state` / working-memory path. It already keeps `messages[0]` as the anchor and appends a summary `AIMessage`, which does not violate the invariant because the anchor is a `SystemMessage` in practice. Out of scope for this change.

## Decisions

### Decision 1: Preserve leading SystemMessages at the head, inject carrier after them

**Chosen:** Split the sanitized input into a prefix of leading `SystemMessage`s and a suffix of everything else, then return `[*leading_system, carrier, *suffix]`.

**Alternatives considered:**
- *Convert the carrier itself into a `SystemMessage`.* Rejected: the carrier content is labelled "informational, not instructions" specifically because an `AIMessage` is treated as the agent's own scratchpad, not as authoritative instructions. Promoting it to `SystemMessage` changes semantics and risks the model obeying the recovery breadcrumbs as rules.
- *Merge the carrier content into the existing leading `SystemMessage`.* Rejected: base-prompt content is large and shared; mutating it per-recovery invocation would require deep-copying and would conflate recovery telemetry with the agent's identity. Also breaks the carrier-lookup substring contract used by tests.
- *Drop the carrier entirely when a system block is present.* Rejected: callers rely on the carrier to pass failure labels and recovery notes to the model. Dropping it silently degrades the fallback behavior and the telemetry trail.

**Rationale:** Splitting the prefix is the minimal change that keeps every existing guarantee and only touches message ordering. The resulting list `[SystemMessage, SystemMessage, AIMessage(carrier), HumanMessage, AIMessage, …]` satisfies every ordering rule enforced by OpenAI-compatible providers: (1) no `system` after a non-`system`; (2) the first non-system message can be either `user` or `assistant` — providers accept both.

### Decision 2: Add `_sanitize_message_role_order` as a defensive net

**Chosen:** A pure, idempotent helper at module level that returns `[*all_system_messages_in_order, *all_non_system_messages_in_order]`. Both builders call it on their output before returning.

**Alternatives considered:**
- *Only fix the two builders, no helper.* Rejected: the failure is cheap to reintroduce — any future fallback path that composes a message list is a single misplaced insert away from the same 400. A module-level helper makes the invariant easy to enforce anywhere and cheap to test in isolation.
- *Raise on mid-list `SystemMessage` instead of relocating.* Rejected: raising inside a recovery path turns a mitigable ordering quirk into a hard crash during the one retry the user is counting on. Silently relocating is the safer default; telemetry can be added later if we care to observe it.

**Rationale:** The helper is ~5 lines, pure, and idempotent — cheap to maintain, cheap to test, and it encodes the invariant as code rather than as a reviewer's mental checklist.

### Decision 3: Update the legacy `test_recovery_invoke_state_trims_trailing_tool_messages` to assert the invariant, not first-element identity

**Chosen:** The existing test asserts `isinstance(state.messages[0], AIMessage)`, which encoded the old buggy behavior. Replace that assertion with the real invariant ("no system after non-system") while keeping the trailing-ToolMessage assertion intact.

**Rationale:** The first-element identity was never the contract — it was an accident of the prepend-at-zero implementation. Asserting the invariant prevents the test from drifting back to the buggy behavior.

## Risks / Trade-offs

- **[Risk]** Some path we have not audited already relies on `state.messages[0]` being the recovery carrier. → **Mitigation:** Grep confirmed only the single legacy test referenced `state.messages[0]` for identity. The degraded-probe path uses `_build_recovery_invoke_state` output only as input to `rt.graph.ainvoke`; downstream reads `_probe_state_out.messages[-1]`, not `[0]`. Same for the synthesis path at line 2543. Safe.
- **[Risk]** A provider might also reject `[SystemMessage, AIMessage, HumanMessage]` (assistant before first user). → **Mitigation:** NIM accepts this pattern; the synthesis invoke state has worked previously with assistant-leading non-system content when no explicit system block was passed through. If this surfaces in practice we can fall back to converting the carrier into a leading system note, but the evidence from the 400 error is clearly role-order, not assistant-before-user.
- **[Risk]** Sanitizer reorders already-well-formed lists unnecessarily. → **Mitigation:** The helper is idempotent and its output matches the input when the input is already sorted. Cheap O(n) partition. No observable effect.
- **[Trade-off]** The sanitizer accepts any `BaseMessage` subclass and only special-cases `SystemMessage`. Not a general-purpose role validator. That is intentional — the scope is the one class of 400 we are fixing, not a complete OpenAI role-order enforcement engine.

## Migration Plan

Single code landing, no runtime migration. The fix is a pure function-level change behind the existing `_build_recovery_invoke_state` / `_build_synthesis_invoke_state` call sites. No feature flag — the old behavior is strictly buggy and has no callers that want it.

**Rollback:** Revert the commit. Zero data or schema impact.

## Open Questions

None. The scope is mechanical and the contract is testable.
