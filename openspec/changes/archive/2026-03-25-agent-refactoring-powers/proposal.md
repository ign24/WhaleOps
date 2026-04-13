## Why

The agent can analyze repositories and propose code improvements, but it never materializes those proposals into actual files. When a user asks for a refactoring, the agent shows snippets in the chat and stops there. For the agent to be useful on real projects (full frontend + backend refactors), it needs to: (1) have enough token budget to generate large code outputs, (2) a dedicated code generation tool with a professional system prompt that receives expert guidelines per stack, (3) a skill that guides the orchestrator through the full detection-plan-execute-validate cycle, and (4) curated expert knowledge injected per detected stack so devstral refactors following best practices from the actual framework authors.

## What Changes

- Increase `max_tokens` for devstral (code generator) from 8192 to 32768 to support multi-file refactoring output.
- Increase `max_tokens` for deepseek_coder (orchestrator) from 8192 to 16384 for longer reasoning chains.
- Increase `max_iterations` for the agent workflow from 25 to 40 to handle multi-file refactoring cycles.
- Create a custom `refactor_gen` tool that wraps devstral with a professional system prompt (replacing the generic `code_gen` "junior developer" prompt for refactoring use cases). This tool receives structured queries with project context, refactoring plan, current file content, and expert guidelines selected by the orchestrator.
- Create a `refactoring` skill that guides deepseek (the orchestrator) through: stack detection, plan generation, per-file execution via `refactor_gen`, writing changes on the cloned repo, and validation. The skill includes curated expert guidelines per stack (extracted from python-expert, senior-frontend, backend-patterns, vercel-react-best-practices) that deepseek packages into each `refactor_gen` call.
- Register the skill and tool in config.yml and registry.yml.

## Capabilities

### New Capabilities
- `refactoring-skill`: Skill module that activates on refactoring requests. Guides the orchestrator through stack detection, plan generation, and a per-file write-validate cycle using a dedicated `refactor_gen` tool. Includes curated expert guidelines per stack that are passed to devstral for production-quality refactoring.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- `src/cognitive_code_agent/tools/refactor_gen.py`: New custom tool wrapping devstral with professional system prompt.
- `src/cognitive_code_agent/configs/config.yml`: LLM token limits, agent iteration limits, new `refactor_gen` function registration, new tool added to `code_agent` and `workflow` tool lists.
- `src/cognitive_code_agent/prompts/skills/refactoring.md`: New skill with orchestration cycle and curated expert guidelines per stack.
- `src/cognitive_code_agent/prompts/skills/registry.yml`: New skill registration.
- No API changes. No UI changes. No new dependencies (uses existing NAT plugin system).
- Cost per request increases proportionally with higher token limits (devstral 4x, deepseek 2x max).
