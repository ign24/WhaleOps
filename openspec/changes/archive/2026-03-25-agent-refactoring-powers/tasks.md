## 1. Token and iteration limits

- [x] 1.1 Update `config.yml`: change devstral `max_tokens` from 8192 to 32768
- [x] 1.2 Update `config.yml`: change deepseek_coder `max_tokens` from 8192 to 16384
- [x] 1.3 Update `config.yml`: change `max_iterations` from 25 to 40 in both `code_agent` and `workflow` sections

## 2. Custom refactor_gen tool

- [x] 2.1 Create `src/cognitive_code_agent/tools/refactor_gen.py` following the existing custom tool pattern (FunctionBaseConfig + @register_function). The tool wraps devstral via `builder.get_llm()` with a professional system prompt: senior software engineer, production enterprise refactoring, follows expert guidelines in the query, outputs complete files, can note plan adjustments. Does NOT hardcode a programming language.
- [x] 2.2 Register `refactor_gen` in `config.yml` under `functions:` with `_type: refactor_gen`, `llm_name: devstral`, and a description that tells the orchestrator when and how to use it (structured query with project_context, expert_guidelines, refactoring_plan, current_file).
- [x] 2.3 Add `refactor_gen` to the `tool_names` list in both `code_agent` and `workflow` sections of `config.yml`.

## 3. Refactoring skill with expert guidelines

- [x] 3.1 Create `src/cognitive_code_agent/prompts/skills/refactoring.md` with: (a) Operational Rules block for CGN-Agent integration, (b) Phase 0 stack detection instructions (what files to read, how to classify Python/Frontend/Backend/Fullstack), (c) Phase 1 plan generation template, (d) Phase 2 per-file execution cycle (read, package query, call refactor_gen, write_file, validate), (e) Phase 3 manifest output format, (f) Curated expert guidelines sections organized by stack — extracted from python-expert, senior-frontend, vercel-react-best-practices, and backend-patterns, (g) Instructions for deepseek to include ONLY the guidelines matching the detected stack in each refactor_gen query.
- [x] 3.2 Register the skill in `registry.yml` with id `refactoring`, category `correctness`, priority 15 (higher than code-reviewer at 20), required_tools `[refactor_gen, write_file, edit_file, run_ruff, run_eslint]`, and trigger keywords: refactor, refactoring, refactorizar, rewrite, restructure, reestructurar, reorganize, reorganizar, clean up, limpiar codigo.

## 4. Verification

- [x] 4.1 Run `uv run ruff check . && uv run ruff format --check .` to verify no Python lint issues
- [x] 4.2 Run `uv run pytest -x -m unit` to verify existing tests still pass
- [x] 4.3 Verify skill activation logic: confirm that a message containing "refactor" triggers the refactoring skill by tracing through `composer.py` — check trigger match, required_tools availability (refactor_gen exists as a resolved function name, write_file/edit_file exist as resolved MCP tool names), and priority ordering
