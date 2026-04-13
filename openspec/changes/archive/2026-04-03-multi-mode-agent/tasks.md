## 1. Timeout Hardening

- [x] 1.1 Add `_apply_nim_timeout_patch()` in `register.py` to extend aiohttp `ClientTimeout` to 900s for NIM calls
- [x] 1.2 Add defensive try/except around streaming+ainvoke fallback in `_response_fn` — graceful error message when both paths fail
- [x] 1.3 Write unit test: verify patch is idempotent (applying twice does not error)
- [x] 1.4 Write unit test: verify both stream+ainvoke failure yields user-friendly error message

## 2. Mode Router

- [x] 2.1 Implement `resolve_mode()` function: prefix detection for /analyze, /refactor, /execute with default fallback
- [x] 2.2 Write unit tests: 12 cases covering prefix detection, case insensitivity, stripping, default, unknown prefix
- [x] 2.3 Integrate `resolve_mode()` at the top of `_response_fn` before skill detection

## 3. Multi-Workflow Config

- [x] 3.1 Add `ModeConfig` and `_ModeRuntime` classes for per-mode configuration and pre-built graph storage
- [x] 3.2 Add `modes` dict and `default_mode` fields to `SafeToolCallAgentWorkflowConfig`
- [x] 3.3 Implement `_build_mode_runtime()` to build a single mode's graph at startup
- [x] 3.4 Restructure `safe_tool_calling_agent_workflow()` to build 3 graphs at startup (one per mode) with single-mode fallback for backward compat
- [x] 3.5 Modify `_response_fn` to resolve mode and select the correct graph, llm, tool set, and budget
- [x] 3.6 Restructure `config.yml` with `workflow.modes.{analyze,refactor,execute}` each with own llm_name, tool_names, prompt_path, max_iterations, tool_call_timeout_seconds

## 4. System Prompts

- [x] 4.1 Create `analyze.md`: full analysis protocol, read-only policy, <available_tools> listing, analysis output contract, analyze-mode skills listed
- [x] 4.2 Create `refactor.md`: code writing policy, refactoring workflow, validation-after-write, <available_tools> listing, references findings, refactor-mode skills listed
- [x] 4.3 Create `execute.md`: git workflow conventions, PR template, reporting guidelines, <available_tools> listing, no skills (focused prompt)
- [x] 4.4 Verify all 3 prompts load correctly via `load_base_prompt()`

## 5. Skill System Adaptation

- [x] 5.1 Add `_tool_available()` with MCP suffix matching (fs_tools_write__write_file matches write_file)
- [x] 5.2 Update `select_skills()` to use `_tool_available()` for required_tools check
- [x] 5.3 Write unit tests: security skill activates in analyze but not refactor, refactoring skill activates in refactor but not analyze, no skills in execute mode, MCP suffix matching

## 6. Final Verification

- [x] 6.1 Run full unit test suite: 198 passed in 3.38s
- [x] 6.2 Run linter: `uv run ruff check . && uv run ruff format --check .` — all clean
- [x] 6.3 Manual smoke test on EasyPanel: /analyze triggers DeepSeek with read-only tools
- [x] 6.4 Manual smoke test on EasyPanel: /refactor triggers Devstral with write tools
- [x] 6.5 Manual smoke test on EasyPanel: /execute triggers Kimi K2 with git/shell tools
- [x] 6.6 Manual smoke test: long-running analyze session does not timeout prematurely
