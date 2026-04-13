## Why

The analyze and refactor modes expose 23 and 22 tools respectively to a single LLM, causing poor tool selection, hallucinations, duplicate tool calls, and responses that read back the system prompt. The root cause is architectural: one monolithic agent tries to be security auditor, QA engineer, code reviewer, and technical writer simultaneously, with all tool schemas competing in the same context window. The skill injection system compounds this by adding 200-500 lines of prompt text per skill. The fix is to replace the monolithic modes with a lean orchestrator that delegates to focused sub-agents — each with 3-4 tools and a domain-specific 20-line prompt.

## What Changes

- **New**: 4 specialized `tool_calling_agent` sub-agents in `config.yml`: `security_agent`, `qa_agent`, `review_agent`, `docs_agent`
- **New**: 4 focused system prompts (~20 lines each): `security_agent.md`, `qa_agent.md`, `review_agent.md`, `docs_agent.md`
- **Modified**: `analyze` mode — reduced from 22 tool names to 8 (the 4 new sub-agents + reader_agent + clone_repository + persist_findings + query_findings); orchestrator prompt rewritten to ~30 lines
- **Modified**: `refactor` mode — `fs_tools_write` stays but `context7_tools` moves inside `reader_agent`; prompt simplified
- **Removed**: skill injection system from analyze mode (`build_active_skills_block` call, `skill_registry_path`, `max_active_skills` for analyze)
- **Removed**: `<available_tools>`, `<full_analysis_protocol>`, `<skills_runtime>` sections from `analyze.md`

## Capabilities

### New Capabilities

- `domain-subagents`: Four specialized sub-agents (security, qa, review, docs) each with a focused toolset and domain prompt, exposed as tools to the analyze orchestrator

### Modified Capabilities

- `refactoring-skill`: Refactor mode prompt simplified — removes tool listing and workflow steps embedded in prompt; orchestrator delegates via reader_agent + code_gen/refactor_gen

## Impact

- `src/cognitive_code_agent/configs/config.yml` — 4 new function definitions, analyze/refactor mode tool_names and prompt_path changes
- `src/cognitive_code_agent/prompts/system/analyze.md` — full rewrite (~30 lines)
- `src/cognitive_code_agent/prompts/system/` — 4 new prompt files
- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — remove `build_active_skills_block` call for analyze mode (skill injection no longer needed)
- `src/cognitive_code_agent/prompts/composer.py` and `registry.yml` — skill system remains for refactor/execute if needed, but disabled for analyze
- No changes to tool implementations, LangGraph graph structure, streaming, or test infrastructure
