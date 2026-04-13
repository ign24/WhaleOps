## Context

The agent currently has three execution modes plus chat:

| Mode | LLM | Purpose | Tools |
|---|---|---|---|
| analyze | devstral | Read-only orchestrator, spawns sub-agents | fs_tools, spawn_agent, clone_repository, github_tools |
| refactor | devstral | Code modification + validation | code_gen, refactor_gen, fs_tools_write, linters, tests, shell |
| execute | kimi_reader | Git ops, reports, PR creation | shell_execute, fs_tools_write, github_tools, query_findings |
| chat | kimi_reader | Conversational | query_findings, fs_tools |

Problems:
1. Refactor duplicates analyze's planning (UNDERSTAND+PLAN phases before any writing)
2. Execute is artificially limited — can't write code or run linters
3. Analyze→refactor handoff is lossy (vector search over individual findings, no structured plan)
4. Write tools have no user confirmation gate — `SafetyTier` only covers `shell_execute`
5. NAT's `_build_graph()` compiles without checkpointer, making LangGraph `interrupt()` unusable

After this change: two modes. Analyze thinks. Execute acts.

## Goals / Non-Goals

**Goals:**
- Merge refactor + execute into single `execute` mode with full tool access
- Execute consumes a structured plan from analyze, does not re-plan
- Write tools require user confirmation via LangGraph native `interrupt()`
- Write tools are blocked in analyze mode (defense in depth)
- Reuse existing `InteractionModal` UI and WebSocket protocol

**Non-Goals:**
- NeMo Guardrails integration (content filtering, not tool gating)
- Multi-user concurrent approval workflows
- Persistent checkpointing across server restarts (MemorySaver for MVP)
- Changing analyze mode's orchestration or spawn_agent behavior
- Batch approval UX ("approve all files") — future enhancement

## Decisions

### D1: Two modes, not three

**Decision:** Merge refactor and execute into `execute`. Remove `refactor` mode.

**Why:** Refactor and execute share the same fundamental need: write access. Separating "code writing" from "git/shell ops" forces users into an unnatural workflow. A single execute mode with all write tools (code_gen, refactor_gen, linters, tests, shell, git, github) is simpler and more capable.

**Execute mode config (merged):**
```yaml
execute:
  llm_name: devstral
  prompt_path: src/cognitive_code_agent/prompts/system/execute.md
  max_iterations: 40
  max_history: 8
  tool_call_timeout_seconds: 900
  hitl_enabled: true
  interrupt_timeout_seconds: 120
  tool_loop_guard_threshold: 2
  max_parallel_tool_calls: 3
  max_tool_calls_per_request:
    shell_execute: 8
    persist_findings: 1
  spawn_agent_allowed_tools:
    - fs_tools
    - fs_tools_write
    - context7_tools
    - run_ruff
    - run_eslint
    - run_pytest
    - run_jest
    - analyze_complexity
    - code_gen
    - refactor_gen
  tool_names:
    - code_gen
    - refactor_gen
    - fs_tools_write
    - run_ruff
    - run_eslint
    - run_pytest
    - run_jest
    - analyze_complexity
    - query_findings
    - persist_findings
    - shell_execute
    - github_tools
    - context7_tools
    - tavily_search
```

**Routing:** `/refactor` aliased to `/execute` for backward compatibility. `VALID_MODES` becomes `("analyze", "execute")`. Chat stays as tier-0 classified.

### D2: LangGraph `interrupt()` inside write tools

**Decision:** Call `interrupt()` inside `write_file` and `edit_file` tool functions. Not `refactor_gen` (generation, not persistence).

**Why:** `interrupt_before=["tool"]` at compile-time gates ALL tool calls including reads — too coarse. `interrupt()` inside specific tools gives per-tool granularity. Gate at the persistence point (write_file/edit_file), not the generation point (refactor_gen), so the user sees what will actually be written.

**Pattern:**
```python
from langgraph.types import interrupt

async def write_file(path: str, content: str) -> str:
    if _hitl_enabled():
        decision = interrupt({
            "action": "write_file",
            "path": path,
            "preview": content[:500],
            "size": len(content),
        })
        if decision.get("action") != "approve":
            return f"Write to {path} rejected by user."
    # ... actual write
```

**Configurable:** `hitl_enabled` per mode in config.yml. Analyze mode blocks writes entirely (different mechanism). Execute mode gates writes via interrupt. Chat mode has no write tools.

### D3: Checkpointer injection via `_build_graph` override

**Decision:** Override `_build_graph()` in `SafeToolCallAgentGraph` to pass checkpointer to `graph.compile()`.

**Why:** NAT's `DualNodeAgent._build_graph()` is 7 lines: build nodes, edges, compile. We copy it and add `checkpointer=self._checkpointer`. Minimally invasive — no monkey-patching.

