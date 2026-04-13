## Context

Execute mode already has `run_pytest`, `run_jest`, `code_gen`, `fs_tools_write`, and `shell_execute` — all the tools needed for TDD. The skill injection system (`composer.py`) activates skills based on trigger-word matching against the user message, with a budget of 2 active skills and 16K total chars. Skills are only injected in execute mode.

Today's execute prompt enforces "lint after each file, tests after logical batches" — a post-implementation validation loop. TDD inverts this: test first, then implement, then validate.

The refactoring skill already handles the refactor workflow (read-plan-write-validate). TDD complements it: for new code, write tests first; for refactoring, verify existing tests pass before and after.

## Goals / Non-Goals

**Goals:**
- Add a `tdd` skill file that teaches the agent the RED-GREEN-REFACTOR cycle adapted to its tool constraints
- Register the skill with triggers that match implementation-related messages
- Keep TDD as guidance the agent applies at its discretion, not a mandatory workflow
- Add a one-line reference in `execute.md` so the agent knows TDD is available even when the skill isn't activated

**Non-Goals:**
- Forcing TDD on every task — the agent decides when it adds value
- Building new tools — all required tools already exist
- Modifying the skill injection mechanism in `composer.py` — the existing system handles everything
- Adding TDD to analyze or chat modes

## Decisions

### 1. TDD as a skill, not a prompt section
**Decision:** Implement as a standalone skill in `prompts/skills/tdd.md` registered in `registry.yml`, not as a section embedded in `execute.md`.

**Why:** The skill system already handles activation (trigger matching), budget management (char limits), and tool gating (required_tools check). Embedding it in execute.md would mean it's always present, consuming prompt budget even for git ops or deploy tasks. As a skill, it only loads when relevant.

**Alternative considered:** Adding a TDD section directly to execute.md. Rejected because it would inflate the base prompt for all execute requests regardless of relevance.

### 2. Trigger words target implementation, not testing
**Decision:** Triggers: `implement`, `feature`, `new function`, `fix bug`, `write code`, `add`, `create`, `build`, `crear`, `implementar`, `construir`, `agregar`.

**Why:** TDD triggers on the *intent to write code*, not on the word "test". The `senior-qa` skill already owns test-related triggers (`test`, `qa`, `coverage`). TDD and senior-qa serve different purposes — TDD guides the writing process, senior-qa evaluates test quality.

**Alternative considered:** Sharing triggers with senior-qa. Rejected because they'd compete for the 2-skill budget and serve different goals.

### 3. Priority: 12 (between security-review and refactoring)
**Decision:** Priority 12, category `correctness`.

**Why:** TDD is a correctness practice. Priority 12 means it ranks above refactoring (15) but below security-review (10). When both TDD and security triggers match, security wins the first slot, TDD gets the second. This is the right order — security constraints should inform how code is written, and TDD provides the methodology for writing it.

### 4. Required tools: run_pytest, run_jest
**Decision:** Both `run_pytest` and `run_jest` as required tools.

**Why:** The skill needs at least one test runner available to be useful. The `_tool_available` check in composer.py uses OR-like matching via the suffix mechanism — if either tool is available in the runtime, the check passes. This matches the existing pattern used by senior-qa.

**Update after investigation:** Need to verify if `_tool_available` checks ALL required tools (AND) or ANY (OR). If AND, then requiring both would block the skill in projects that only have one test framework. May need to require only one, or adjust the approach.

### 5. Skill content: structured cycle with escape hatches
**Decision:** The skill content presents RED-GREEN-REFACTOR as a structured 5-step cycle but explicitly lists when to skip it.

**Why:** The agent needs clear methodology (not just "consider TDD") but also clear permission to skip when it doesn't apply. The skill content balances prescription ("follow these steps") with judgment ("skip for these cases").

### 6. One-line guidance in execute.md
**Decision:** Add a single sentence to execute.md's "Code Writing Policy" section: a reference that TDD is available as a skill for new code and bug fixes.

**Why:** Even when the TDD skill isn't activated (triggers didn't match), the agent should know it can request TDD-style validation. The line doesn't teach TDD — it points to the capability.

## Risks / Trade-offs

**[Token budget consumption]** The TDD skill consumes one of two available skill slots. If the user triggers both TDD and refactoring in the same message, only one will activate.
-> Mitigation: Priority ordering ensures the most relevant skill wins. The refactoring skill already includes validation steps, so overlap is partial, not total.

**[Over-application]** The agent might apply TDD to trivial changes where it adds overhead without value.
-> Mitigation: The skill content explicitly lists "when to skip" cases (config changes, shell ops, single-line patches).

**[Trigger collision with senior-qa]** If both skills trigger on the same message, they compete.
-> Mitigation: Triggers are intentionally non-overlapping. TDD triggers on implementation intent, senior-qa on testing/QA evaluation intent.

**[required_tools AND vs OR]** If composer checks ALL required tools, requiring both run_pytest and run_jest blocks activation in single-framework projects.
-> Mitigation: Verify in implementation. If AND, use only `run_pytest` as required (more common) and mention jest support in the skill content.
