## Why

The four domain sub-agents (security_agent, qa_agent, review_agent, docs_agent) followed rigid execution orders that ran a fixed tool sequence regardless of the repository context, language, or the specific concern raised. This produced unnecessary tool calls, missed adaptive opportunities, and generated findings without mandatory tool-backed evidence, making outputs harder to trust and act on.

## What Changes

- Replace `Execution order` blocks in all four sub-agent prompts with `<context_assessment>` — agents now infer stack and request focus before choosing tools.
- Add `<available_tools>` sections that list tools without implied order; agents choose the relevant subset.
- Add `<evidence_requirement>` as a mandatory contract: every finding must cite file:line (or dep:version) plus the tool output excerpt that supports it. Unverifiable findings are labeled `[unconfirmed]`.
- Add `<adaptive_delegation>` to `analyze.md`: the orchestrator passes rich context to sub-agents but does not prescribe tool selection.
- Extend `analyze.md` output_contract with a **Consolidated findings summary** (step 5): cross-domain view grouped by severity, each item sourced as `[agent via tool]`, ending with a 5–7 line executive summary.

## Capabilities

### New Capabilities

- `adaptive-subagent-execution`: Sub-agents assess repo context and choose tools based on the specific case rather than following a fixed execution order.
- `evidence-backed-findings`: Every sub-agent finding requires tool-backed evidence (file:line or dep:version + output excerpt). Unverifiable findings are explicitly labeled.
- `consolidated-findings-summary`: The analyze orchestrator produces a single cross-domain findings view grouped by severity with source attribution, plus an executive summary.

### Modified Capabilities

- `agent-driven-analysis-planning`: The orchestrator's delegation strategy now instructs it not to prescribe tool usage to sub-agents — adaptive_delegation replaces implicit tool sequencing assumptions.

## Impact

- `src/cognitive_code_agent/prompts/system/security_agent.md`
- `src/cognitive_code_agent/prompts/system/qa_agent.md`
- `src/cognitive_code_agent/prompts/system/review_agent.md`
- `src/cognitive_code_agent/prompts/system/docs_agent.md`
- `src/cognitive_code_agent/prompts/system/analyze.md`

No code changes, no API changes, no dependency changes. Pure prompt engineering.
