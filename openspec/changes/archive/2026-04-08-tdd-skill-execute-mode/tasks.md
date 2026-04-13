## 1. Verify required_tools behavior and decide tool gating

- [x] 1.1 Confirm `_tool_available` in `composer.py` uses AND logic (all required tools must be present) — already verified: line 108 uses `any(not ...)` which is AND
- [x] 1.2 Decide required_tools for TDD skill: use only `run_pytest` (most common) since AND logic would block activation in JS-only or Python-only projects. The skill content covers both pytest and jest regardless.

## 2. Create TDD skill file

- [x] 2.1 Create `src/cognitive_code_agent/prompts/skills/tdd.md` with RED-GREEN-REFACTOR methodology adapted to agent tool constraints
- [x] 2.2 Include test framework detection guidance (check `pyproject.toml`, `pytest.ini`, `jest.config.*`, `tests/`, `__tests__/`)
- [x] 2.3 Include skip criteria (shell ops, git ops, config, infra, no test framework)
- [x] 2.4 Verify content is under 4000 characters to leave budget for a second skill

## 3. Register skill in registry

- [x] 3.1 Add `tdd` entry to `registry.yml` with: `id: tdd`, `enabled: true`, `category: correctness`, `priority: 12`, `required_tools: [run_pytest]`, triggers for English and Spanish implementation keywords
- [x] 3.2 Verify trigger list does not overlap with `senior-qa` triggers

## 4. Update execute prompt

- [x] 4.1 Add one line to `execute.md` Code Writing Policy section referencing TDD availability for new code and bug fixes

## 5. Update refactoring skill

- [x] 5.1 Add test safety net guidance to `src/cognitive_code_agent/prompts/skills/refactoring.md`: run existing tests before starting refactoring (establish GREEN baseline) and after each file

## 6. Tests

- [x] 6.1 Add unit test: TDD skill activates on "implement a new feature" message
- [x] 6.2 Add unit test: TDD skill does NOT activate on "run tests" or "check coverage" (senior-qa territory)
- [x] 6.3 Add unit test: TDD skill and security-review can coexist (both activate on "implement secure auth endpoint")
- [x] 6.4 Add unit test: TDD skill blocked when `run_pytest` not in available tools
- [x] 6.5 Run full test suite to verify no regressions in skill selection
