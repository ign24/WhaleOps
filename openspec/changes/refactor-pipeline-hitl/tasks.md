## 1. Mode Consolidation (refactor + execute → execute)

- [x] 1.1 Remove `refactor` mode from `config.yml`, merge its tools into `execute` mode config (llm_name: devstral, all tools combined, max_iterations: 40)
- [x] 1.2 Update `VALID_MODES` in `safe_tool_calling_agent.py` from `("analyze", "refactor", "execute")` to `("analyze", "execute")`
- [x] 1.3 Update `resolve_mode()` to alias `/refactor` to `execute` with deprecation notice in response
- [x] 1.4 Write new `execute.md` prompt merging refactor.md workflow (code writing, validation) with execute.md ops (git, shell, github, reports). Remove autonomous UNDERSTAND/PLAN phases — execute loads plan from findings.
- [x] 1.5 Delete `refactor.md` prompt file
- [x] 1.6 Update `refactoring.md` skill: replace references to refactor mode with execute mode, remove UNDERSTAND/PLAN phases, add plan-loading as first step

## 2. Structured Plan Handoff

- [x] 2.1 Define plan JSON schema in `findings_store.py` — validation function for `finding_type: "refactoring_plan"` ensuring required fields (plan_version, stack, goals, files, execution_order)
- [x] 2.2 Update `analyze.md` prompt output contract to produce a `refactoring_plan` finding when actionable code changes are identified
- [x] 2.3 Add `query_findings` convenience: when `finding_type="refactoring_plan"` is passed, return the most recent plan for the repo (sorted by `created_at` desc, limit 1)
- [x] 2.4 Write unit tests for plan schema validation and plan query retrieval

## 3. Checkpointer Integration

- [x] 3.1 Add `hitl_enabled`, `checkpointer_backend`, `interrupt_timeout_seconds` fields to `ModeConfig` dataclass and `config.yml` (execute: hitl_enabled=true, analyze: hitl_enabled=false)
- [x] 3.2 Override `_build_graph()` in `SafeToolCallAgentGraph` to accept and pass checkpointer to `graph.compile(checkpointer=...)`. When `hitl_enabled=false`, pass `checkpointer=None`.
- [x] 3.3 Create checkpointer in `_build_mode_runtime` based on `checkpointer_backend` config (memory → MemorySaver, sqlite → SqliteSaver)
- [x] 3.4 Generate per-request `thread_id` (UUID) and pass it through LangGraph config `{"configurable": {"thread_id": uuid}}` on every `astream`/`ainvoke` call
- [ ] 3.5 Write integration test: compile graph with MemorySaver checkpointer, verify `interrupt()` pauses and `Command(resume=...)` resumes

## 4. Write Tool Interrupt Gate

- [ ] 4.1 Add `interrupt()` call inside `write_file` tool function — payload: action, path, preview (500 chars), size. Gate only when `hitl_enabled` context is true.
- [ ] 4.2 Add `interrupt()` call inside `edit_file` tool function — same payload pattern
- [ ] 4.3 Handle rejection: when user rejects or timeout occurs, return structured rejection message to agent (not an exception)
- [ ] 4.4 Write unit tests: mock interrupt to verify payload shape, test approve path, reject path, timeout path

## 5. Analyze Write Guard

- [x] 5.1 Add `_apply_write_mode_guard()` function in `safe_tool_calling_agent.py` — checks mode against `READ_ONLY_MODES`, blocks write tools with non-terminating error ToolMessage
- [x] 5.2 Call `_apply_write_mode_guard()` in `tool_node` before existing guards (parallel cap, loop guard, total limit)
- [x] 5.3 Emit `"write_mode_guard"` trace event when a write is blocked
- [x] 5.4 Write unit tests: verify write blocked in analyze mode, verify write passes in execute mode, verify read tools unaffected

## 6. Interrupt-to-WebSocket Bridge

- [ ] 6.1 Detect interrupt events during `astream` — when graph yields an interrupt payload, extract it and stop streaming
- [ ] 6.2 Emit `system_interaction_message` via WebSocket with interrupt payload formatted as `binary_choice` (Approve/Reject options, timeout from config)
- [ ] 6.3 Receive `user_interaction_message` response and call `graph.invoke(Command(resume={"action": response_value}), config)` to resume
- [ ] 6.4 Handle timeout: if no user response within `interrupt_timeout_seconds`, auto-reject and resume graph with rejection
- [ ] 6.5 Write integration test: simulate interrupt → WebSocket message → resume flow

## 7. Fallback Policy Updates

- [x] 7.1 Add `HITL_TIMEOUT` to `FailureClass` enum with policy: `retryable=False, partial_finalize=False, action="skip_and_continue"`
- [x] 7.2 Add `WRITE_DENIED` to `FailureClass` enum with policy: `retryable=False, partial_finalize=False, action="replan_without_write"`
- [x] 7.3 Add `RATE_LIMITED` to `FailureClass` enum with policy: `retryable=True, partial_finalize=True, action="exponential_backoff_retry"`
- [x] 7.4 Update `_classify_failure()` to detect 429/rate limit errors and classify as `RATE_LIMITED`
- [x] 7.5 Implement exponential backoff retry logic for `RATE_LIMITED` (base 2s, max 30s, max 2 attempts)
- [x] 7.6 Write unit tests for new failure classes and classification

## 8. Cleanup and Validation

- [x] 8.1 Remove all `refactor` mode references from codebase (grep for "refactor" in config, routing, prompts, tests)
- [x] 8.2 Update existing tests that reference refactor mode to use execute mode
- [x] 8.3 Run full test suite — all existing tests must pass with mode consolidation
- [x] 8.4 Run linter and type checks on all modified files
