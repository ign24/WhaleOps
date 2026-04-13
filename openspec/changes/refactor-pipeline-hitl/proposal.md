## Why

The agent has three execution modes (analyze, refactor, execute) but the separation is wrong. Refactor duplicates planning work that analyze already completed and executes destructive write operations without user confirmation. Execute is artificially limited to git/shell ops. The result: refactor re-discovers findings via semantic search and re-plans from scratch, while execute can't write code or run linters. Merging refactor and execute into a single `execute` mode that serves as analyze's "hands" — with LangGraph native `interrupt()` for human-in-the-loop write confirmation — fixes both problems.

## What Changes

- **Merge refactor + execute into a single `execute` mode.** It has all write tools (code_gen, refactor_gen, fs_tools_write), all validation tools (linters, test runners), all ops tools (shell, git, github), and HITL gating on destructive actions.
- **Remove `/refactor` mode entirely.** Two modes remain: `analyze` (read-only orchestrator) and `execute` (write + validate + operate).
- **Execute consumes a structured plan from analyze**, not free-text findings. Analyze persists a `refactoring_plan` artifact alongside findings. Execute loads it and runs step-by-step.
- **Write tools gain LangGraph `interrupt()` gate** that pauses graph execution and surfaces a confirmation prompt to the user via the existing `InteractionModal`.
- **`SafeToolCallAgentGraph._build_graph()` overridden** to inject a checkpointer, enabling `interrupt()`/`Command(resume=...)` state persistence.
- **Write tools blocked in analyze mode** via non-terminating deny in `tool_node`, extending the existing SafetyTier pattern.
- **Backend bridges interrupt events** to WebSocket `system_interaction_message` and resumes graph on user response.

## Capabilities

### New Capabilities
- `structured-plan-handoff`: Structured execution plan artifact persisted by analyze, consumed by execute without re-planning.
- `write-tool-interrupt-gate`: LangGraph `interrupt()` integration in write tools with UI confirmation via existing `InteractionModal`.
- `checkpointer-integration`: Checkpointer injection in `SafeToolCallAgentGraph` enabling graph pause/resume for HITL.
- `analyze-write-guard`: Non-terminating deny of write tools in analyze mode at `tool_node` level.

### Modified Capabilities
- `refactoring-skill`: Workflow changes from 5-phase (UNDERSTAND-PLAN-EXECUTE-VALIDATE-PERSIST) to 3-phase (LOAD_PLAN-EXECUTE-VALIDATE). Skill is now loaded in execute mode, not a standalone mode.
- `deterministic-fallback-policy`: Adds new failure classes for interrupt timeout and analyze-mode write denial.

## Impact

- **Backend**: `safe_tool_calling_agent.py` (checkpointer override, tool_node write guard, interrupt bridge, mode consolidation), `findings_store.py` (plan artifact schema), `safety.py` (write tool tier classification), write tool wrappers
- **Prompts**: `analyze.md` (output contract adds plan artifact), new `execute.md` (merges refactor.md + execute.md), `refactoring.md` skill (workflow aligned to execute mode). Delete `refactor.md`.
- **Config**: `config.yml` removes `refactor` mode, merges its tools into `execute`, adds `hitl_enabled`, `checkpointer_backend`, `interrupt_timeout_seconds`
- **Routing**: `resolve_mode()` and `VALID_MODES` updated — `/refactor` removed or aliased to `/execute`
- **UI**: No new components. Existing `InteractionModal` with `binary_choice` handles confirmation. WebSocket protocol already supports the message types.
- **Dependencies**: `langgraph-checkpoint==4.0.1` already installed. May need `langgraph-checkpoint-sqlite` for production.
