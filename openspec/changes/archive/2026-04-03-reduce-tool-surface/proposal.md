## Why

In `analyze` mode the LLM receives ~37 tools in its context window: `fs_tools` and `github_tools` appear both at the top-level agent AND inside the delegated `reader_agent`, duplicating 14 tool descriptions for no benefit. Additionally, `registry.yml` carries 6 generic triggers (`full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`) on 5 separate skills, so any vague analysis phrase activates up to 4 skills simultaneously — injecting 800–2000 lines of skill content into the system prompt and degrading response quality and cost.

## What Changes

- Remove `fs_tools` and `github_tools` from `workflow.modes.analyze.tool_names` in `config.yml`. These tools are already delegated to `reader_agent`; the orchestrator does not call them directly.
- Remove the 6 generic cross-skill triggers (`full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`) from every skill entry in `registry.yml`. Each skill will fire only on domain-specific triggers.
- Reduce `max_active_skills` from `4` to `2` in `config.yml` (both the `code_agent` function definition and the `workflow` top-level block).

## Capabilities

### New Capabilities
- `tool-surface-config`: Configuration contract for which tools are exposed per execution mode and how many skills may be active simultaneously.

### Modified Capabilities
- `refactoring-skill`: The skill registry requirement for trigger specificity changes — generic cross-domain triggers must not appear on domain-specific skills.

## Impact

- `src/cognitive_code_agent/configs/config.yml`: `workflow.modes.analyze.tool_names`, `functions.code_agent.max_active_skills`, `workflow.max_active_skills`
- `src/cognitive_code_agent/prompts/skills/registry.yml`: trigger lists for `security-review`, `code-reviewer`, `senior-qa`, `technical-writer`; `default_max_active_skills`
- No API changes. No new dependencies. No data migration needed.
- Analyze mode context window shrinks by ~14 tool descriptions (~300–400 tokens). Skill prompt injection shrinks by up to 50% on generic analysis requests.
