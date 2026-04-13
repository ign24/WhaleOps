---
name: tdd
description: |
  Test-driven development guidance for execute mode. Provides the RED-GREEN-REFACTOR
  cycle adapted to agent tool constraints. Activates on implementation-related messages.
  The agent decides when TDD adds value vs when to skip.
license: MIT
metadata:
  author: cognitive-code-agent
  version: "1.0.0"
---

# Test-Driven Development

Use this skill when writing new code or fixing bugs. TDD is a strategy you apply at your discretion, not a mandatory workflow for every task.

## Operational Rules

Use this block first when running inside CGN-Agent.

- **Execution mode:** TDD runs in `/execute` mode alongside other skills.
- **Primary tools:** `run_pytest` (Python), `run_jest` (JS/TS), `code_gen`, `fs_tools_write`.
- **Decision rule:** Apply TDD when the task involves new logic, bug fixes with reproducible conditions, or functions with clear input/output contracts. Skip when the task is configuration, shell operations, git operations, or infrastructure.
- **Tool call budget:** Each RED-GREEN cycle costs 4-5 tool calls. Factor this into your iteration budget for multi-file plans.

## When to Apply TDD

Apply when ALL of these are true:
- The project has a test framework configured (see detection below)
- The task involves writing or modifying logic (not config, not infra)
- The expected behavior is concrete enough to express as a test assertion

## When to Skip TDD

Skip for:
- Shell operations, git operations, deployment tasks
- Configuration file changes (YAML, JSON, env)
- Single-line patches or trivial renames
- Projects with no test infrastructure detected
- Documentation-only changes

## Test Framework Detection

Before writing any test, detect the project's framework:
- Python: check for `pyproject.toml` with `[tool.pytest]`, `pytest.ini`, `setup.cfg` with `[tool:pytest]`, or a `tests/` directory
- JavaScript/TypeScript: check for `jest.config.js`, `jest.config.ts`, `vitest.config.*`, or `__tests__/` directory
- Place tests in the project's existing test directory structure

## The Cycle: RED-GREEN-REFACTOR

### Step 1: RED — Write a Failing Test
Write a test that describes the expected behavior. Run it with `run_pytest` or `run_jest`. Confirm it fails because the feature does not exist yet, not because of a syntax error or import issue.

### Step 2: GREEN — Write Minimal Code
Write the simplest code that makes the test pass. Do not add extra features, handle edge cases you were not asked for, or optimize prematurely.

### Step 3: Verify GREEN
Run the test again. It must pass. If other tests broke, fix the regression before continuing.

### Step 4: REFACTOR (Optional)
If the implementation has duplication or poor structure, clean it up. Run tests after refactoring to confirm they still pass.

## For Bug Fixes

1. Write a test that reproduces the bug (RED — the test fails because the bug exists)
2. Fix the bug (GREEN — the test passes)
3. Verify no regressions with the full test suite

## For Refactoring (Safety Net Mode)

When refactoring existing code (not writing new code):
1. Run existing tests first — establish a GREEN baseline
2. Refactor the code
3. Run tests again — confirm they still pass
4. This is not full TDD, but the test safety net principle applies