```python
async def _build_graph(self, state_schema: type) -> CompiledStateGraph:
    graph = StateGraph(state_schema)
    graph.add_node("agent", self.agent_node)
    graph.add_node("tool", self.tool_node)
    graph.add_edge("tool", "agent")
    graph.add_conditional_edges(
        "agent", self.conditional_edge,
        {AgentDecision.TOOL: "tool", AgentDecision.END: "__end__"},
    )
    graph.set_entry_point("agent")
    self.graph = graph.compile(checkpointer=self._checkpointer)
    return self.graph
```

**Checkpointer creation:** In `_build_mode_runtime`, create checkpointer based on config:
```python
if mode_cfg.hitl_enabled:
    from langgraph.checkpoint.memory import MemorySaver
    checkpointer = MemorySaver()
else:
    checkpointer = None
```

### D4: Structured plan handoff

**Decision:** Analyze persists a `finding_type: "refactoring_plan"` in existing Milvus collection. Execute queries by type to load it.

**Why:** Reuses `persist_findings`/`query_findings` infrastructure. No new collection needed.

**Plan schema (JSON in `summary` field):**
```json
{
  "plan_version": 1,
  "stack": "python",
  "goals": ["P0: fix type errors", "P1: extract service layer"],
  "files": [
    {
      "path": "src/auth/service.py",
      "priority": "P0",
      "changes": "Extract login logic from route handler into AuthService class",
      "validation": "run_ruff && run_pytest"
    }
  ],
  "execution_order": ["src/auth/service.py", "src/auth/routes.py"],
  "constraints": "Preserve existing API response shapes"
}
```

**Execute prompt loads plan first:**
```
1. LOAD: query_findings(finding_type="refactoring_plan") to get the execution plan.
   If no plan exists, ask user for explicit instructions or switch to freeform mode.
2. EXECUTE: Process files in execution_order. For each: read, generate, write (HITL gate), validate.
3. VALIDATE: Run validation command per file. If fails, retry with error context (max 2).
4. PERSIST: Save outcomes with finding_type "execution-outcome".
```

### D5: Interrupt bridge to WebSocket

**Decision:** Detect interrupt during `astream`, emit `system_interaction_message`, wait for `user_interaction_message`, resume with `Command`.

**Flow:**
```
astream(state, config) yields interrupt event
  → detect: event contains __interrupt__ key
  → emit WebSocket system_interaction_message:
      {
        type: "system_interaction_message",
        content: {
          input_type: "binary_choice",
          text: "Approve writing src/auth/service.py?",
          options: [
            {id: "approve", label: "Approve", value: "approve"},
            {id: "reject", label: "Reject", value: "reject"}
          ],
          timeout: 120
        },
        thread_id: config.thread_id
      }
  → await user_interaction_message from WebSocket
  → graph.invoke(Command(resume={"action": response}), config)
  → resume streaming remaining output
```

**thread_id:** Generated per request (UUID). Passed in LangGraph config as `{"configurable": {"thread_id": uuid}}`.

### D6: Write guard in analyze mode

**Decision:** Non-terminating deny in `tool_node` for write tools when mode is `analyze`.

**Implementation:** New function `_apply_write_mode_guard()` called in `tool_node` before existing guards:
```python
WRITE_TOOL_NAMES = {"write_file", "edit_file", "create_directory"}
READ_ONLY_MODES = {"analyze"}

def _apply_write_mode_guard(state, mode_name):
    if mode_name not in READ_ONLY_MODES:
        return 0
    blocked = 0
    for msg in _pending_tool_calls(state):
        if msg.name in WRITE_TOOL_NAMES:
            # Replace with error ToolMessage (non-terminating)
            blocked += 1
    return blocked
```

### D7: Interrupt timeout — auto-reject

**Decision:** Auto-reject after `interrupt_timeout_seconds` (default: 120s). Safe default — no write without explicit consent.

**Why:** Graph cannot hang indefinitely. Auto-reject means the agent receives "rejected by timeout" and continues with next file or finalizes partial output. UI already has countdown timer in `InteractionModal`.

## Risks / Trade-offs

**[Risk] NAT upgrade breaks `_build_graph` override** → Pin NAT version. Override is 7 lines + 1 param. Add integration test verifying compile with checkpointer.

**[Risk] Per-file confirmation is tedious for large refactors** → Accepted for safety. Future: batch approval mode not in scope.

**[Risk] MemorySaver loses state on crash during interrupt** → Acceptable for MVP. Write didn't happen = no corruption. SqliteSaver upgrade path is straightforward.

**[Risk] `/refactor` alias could confuse users** → Alias emits a deprecation notice in response: "Note: /refactor is now /execute. Proceeding in execute mode."

**[Risk] Merged execute mode has too many tools for a single LLM** → Mitigated by spawn_agent delegation for specialized tasks. Execute orchestrates, spawned agents handle domain-specific work. Tool budget limits prevent runaway calls.

**[Trade-off] Devstral for execute instead of kimi_reader** → Necessary. Code generation requires a capable model. kimi_reader was only sufficient for git ops. Cost increase is justified by eliminating the refactor↔execute context switch.

## Open Questions

1. Should rejected writes be persisted as findings for audit trail?
2. Should execute support a "freeform" sub-mode when no plan exists (user gives direct instructions without prior analyze)?
