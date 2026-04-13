## Why

Execute mode has all the tools for TDD (`run_pytest`, `run_jest`, `code_gen`, `fs_tools_write`) but no guidance on when or how to apply a test-first workflow. Today the prompt says "run tests after logical batches" — purely post-implementation. When the agent writes new code or fixes bugs, it never considers writing a failing test first, missing the safety net that catches regressions before they compound.

The goal is not to force TDD on every task. The goal is to make TDD **available as a skill** that the agent activates when it judges it adds value — new features, bug fixes, logic-heavy code — and skips when it doesn't — shell ops, git ops, config changes.

## What Changes

- **New runtime skill** `tdd` registered in `prompts/skills/registry.yml` with triggers for implementation-related messages (`implement`, `feature`, `fix`, `bug`, `write`, `add`, `create`, `build`).
- **New skill file** `prompts/skills/tdd.md` containing the RED-GREEN-REFACTOR methodology adapted to the agent's tool constraints (tool call budget, sandbox execution, validation tools).
- **Guidance line in `execute.md`** acknowledging TDD as an available strategy the agent may use at its discretion — not a mandatory workflow step.

## Capabilities

### New Capabilities
- `tdd-skill`: Runtime skill providing test-driven development guidance for execute mode. Covers the RED-GREEN-REFACTOR cycle, when to apply vs skip, and interaction with existing validation tools.

### Modified Capabilities
- `refactoring-skill`: Minor update — when a refactoring plan exists, the skill should note that existing tests act as the safety net (verify GREEN before refactoring, verify GREEN after), distinct from the full RED-GREEN cycle for new code.

## Impact

- `src/cognitive_code_agent/prompts/skills/registry.yml` — new entry
- `src/cognitive_code_agent/prompts/skills/tdd.md` — new file
- `src/cognitive_code_agent/prompts/system/execute.md` — one line of guidance added
- `src/cognitive_code_agent/prompts/skills/refactoring.md` — minor addition for test-safety-net awareness
- `tests/` — composer skill selection tests for the new skill triggers and priority
