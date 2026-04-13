## Why

The agent's system prompt has grown organically to ~13,000 tokens worst-case, with 70% being dynamic injection (skills + memory). 14 sections are duplicated across base.md and each mode prompt (analyze, refactor, execute). During a full analysis, 4 skills inject ~31KB of additional instructions. DeepSeek V3.2 has a documented weakness with verbose system prompts — it generates 10-16 duplicate parallel tool calls per turn instead of following stepwise execution. A smoke test on a simple repo (`ign24/agents`) confirmed: `clone_repository` called 12x, `run_gitleaks` 14x, `reader_agent` 16x, `persist_findings` 15x — all in parallel duplicates within single turns.

The root cause is not just prompt size but **instruction ambiguity**: 235+ instructions at equal precedence with no hierarchy, redundant sections that signal "critical" emphasis to the model, and conflicting directives (e.g., `model_execution_guidelines` says "one tool at a time" while skills may imply parallel execution).

## What Changes

- **Eliminate section duplication**: `identity`, `priority_policy`, `workflow_policy`, `memory_policy`, `output_contract`, `model_execution_guidelines`, `skills_runtime` move to base.md only. Mode prompts append only mode-specific sections — they never restate base sections.
- **Remove cross-prompt redundancy**: `full_analysis_protocol` removed from base.md (analyze-only). `code_writing_policy` removed from base.md (refactor-only).
- **Add explicit instruction hierarchy**: New `<instruction_priority>` section that tells the model which instructions take precedence (execution guidelines > mode-specific > skills).
- **Reduce skill injection payload**: Lower `default_max_active_skills` from 4 to 2. During full analysis, the two highest-priority skills are injected; the protocol itself provides sufficient structure for the other phases.
- **Cap skill content size**: Add a `max_chars` field per skill in registry.yml. Skills exceeding the cap are summarized before injection.
- **Move full_analysis_protocol to on-demand**: Extract into a dedicated skill or tool-queryable document instead of baking it into the always-loaded system prompt.
- **Add reader_agent system_prompt**: Inject `directory_tree_policy` and basic constraints into the reader_agent sub-agent config so it operates with guardrails in its own context window.

## Capabilities

### New Capabilities
- `prompt-layering`: Base-only global sections with mode-specific additive composition. No section appears in more than one prompt file.
- `instruction-hierarchy`: Explicit priority ordering of instruction sources (base > mode > skills > memory) that the model can reference when directives conflict.
- `skill-budget-control`: Max active skills reduced to 2, with per-skill size caps and optional summarization for oversized skill content.

### Modified Capabilities
- `tool-output-guard`: Reader agent gets a `system_prompt` with directory_tree_policy (implementation detail from large-repo-resilience that requires prompt-level change).

## Impact

- **Prompt files**: `base.md`, `analyze.md`, `refactor.md`, `execute.md` — all rewritten to eliminate duplication
- **Skill registry**: `registry.yml` — `default_max_active_skills` lowered, `max_chars` field added
- **Prompt composer**: `composer.py` — skill size capping logic, base+mode composition changes
- **Agent config**: `config.yml` — `reader_agent.system_prompt` field added
- **Risk**: Prompt changes directly affect agent behavior. Each change must be validated with smoke tests on the same `ign24/agents` repo that exposed the current issues.
- **No breaking changes**: API contracts, tool interfaces, and frontend remain unchanged.
