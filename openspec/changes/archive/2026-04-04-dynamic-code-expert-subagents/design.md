## Context

The agent currently has two layers of subagents:
1. **reader_agent** — a `tool_calling_agent` that wraps `fs_tools` with kimi_reader (max_iterations=6, recursion_limit=14). It adds no reasoning value and bottlenecks any task requiring file exploration.
2. **Domain agents** (security_agent, qa_agent, review_agent, docs_agent) — fixed-role specialists hardcoded in config.yml with pre-selected tools and prompts. They cannot be composed, run in parallel only if the orchestrator plans it explicitly, and their role boundaries cause misrouting (orchestrator sends planning tasks to reader_agent).

With mid-loop compaction already implemented, the orchestrator's loop can handle large file outputs without context overflow. The original justification for reader_agent (protect orchestrator context) no longer applies.

## Goals / Non-Goals

**Goals:**
- Remove reader_agent; give orchestrator direct `fs_tools` access in its own loop
- Replace fixed domain agents with a `spawn_agent` tool that creates ephemeral code-expert agents at runtime
- Enable parallel subagent execution naturally (orchestrator calls spawn_agent N times in one parallel batch)
- Spawned agents specialize via skills (not hardcoded prompts) and can access any tool from a per-mode allowlist
- Spawned agents get mid-loop compaction so they can run long exploration loops without hitting limits

**Non-Goals:**
- Recursive spawn (spawned agents cannot spawn further agents)
- Changing the skill registry format or skill content
- Modifying the 4 existing domain agent prompt files (they become skills or are retired separately)

## Decisions

### 1. spawn_agent as a Python tool class, not a function_group entry

**Decision:** `spawn_agent` is implemented as a custom `SpawnAgentTool` Python class registered at startup — not as a YAML `function_groups` entry.

**Why:** Dynamic agent construction requires access to the builder and tool registry at call time. The existing `_type: tool_calling_agent` YAML pattern builds agents once at startup. A Python class can hold the builder reference and construct a new `SafeToolCallAgentGraph` on each invocation.

**Alternative considered:** Registering spawn_agent as a NAT function_group with a special `_type: spawn_agent`. Rejected — would require changes to NAT internals.

### 2. Tool allowlist per mode in config.yml

**Decision:** Each mode defines a `spawn_agent_allowed_tools` list. The orchestrator can only request tools from this list when calling spawn_agent. Requests for unlisted tools are silently filtered.

**Why:** Prevents privilege escalation. An analyze-mode orchestrator should not be able to spawn an agent with write capabilities.

```yaml
# Example in config.yml
modes:
  analyze:
    spawn_agent_allowed_tools:
      - fs_tools
      - github_tools
      - context7_tools
      - run_semgrep
      - run_trivy
      - run_gitleaks
      - run_bandit
      - run_ruff
      - run_eslint
      - run_pytest
      - analyze_complexity
      - check_readme
      - analyze_docstrings
      - analyze_api_docs
      - analyze_test_coverage
  refactor:
    spawn_agent_allowed_tools:
      - fs_tools
      - fs_tools_write
      - github_tools
      - context7_tools
      - run_ruff
      - run_eslint
      - run_pytest
      - code_gen
      - refactor_gen
```

### 3. Spawned agents choose their own skills autonomously

**Decision:** All spawned agents are code experts with access to the full skill registry. They load skills autonomously based on the task — the orchestrator does NOT prescribe which skills to use.

**Why:** Skills already codify domain expertise (security-review, senior-qa, code-reviewer, technical-writer, etc.). A spawned agent told to "audit security" will identify and load security-review on its own. Letting the agent self-select prevents the orchestrator from needing to know the skill names, which keeps spawn_agent simpler and lets agents adapt to unexpected task requirements mid-execution.

**Skill loading mechanism:** The spawned agent's system prompt includes the full skill registry menu and instruction: "Load any skills you need using the `load_skill` instruction. Choose based on what the task actually requires." It can load up to `max_active_skills` skills (configurable, e.g. 3 for spawned agents vs 2 for orchestrator).

### 4. spawn_agent signature

```python
async def spawn_agent(
    task: str,
    tools: list[str],
    max_iterations: int = 20,
) -> str
```

- `task`: The full task description (analogous to the old subagent input_message)
- `tools`: Tool names to give the agent (filtered against mode allowlist)
- `max_iterations`: Cap for this specific agent (default 20; orchestrator can increase for heavy tasks)
- Returns: The agent's final text response as a string

Skills are not a parameter — the spawned agent loads them autonomously from the registry.

### 5. Parallel execution via standard parallel tool calls

**Decision:** No special `spawn_agents_parallel` wrapper. The orchestrator calls `spawn_agent` multiple times in a single parallel tool call batch (LangGraph already supports this).

**Why:** Adding a wrapper adds complexity with no benefit. The LLM can already generate N parallel tool calls in one step.

### 6. Compaction for spawned agents

**Decision:** Spawned agents get the same `summary_llm` (kimi_reader) and compaction config as the orchestrator, with lower thresholds appropriate for short-lived agents.

```yaml
spawn_agent:
  compaction_char_threshold: 20000   # tighter than orchestrator's 40000
  compaction_message_threshold: 15   # tighter than orchestrator's 30
  compaction_retain_recent: 5
  compaction_cooldown_messages: 5
```

### 7. No recursion prevention needed for spawn depth

**Decision:** Spawned agents do not receive `spawn_agent` in their tool list — enforced by the allowlist (spawn_agent is never in `spawn_agent_allowed_tools`).

## Risks / Trade-offs

- **LLM must correctly choose tools and skills** — the orchestrator prompt must clearly explain how to use spawn_agent; without guidance the LLM may spawn agents with wrong tools. Mitigation: update analyze.md and refactor.md with explicit examples.
- **Startup cost** — all tools in `spawn_agent_allowed_tools` must be pre-built at startup so spawn_agent can select from them. This means no reduction in startup time vs the old fixed agents. Mitigation: acceptable trade-off.
- **Harder to trace** — spawned agents appear as tool calls rather than named subagents in traces. Mitigation: include `task` and `tools` in the trace event payload.
- **Skill selection quality** — the spawned agent must correctly identify which skills to load. If the task description is vague, it may load the wrong skills. Mitigation: the orchestrator should write precise task descriptions; the spawned agent's base prompt says "load skills before doing the work, not after".

## Migration Plan

1. Implement `SpawnAgentTool` and wire it into startup — both `spawn_agent` and old subagents coexist temporarily
2. Add `fs_tools` to analyze mode tool list
3. Remove reader_agent from all modes and config
4. Update analyze.md and refactor.md delegation strategy
5. Remove domain agent function_group entries from config.yml
6. Run integration tests end-to-end before declaring done

Rollback: revert config.yml and prompt changes; all code is additive until the removal step.

## Open Questions

- Should spawned agents emit their own trace events, or should the spawn_agent tool emit a wrapper event? (Lean: wrapper event with task + tools + final response length)
- Should `skills` be optional with smart defaults based on tool selection? (e.g., if tools include run_semgrep → auto-suggest security-review) — post-MVP enhancement.
