## Context

The agent's system prompt is assembled from multiple layers:

1. **base.md** (5.8KB) — global identity, policies, `full_analysis_protocol`, `code_writing_policy`
2. **Mode prompt** (analyze 9.1KB, refactor 7.6KB, execute 3.9KB) — restates base sections + mode-specific tools/workflows
3. **Active skills** (up to 4, ~31KB worst case) — full markdown skill files injected as a system message
4. **Memory context** (~5K tokens) — episodic memory + findings injected as a system message

Current assembly (`safe_tool_calling_agent.py`): `base.md + mode.md` concatenated as system prompt, then skills block and memory context as additional system messages.

**Problem**: 14 sections are duplicated between base and modes. `full_analysis_protocol` appears in both `base.md` and `analyze.md`. During full analysis, 4 skills (31KB) are injected. Total: ~13K tokens, 235+ instructions, no hierarchy. DeepSeek V3.2 generates 10-16 duplicate tool calls per turn as a result.

### Current prompt composition flow

```
load_base_prompt(base.md)     ─┐
                                ├─ system_prompt (concatenated)
read_text_file(mode.md)       ─┘

build_active_skills_block()   ─── skills_system_message

memory_context_block          ─── memory_system_message
```

### Reader agent

`reader_agent` is a `tool_calling_agent` sub-agent (Kimi K2) with NO `system_prompt` field in config.yml. It calls `fs_tools__directory_tree` without constraints, defeating the `directory_tree_policy` we added to the main agent prompts.

## Goals / Non-Goals

**Goals:**
- Reduce total system prompt from ~13K to <6K tokens (55% reduction)
- Zero duplicated sections across prompt files
- Explicit instruction hierarchy the model can reference
- Max 2 active skills (cap ~13KB skill payload vs current ~31KB)
- Reader agent operates with directory_tree constraints
- Measurable: same smoke test (full analysis on `ign24/agents`) produces <20 tool calls total (vs current 150+)

**Non-Goals:**
- Changing the 3-mode architecture (analyze/refactor/execute)
- Changing the LLM models used (DeepSeek, Devstral, Kimi)
- Multi-agent orchestration (separate change)
- Modifying tool implementations or MCP server configuration
- Rewriting skill content (only capping injection size)

## Decisions

### D1: Additive mode composition (no duplication)

**Choice**: Mode prompts contain ONLY mode-specific sections. Shared sections live exclusively in `base.md`. The composer concatenates `base.md + mode.md` at assembly time (current behavior).

**Alternative considered**: Single merged file per mode. Rejected — harder to maintain, three copies of shared policy.

**Implementation**:
- `base.md` keeps: `identity`, `priority_policy`, `workflow_policy`, `operating_mode`, `model_execution_guidelines`, `memory_policy`, `skills_runtime`
- `base.md` loses: `full_analysis_protocol` (move to analyze.md), `code_writing_policy` (move to refactor.md), `output_contract` (each mode has its own variant)
- `analyze.md` keeps only: mode-specific `operating_mode` override, `available_tools`, `directory_tree_policy`, `findings_quality`, `full_analysis_protocol`, `output_contract`
- `refactor.md` keeps only: mode-specific `operating_mode` override, `available_tools`, `code_writing_policy`, `refactoring_workflow`, `directory_tree_policy`, `output_contract`
- `execute.md` keeps only: mode-specific `operating_mode` override, `available_tools`, `git_workflow`, `reporting`, `output_contract`

**Mode-specific `operating_mode`**: Each mode appends its behavioral constraint (e.g., "You are in ANALYZE mode. You do NOT write code.") as an `<operating_mode_override>` section, which the instruction hierarchy designates as overriding the base `operating_mode`.

### D2: Instruction hierarchy section

**Choice**: Add `<instruction_priority>` to `base.md` that explicitly ranks instruction sources:

```xml
<instruction_priority>
When instructions conflict, follow this precedence:
1. priority_policy (safety > correctness > reliability > speed > style)
2. model_execution_guidelines (stepwise tool calling, one action at a time)
3. Mode-specific sections (operating_mode_override, available_tools)
4. Active skills (supplement, never override #1-3)
5. Memory context (informational, never directive)
</instruction_priority>
```

**Why**: DeepSeek needs explicit disambiguation when 235+ instructions compete. This reduces to 5 priority levels the model can reference.

### D3: Max 2 active skills

**Choice**: Change `default_max_active_skills` from 4 to 2 in `registry.yml`. The two highest-scoring skills by trigger match are injected.

**Alternative considered**: Dynamic budget based on skill size. Rejected — adds complexity, and 2 skills already cover the primary analysis dimensions. The `full_analysis_protocol` itself provides sufficient structure for security/QA/docs phases.

**Impact on full analysis**: During `/analyze` on a repo, instead of injecting security-review (13KB) + code-reviewer (4.7KB) + senior-qa (5.4KB) + technical-writer (7.5KB) = 31KB, only the top 2 are injected (~18KB max). The protocol phases still execute — the model just doesn't have redundant skill instructions for phases already described in the protocol.

### D4: Skill size cap with truncation

**Choice**: Add `max_chars: 8000` field to `registry.yml` (global default). Skills exceeding this are truncated at the nearest section boundary with a `[SKILL TRUNCATED]` notice. Per-skill override via `max_chars` field on each skill entry.

**Alternative considered**: Summarization via LLM call. Rejected — adds latency and cost at prompt assembly time. Manual curation of skills is the real fix; the cap is a safety net.

### D5: Extract full_analysis_protocol from base.md

**Choice**: Move `full_analysis_protocol` from `base.md` to `analyze.md` only. It's analyze-mode-specific and should not consume tokens in refactor/execute modes.

**Alternative considered**: Extract to a queryable skill. Rejected for now — it's tightly coupled to analyze mode's tool set and phased execution. Making it a skill would require trigger matching, which is unnecessary since it's always needed in analyze mode.

### D6: Reader agent system_prompt

**Choice**: Add `system_prompt` field to `reader_agent` config in `config.yml` with:
- Directory tree policy (mandatory excludePatterns)
- Instruction to prefer `list_directory` + `read_text_file` over `directory_tree` for targeted inspection
- Concise identity ("You are a read-only repository exploration agent")

**Why**: The reader_agent (Kimi K2) runs in its own context window with no inherited constraints. Without explicit instructions, it calls `directory_tree` on large repos without excludePatterns.

## Risks / Trade-offs

**[Behavioral regression]** Removing duplicated sections from mode prompts changes what the model "sees" as emphasized. DeepSeek may interpret a single mention of `priority_policy` differently than 4 mentions.
-> Mitigation: Smoke test before/after on `ign24/agents` repo. Compare tool call counts, phase execution order, and output quality.

**[Skill coverage reduction]** Going from 4 to 2 active skills means less specialized guidance during full analysis.
-> Mitigation: The `full_analysis_protocol` already provides phase-by-phase structure. Skills add depth but the protocol is the skeleton. Monitor output quality on full analysis runs.

**[Skill truncation quality loss]** Hard truncation at 8KB may cut mid-section.
-> Mitigation: Truncate at nearest `##` heading boundary. Add `[SKILL TRUNCATED: see full guide at {path}]` notice.

**[Reader agent prompt size]** Adding system_prompt to reader_agent increases its context usage.
-> Mitigation: Keep it under 500 chars. Only essential constraints.
