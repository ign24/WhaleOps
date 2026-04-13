## Context

The cognitive-code-agent exposes tools to the LLM through `config.yml`. Each execution mode declares a `tool_names` list; the runtime resolves those names against the `function_groups` and `functions` sections, serializes their descriptions, and appends them to the model's context window.

Current state in `analyze` mode:
- 23 direct tools + `reader_agent` (which internally owns `fs_tools` + `github_tools`) = effectively 37 tool slots in the LLM context.
- `fs_tools` (6 MCP tools) and `github_tools` (8 MCP tools) appear **twice**: once exposed directly to the orchestrator, once inside `reader_agent`.

Current state in `registry.yml`:
- `default_max_active_skills: 4` and `max_active_skills: 4` in `code_agent` / `workflow` blocks.
- 5 skills carry 6 identical generic triggers each. Any phrase like "analisis completo" activates 4 skills at once.
- Each skill file is 200–500 lines → combined injection of 800–2000 lines into the system prompt.

## Goals / Non-Goals

**Goals:**
- Eliminate duplicate tool exposure in `analyze` mode: `reader_agent` is the correct delegation boundary for filesystem and GitHub reads; the top-level orchestrator should never call those tools directly in analyze mode.
- Make skill triggers domain-specific so each skill fires only when its domain is explicitly mentioned.
- Cap concurrent active skills at 2 to bound worst-case system prompt growth.

**Non-Goals:**
- Changing the tool surface of `refactor`, `chat`, or `execute` modes.
- Modifying skill file content (the `.md` skill files themselves).
- Rewriting the trigger-matching algorithm or adding fuzzy matching.
- Adding new skills or removing existing ones.

## Decisions

### D1 — Remove `fs_tools` and `github_tools` from `analyze.tool_names`

`reader_agent` is already the delegated sub-agent for file and GitHub reads. Exposing `fs_tools` and `github_tools` directly at the orchestrator level in analyze mode serves no purpose: the orchestrator can already reach those capabilities through `reader_agent`. Keeping them there wastes ~14 tool description slots (~300–400 tokens) and introduces ambiguity — the orchestrator may choose to call filesystem tools directly instead of routing through the sub-agent, bypassing `reader_agent`'s `max_iterations` and error-handling wrapper.

Alternative considered: keep them but add a system prompt rule forbidding direct calls. Rejected — enforcing behavior through prompt instructions is fragile; removing the tools is deterministic.

### D2 — Remove generic triggers from skill entries in `registry.yml`

The 6 generic triggers on `security-review`, `code-reviewer`, `senior-qa`, and `technical-writer` were added to ensure coverage for broad "analyze everything" requests. However, the correct behavior for such requests is for the **orchestrator** to decide which domains are relevant based on the task, not for the trigger system to blindly activate every skill. Removing these triggers means skills fire only on domain-specific keywords, which is the intended contract.

`default_max_active_skills` in `registry.yml` is also updated from `4` to `2` for consistency with the runtime config.

Alternative considered: introduce a dedicated `full-analysis` composite skill that loads a lightweight summary of each domain skill. Deferred — that is a separate capability; this change only tightens the existing trigger contract.

### D3 — Reduce `max_active_skills` to 2

With domain-specific triggers, simultaneous activation of more than 2 skills at once is already unlikely. Setting the cap to 2 provides a hard bound that prevents prompt bloat even in edge cases (e.g., a message that legitimately mentions both QA and security). Two skills at 200–500 lines each = 400–1000 lines max vs. the current 800–2000.

Both `functions.code_agent.max_active_skills` and `workflow.max_active_skills` must be updated — they configure the same runtime path but for the function-level and workflow-level agent instantiations respectively.

## Risks / Trade-offs

- **Risk**: A user sends a message that genuinely covers multiple domains (e.g., "security review and full test coverage audit") and only one skill activates.
  → Mitigation: `max_active_skills: 2` allows two concurrent skills. For rare cases needing more, the user can be explicit in their message with multiple domain keywords.

- **Risk**: Removing `fs_tools` / `github_tools` from analyze mode breaks a flow that was relying on direct orchestrator calls to those tools.
  → Mitigation: All read access in analyze mode goes through `reader_agent`, which is already in the tool list. The orchestrator retains full read capability — just routed through the sub-agent as intended by the architecture.

- **Risk**: Lowering `max_active_skills` causes a regression on an existing integration test that expects 4 active skills.
  → Mitigation: Check test suite for `max_active_skills` assertions before applying. Update tests if found.

## Migration Plan

1. Apply changes to `config.yml` (D1, D3).
2. Apply changes to `registry.yml` (D2, D3).
3. Run existing unit/integration tests: `uv run pytest -x`.
4. Smoke-test analyze mode manually: send a message with "full analysis" and verify at most 2 skills activate; verify file reads route through `reader_agent`.
5. No rollback complexity — both files are YAML config; reverting is a git revert.

## Open Questions

- None. All decisions are unambiguous given the codebase state.
