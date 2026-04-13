## Why

The agent's system prompts were written incrementally as features were added, resulting in over-prescriptive instructions that constrain the agent's autonomy. The prompts tell the agent *how* to execute step-by-step (deterministic workflow disguised as an agent) instead of telling it *what it can do* and letting it reason. Key gaps: the agent doesn't know it runs in a Docker sandbox, has no awareness of its full tool catalog (cron, shell, code_exec, report generation), and the base identity is locked to a narrow corporate role. Both the Agents_v2 architecture doc and the NCP-AAI certification guide agree: agent prompts should define role + tools + guardrails, not dictate execution order.

## What Changes

- **Add prompt_config to config.yml**: Team-adjustable variables (identity, business_objective, workspace paths, output preferences, autonomy level) that feed into prompt templates via `{{variable}}` placeholders. Teams customize config, not prompt files.
- **Add template rendering to composer.py**: Simple `{{variable}}` substitution step in `load_base_prompt` and mode prompt loading. No new dependencies — pure string replacement.
- **Rewrite base.md as template**: Replace hardcoded corporate identity with `{{identity}}` and `{{business_objective}}`. Add environment awareness (sandbox paths, memory layers, scheduling, model catalog). Remove "one tool at a time" constraint. Keep priority_policy and safety guardrails.
- **Rewrite analyze.md as template**: Replace rigid 6-section output_contract and micro-prescriptive policies with concise orchestrator role + spawn guidance + flexible output guidelines. Use `{{output_style}}` for team preference.
- **Rewrite execute.md as template**: Replace deterministic LOAD->EXECUTE->VALIDATE->PERSIST workflow with executor role + tool awareness + validation expectations + git conventions. Remove duplicated directory_tree_policy.
- **Rewrite chat.md**: Replace "don't do anything deep" with a genuinely conversational mode that can answer questions, explain capabilities, and use findings — without artificial limitations.
- **Polish sub-agent prompts**: Minor updates to security_agent.md, qa_agent.md, review_agent.md, docs_agent.md for consistency with the new base prompt style. These are already well-structured.

## Capabilities

### New Capabilities
- `agent-environment-awareness`: Base prompt section that gives the agent knowledge of its runtime environment (Docker sandbox, paths, memory persistence, scheduling, model catalog, shell access)
- `autonomous-execution-model`: Prompt design pattern where the agent decides tool order, parallelization, and depth based on task complexity — guardrails on safety/output, not on reasoning process
- `prompt-template-config`: Team-adjustable configuration system — prompt files use `{{variable}}` placeholders, resolved from a `prompt_config` section in config.yml at composition time

### Modified Capabilities
- `prompt-layering`: Base + mode override + skills composition now follows a simplified structure with less overlap between layers
- `instruction-hierarchy`: Priority policy stays but execution guidelines shift from prescriptive steps to capability awareness

## Impact

- **Prompt files**: 4 system prompt files rewritten as templates, 4 sub-agent prompts polished (8 files in `src/cognitive_code_agent/prompts/system/`)
- **Code**: `composer.py` gains a `render_template()` function (~15 lines) for `{{variable}}` substitution
- **Config**: `config.yml` gains a `prompt_config` section with team-adjustable defaults
- **No breaking changes**: XML tag structure stays compatible. Default config values reproduce current behavior. Teams opt into customization.
- **Risk**: Model behavior will change. Agent will be more autonomous, which could mean more creative tool use but also more unexpected paths. Mitigated by keeping priority_policy and evidence_requirement guardrails.
