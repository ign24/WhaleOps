## 1. Prompt Deduplication

- [x] 1.1 Rewrite `base.md`: keep only global sections (identity, priority_policy, workflow_policy, operating_mode, model_execution_guidelines, memory_policy, skills_runtime). Remove `full_analysis_protocol`, `code_writing_policy`, `output_contract`.
- [x] 1.2 Add `<instruction_priority>` section to `base.md` with the 5-level hierarchy (priority_policy > execution_guidelines > mode sections > skills > memory).
- [x] 1.3 Rewrite `analyze.md`: remove all sections that now live in base.md (identity, business_objective, priority_policy, workflow_policy, model_execution_guidelines, memory_policy, skills_runtime). Keep: operating_mode_override, available_tools, directory_tree_policy, findings_quality, full_analysis_protocol, output_contract.
- [x] 1.4 Rewrite `refactor.md`: remove duplicated global sections. Keep: operating_mode_override, available_tools, code_writing_policy, refactoring_workflow, directory_tree_policy, output_contract.
- [x] 1.5 Rewrite `execute.md`: remove duplicated global sections. Keep: operating_mode_override, available_tools, git_workflow, reporting, output_contract.
- [x] 1.6 Write unit tests: verify no global section appears in mode prompts (parse for duplicated XML tags).

## 2. Skill Budget Control

- [x] 2.1 Change `default_max_active_skills` from 4 to 2 in `registry.yml`.
- [x] 2.2 Add `max_chars` global default (8000) and per-skill override field to `registry.yml` schema.
- [x] 2.3 Implement skill truncation in `composer.py`: truncate at nearest `##` heading boundary, append `[SKILL TRUNCATED]` notice.
- [x] 2.4 Add total skill budget cap (16000 chars) to `build_active_skills_block()` — truncate lower-priority skill if combined payload exceeds budget.
- [x] 2.5 Update `SkillConfig` dataclass to include `max_chars` field.
- [x] 2.6 Write unit tests: skill under cap passes through, skill over cap truncated at heading boundary, two skills exceeding budget triggers truncation of lower-priority skill.

## 3. Reader Agent Constraints

- [x] 3.1 Add `system_prompt` field to `reader_agent` config in `config.yml` with directory_tree_policy and basic constraints (<500 chars).
- [x] 3.2 Verify NAT `tool_calling_agent` passes `system_prompt` from config to LLM (read NAT source to confirm field name).

## 4. Code Fixes (from large-repo-resilience)

- [x] 4.1 Remove `version="v2"` parameter from `astream()` call in `safe_tool_calling_agent.py` (silently ignored in LangGraph 1.0.10).
- [x] 4.2 Add tool call deduplication in `tool_node()`: before executing, deduplicate tool_calls with identical name+args, keeping only the first occurrence.
- [x] 4.3 Write unit tests for tool call deduplication: identical calls deduped, different args preserved, empty tool_calls handled.

## 5. Validation

- [x] 5.1 Run full test suite (`uv run python -m pytest -x`) confirming no regressions.
- [x] 5.2 Run linting (`uv run ruff check . && uv run ruff format --check .`).
- [x] 5.3 Measure prompt token count before/after: target <6K tokens worst case (vs current ~13K). Result: base+analyze ~2306 tokens (82% reduction, well under 6K target).
- [ ] 5.4 Smoke test: full analysis on `ign24/agents` repo — verify <20 total tool calls (vs current 150+) and no duplicate parallel calls.
