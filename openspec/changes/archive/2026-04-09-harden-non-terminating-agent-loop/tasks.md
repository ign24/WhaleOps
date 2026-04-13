## 1. Runtime non-terminating policy

- [x] 1.1 Refactor guardrail handling in `SafeToolCallAgentGraph.tool_node` so denied calls are always soft-fail and never terminate request processing
- [x] 1.2 Update loop-guard behavior to block only offending repeated calls while preserving execution of remaining valid calls in the same turn
- [x] 1.3 Ensure blocked-call tool messages include explicit replan/consolidation guidance instead of generic terminal-failure text

## 2. Global spawn budget enforcement

- [x] 2.1 Configure per-mode `max_tool_calls_per_request` limits including `spawn_agent` budget in `config.yml`
- [x] 2.2 Ensure `spawn_agent` over-budget behavior is surfaced as deterministic non-fatal tool denial and supports continuation/replanning
- [x] 2.3 Add trace coverage for budget-exhaustion decisions to support observability and tuning

## 3. Fallback and recovery hardening

- [x] 3.1 Harden fallback/recovery paths to handle heterogeneous message types (`AIMessage`, `ToolMessage`) without assuming `.tool_calls`
- [x] 3.2 Add deterministic degradation behavior when fallback logic fails internally, preserving structured partial finalization
- [x] 3.3 Add regression tests for the `ToolMessage` terminal-state case that previously triggered `'ToolMessage' object has no attribute 'tool_calls'`

## 4. Structured partial-response resilience

- [x] 4.1 Extend constrained-execution finalization so budget exhaustion emits stable `Verified/Unverified/Blocked By/Next Steps` sections
- [x] 4.2 Ensure constrained responses include explicit completed vs pending scope and remain machine-consumable
- [x] 4.3 Add tests validating stable section labels and non-generic fallback content under budget denials

## 5. Prompt and decomposition alignment

- [x] 5.1 Update analyze orchestration prompt guidance to require decomposition of broad multi-domain requests into phased subtasks
- [x] 5.2 Ensure prompt guidance states runtime budgets are authoritative and instructs consolidation when limits are reached
- [x] 5.3 Validate prompt/runtime consistency against updated loop and budget policy behavior

## 6. Verification and rollout checks

- [x] 6.1 Add/adjust unit tests for non-terminating guardrail behavior, spawn-budget soft denials, and fallback type safety
- [x] 6.2 Run project validation (`ruff`, targeted pytest suites) and fix any regressions introduced by policy changes
- [x] 6.3 Document operational tuning notes for spawn budget defaults and constrained-output expectations
