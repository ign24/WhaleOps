## 1. Sub-agent System Prompts

- [x] 1.1 Create `src/cognitive_code_agent/prompts/system/security_agent.md` (~20 lines): role as security auditor, tools available (semgrep, trivy, gitleaks, bandit), output format (findings with file path + severity + recommendation), directory_tree_policy
- [x] 1.2 Create `src/cognitive_code_agent/prompts/system/qa_agent.md` (~20 lines): role as QA engineer, tools available (pytest, jest, coverage, qa_knowledge), output format (pass/fail counts, coverage %, missing test areas)
- [x] 1.3 Create `src/cognitive_code_agent/prompts/system/review_agent.md` (~20 lines): role as code reviewer, tools available (ruff, eslint, complexity, diff), output format (issues with file path + line + severity)
- [x] 1.4 Create `src/cognitive_code_agent/prompts/system/docs_agent.md` (~20 lines): role as technical writer, tools available (docstrings, readme, api_docs), output format (coverage %, missing items, recommendations)

## 2. Config — Sub-agent Definitions

- [x] 2.1 Add `security_agent` to `functions:` in `config.yml` with `_type: tool_calling_agent`, `llm_name: deepseek_coder`, `max_iterations: 8`, `max_history: 4`, `tool_names: [run_semgrep, run_trivy, run_gitleaks, run_bandit]`, `prompt_path: src/cognitive_code_agent/prompts/system/security_agent.md`
- [x] 2.2 Add `qa_agent` with `tool_names: [run_pytest, run_jest, analyze_test_coverage, query_qa_knowledge]`, same LLM and iteration settings
- [x] 2.3 Add `review_agent` with `tool_names: [run_ruff, run_eslint, analyze_complexity, get_diff]`
- [x] 2.4 Add `docs_agent` with `tool_names: [analyze_docstrings, check_readme, analyze_api_docs]`

## 3. Config — Analyze Mode

- [x] 3.1 Replace `analyze.tool_names` with exactly: `[security_agent, qa_agent, review_agent, docs_agent, reader_agent, clone_repository, persist_findings, query_findings]`
- [x] 3.2 Set `analyze.max_iterations: 12` (orchestrator only coordinates — 8 sub-agent calls max + synthesis)
- [x] 3.3 Set `analyze.prompt_path: src/cognitive_code_agent/prompts/system/analyze.md` (already set, verify unchanged)
- [x] 3.4 Remove `analyze.skill_registry_path` and `analyze.max_active_skills` from analyze mode config (skill injection disabled for analyze)

## 4. Analyze Orchestrator Prompt

- [x] 4.1 Rewrite `src/cognitive_code_agent/prompts/system/analyze.md` to ~30 lines: identity as orchestrator, delegation strategy (which sub-agent for which domain), `persist_findings` usage, `output_contract` (diagnosis → evidence → P0/P1/P2 → next steps), and note that user can request specific domains
- [x] 4.2 Remove `<available_tools>` section entirely
- [x] 4.3 Remove `<full_analysis_protocol>` section (5-phase hardcoded protocol)
- [x] 4.4 Remove `<skills_runtime>` section
- [x] 4.5 Keep `<directory_tree_policy>` note condensed to 2 lines pointing to reader_agent

## 5. Skill Injection — Disable for Analyze

- [x] 5.1 In `safe_tool_calling_agent.py`, change condition from `if mode != "chat":` to `if mode not in ("chat", "analyze"):` for the `build_active_skills_block` call (line ~855)

## 6. Config — Refactor Mode Cleanup

- [x] 6.1 Verify `refactor.tool_names` still has: `reader_agent, code_gen, refactor_gen, fs_tools_write, run_ruff, run_eslint, run_pytest, run_jest, analyze_complexity, query_findings, persist_findings, shell_execute, context7_tools`
- [x] 6.2 Refactor mode keeps `skill_registry_path` and `max_active_skills: 2` — no change needed

## 7. Verification

- [x] 7.1 Run `uv run python -m pytest tests/ -q` — all tests pass, no regressions
- [x] 7.2 Verify analyze mode tool count: check log line `Built mode 'analyze': llm=... tools=8`
- [x] 7.3 Verify each sub-agent builds without error at startup
- [x] 7.4 Run `uv run ruff check src/ && uv run ruff format --check src/` — clean
- [x] 7.5 Manual smoke: send "hola" → chat mode (2 tools) ✓, send "/analyze test" → analyze mode, check no skill block injected in logs
