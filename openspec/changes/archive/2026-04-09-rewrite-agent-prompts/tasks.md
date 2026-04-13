## 1. Add prompt_config to config.yml

- [x] 1.1 Add `prompt_config` section to config.yml with all team-adjustable variables: agent_name, identity, business_objective, response_language, output_style, autonomy_level, emoji_set, workspace_path, analysis_path
- [x] 1.2 Add YAML comments documenting each variable's purpose and valid values
- [x] 1.3 Set default values that produce a neutral code intelligence agent (matching current behavior minus the corporate identity)

## 2. Add template rendering to composer.py

- [x] 2.1 Write `render_template(template: str, config: dict) -> str` function — replaces `{{key}}` with config values, logs warning for unresolved placeholders
- [x] 2.2 Write unit tests for render_template: basic substitution, missing key warning, nested braces ignored, empty config
- [x] 2.3 Integrate render_template into `load_base_prompt` and any mode prompt loading path so all prompts are rendered before use
- [x] 2.4 Add config loading: read prompt_config from config.yml and pass to render_template

## 3. Rewrite base.md as template

- [x] 3.1 Replace `<identity>` with `{{agent_name}}` and `{{identity}}` placeholders — remove hardcoded "Cognitive Intelligence for Cognitive LATAM"
- [x] 3.2 Add `<business_objective>` section using `{{business_objective}}` placeholder
- [x] 3.3 Add `<environment>` section — Docker sandbox, paths (`{{analysis_path}}` ephemeral, `{{workspace_path}}` persistent), memory layers, scheduling, code_exec, shell_execute, model catalog
- [x] 3.4 Replace `<model_execution_guidelines>` with `<operating_principles>` — remove "one tool at a time", add anti-patterns (don't speculate without tools, don't report assumptions as findings, don't retry blindly)
- [x] 3.5 Update `<instruction_priority>` — collapse from 5 levels to 4 (merge mode sections + skills into one level, remove model_execution_guidelines from level 2)
- [x] 3.6 Simplify `<workflow_policy>` — keep `{{response_language}}` rule and tool-backed evidence, remove prescriptive step ordering
- [x] 3.7 Add `<communication_style>` section — uses `{{emoji_set}}` (if non-empty, agent uses those emojis freely in responses)
- [x] 3.8 Keep `<priority_policy>`, `<memory_policy>`, and `<skills_runtime>` unchanged
- [x] 3.9 Verify base.md has no mode-specific content (no output_contract, no code_writing_policy, no directory_tree_policy)

## 4. Rewrite analyze.md as template

- [x] 4.1 Simplify `<operating_mode_override>` — orchestrator role, can read files directly and spawn domain agents
- [x] 4.2 Replace `<planning_policy>` + `<spawn_agent_policy>` + `<directory_tree_policy>` with concise `<tool_guidance>` — brief hints on clone (prefer shallow), spawn (pass only needed tools, include repo path), directory_tree (use excludePatterns). Anti-patterns, not steps.
- [x] 4.3 Replace rigid `<output_contract>` with `<output_guidelines>` — adapts based on `{{output_style}}`. List elements to include when relevant (diagnosis, evidence, prioritized recommendations, refactoring plan for /execute), but don't mandate format or section order.

## 5. Rewrite execute.md as template

- [x] 5.1 Simplify `<operating_mode_override>` — executor role, modifies code, validates changes, can query prior findings
- [x] 5.2 Rewrite `<available_tools>` — keep the tool list but remove prescriptive workflow (no LOAD->EXECUTE->VALIDATE->PERSIST). State what each tool category does.
- [x] 5.3 Replace `<execution_workflow>` + `<code_writing_policy>` with `<execution_expectations>` — validate after changes, use linters, run tests after batches, persist outcomes. Anti-patterns: don't skip validation, don't modify outside workspace without confirmation. Respects `{{autonomy_level}}`.
- [x] 5.4 Keep `<git_workflow>` — conventions are correct (branch naming, conventional commits, push safety)
- [x] 5.5 Remove `<directory_tree_policy>` — duplicated from analyze.md, now covered by base environment + tool_guidance in analyze
- [x] 5.6 Replace `<output_contract>` with `<output_guidelines>` — adapts based on `{{output_style}}`

## 6. Rewrite chat.md

- [x] 6.1 Rewrite `<operating_mode>` — genuinely conversational, can answer questions about capabilities, query findings, and help users orient. Remove "do not perform deep analysis" restriction.
- [x] 6.2 Update `<capability_summary>` — reflect all three modes accurately (analyze, execute, chat) with current capabilities including scheduling, reports, and sub-agents

## 7. Polish sub-agent prompts

- [x] 7.1 security_agent.md — add one-line note that workspace path is inherited from spawning agent. No structural changes.
- [x] 7.2 qa_agent.md — same: add workspace path inheritance note
- [x] 7.3 review_agent.md — same: add workspace path inheritance note
- [x] 7.4 docs_agent.md — same: add workspace path inheritance note

## 8. Validation

- [x] 8.1 Verify all prompt files use valid XML tags compatible with composer.py parsing
- [x] 8.2 Verify no section is duplicated across base.md and mode prompts
- [x] 8.3 Verify all `{{variable}}` placeholders in prompts have matching keys in prompt_config defaults
- [x] 8.4 Run unit tests for render_template
- [x] 8.5 Run the application build to confirm no prompt loading errors
- [x] 8.6 Manual smoke test: start agent, verify identity renders correctly from config
