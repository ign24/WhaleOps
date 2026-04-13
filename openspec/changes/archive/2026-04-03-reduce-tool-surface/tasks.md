## 1. config.yml — Remove duplicate tools from analyze mode

- [x] 1.1 Remove `fs_tools` from `workflow.modes.analyze.tool_names` in `src/cognitive_code_agent/configs/config.yml`
- [x] 1.2 Remove `github_tools` from `workflow.modes.analyze.tool_names` in `src/cognitive_code_agent/configs/config.yml`
- [x] 1.3 Verify `reader_agent` still declares both `fs_tools` and `github_tools` in `functions.reader_agent.tool_names` (no change needed, just confirm)

## 2. config.yml — Reduce max_active_skills

- [x] 2.1 Set `max_active_skills: 2` in `functions.code_agent` block in `src/cognitive_code_agent/configs/config.yml`
- [x] 2.2 Set `max_active_skills: 2` in `workflow` top-level block in `src/cognitive_code_agent/configs/config.yml`

## 3. registry.yml — Remove generic triggers from skills

- [x] 3.1 Remove `full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis` from `security-review` triggers in `src/cognitive_code_agent/prompts/skills/registry.yml`
- [x] 3.2 Remove `full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis` from `code-reviewer` triggers in `src/cognitive_code_agent/prompts/skills/registry.yml`
- [x] 3.3 Remove `full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis` from `senior-qa` triggers in `src/cognitive_code_agent/prompts/skills/registry.yml`
- [x] 3.4 Remove `full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis` from `technical-writer` triggers in `src/cognitive_code_agent/prompts/skills/registry.yml`

## 4. registry.yml — Align default_max_active_skills

- [x] 4.1 Set `default_max_active_skills: 2` in `src/cognitive_code_agent/prompts/skills/registry.yml`

## 5. Verification

- [x] 5.1 Run `uv run pytest -x` and confirm all tests pass
- [x] 5.2 Grep for `max_active_skills` in both files and confirm all occurrences show `2`
- [x] 5.3 Grep for `full analysis` in `registry.yml` and confirm it returns no matches
- [x] 5.4 Count `tool_names` entries under `workflow.modes.analyze` and confirm count is ~21 (was ~23 before removing the 2 duplicate groups)
