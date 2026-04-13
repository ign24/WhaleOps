## Why

The current subagent architecture uses fixed-role specialists (security_agent, qa_agent, review_agent, docs_agent, reader_agent) that create bottlenecks: reader_agent wraps fs_tools with an LLM that adds no value but imposes a recursion_limit=14 ceiling; domain agents are hardcoded and can't be composed for cross-domain tasks; and parallelism is limited to what the orchestrator can predict upfront. As the agent moves toward longer autonomous runs (analyze + refactor + execute in a single session), the fixed topology creates more friction than it solves.

## What Changes

- **BREAKING** Remove `reader_agent` from all modes (analyze, refactor, qa_agent, security_agent) — replaced by direct `fs_tools` access in the orchestrator loop
- **BREAKING** Remove fixed domain subagents (security_agent, qa_agent, review_agent, docs_agent) from the global function_groups — replaced by a `spawn_agent` tool that creates ephemeral code-expert agents on demand
- Add `spawn_agent` tool: accepts a task description, a tools subset (from a per-mode allowlist), and an optional skill list — builds and runs a `SafeToolCallAgentGraph` instance and returns its output
- Spawned agents are all code experts (same base competency) that specialize via skills; they can load any skill from the registry based on the task
- The orchestrator can call `spawn_agent` multiple times in a single parallel batch — enabling concurrent QA + security + docs analysis without sequential coordination
- Add `fs_tools` (read-only) directly to the analyze mode tool list
- Keep `fs_tools_write` in refactor mode (already direct)

## Capabilities

### New Capabilities

- `spawn-agent-tool`: Runtime creation of ephemeral code-expert subagents with configurable tools and skills
- `orchestrator-direct-fs-access`: Orchestrator reads files in its own loop without going through a subagent intermediary

### Modified Capabilities

- `skill-budget-control`: Spawned agents access the full skill registry autonomously — the orchestrator no longer controls skill selection for subagents

## Impact

- `src/cognitive_code_agent/tools/` — new `spawn_agent.py` tool implementation
- `src/cognitive_code_agent/configs/config.yml` — remove reader_agent and domain agents from function_groups and mode tool lists; add spawn_agent; add fs_tools to analyze mode
- `src/cognitive_code_agent/prompts/system/analyze.md` — remove reader_agent delegation guidance; update delegation strategy for spawn_agent
- `src/cognitive_code_agent/prompts/system/refactor.md` — remove reader_agent references
- `tests/` — new unit + integration tests for spawn_agent tool
