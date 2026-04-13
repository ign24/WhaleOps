## Context

The four domain sub-agents are `tool_calling_agent` instances (not `safe_tool_calling_agent`), so they receive no skill injections. Their only instruction source is their system prompt. The previous prompts used a hardcoded `Execution order` that treated every repository identically — Python scanners ran on JS repos, all three doc tools ran even when only README coverage was asked.

Skills in `registry.yml` (`security-review`, `senior-qa`, `code-reviewer`, `technical-writer`) correspond to the same domains, but skills are injected into the main agent only in non-analyze modes (enforced at `safe_tool_calling_agent.py:1556`). There is no double-context risk at runtime.

The orchestrator (`analyze.md`) already had a `planning_policy` that selected which sub-agents to call. It lacked guidance on what context to pass and produced no cross-domain consolidated output.

## Goals / Non-Goals

**Goals:**
- Sub-agents assess the request and repo signals before selecting tools.
- Every finding is tool-backed: file:line (or dep:version) + output excerpt. No unverifiable claims.
- Orchestrator consolidates sub-agent findings into one cross-domain summary grouped by severity with source attribution.
- Orchestrator does not prescribe tool selection to sub-agents.

**Non-Goals:**
- No changes to `safe_tool_calling_agent.py`, `composer.py`, `registry.yml`, or any skill file.
- No changes to modes other than analyze (refactor, execute, chat, base untouched).
- No new tools, no new sub-agents, no config.yml changes.

## Decisions

**D1: Context assessment block instead of execution order**
Each sub-agent gets a `<context_assessment>` section that teaches it to infer language, stack, and request focus from available signals before choosing tools. Alternative considered: remove all guidance and rely on model judgment alone. Rejected — without structured prompting, models default to running all tools mechanically.

**D2: Available tools listed without implicit order**
Tools are listed under `<available_tools>` as a flat inventory. The prose explicitly says "you do not need to run all of them." Alternative: remove tool list entirely. Rejected — sub-agents need to know what's in their toolbelt, especially for less common tools like `query_qa_knowledge`.

**D3: Evidence requirement as a hard contract**
`<evidence_requirement>` mandates file:line or dep:version plus a tool output excerpt per finding. Findings without evidence must be labeled `[unconfirmed]` with a verification step. This prevents hallucinated findings from mixing with tool-backed ones. Alternative: leave evidence guidance in the output_format section only. Rejected — output_format is too late; the requirement must be framed as a constraint during analysis, not just at reporting time.

**D4: Orchestrator passes context, does not prescribe tools**
`<adaptive_delegation>` in `analyze.md` instructs the orchestrator to include repo path, language if known, and specific concern in the delegation message — but never to specify which tools the sub-agent should use. Alternative: keep orchestrator silent on delegation framing. Rejected — without guidance, orchestrators tend to either over-prescribe ("run gitleaks, then trivy, then...") or under-specify (just the repo path).

**D5: Consolidated summary lives in output_contract step 5**
The orchestrator aggregates findings from all sub-agents into one view grouped by severity, each item tagged `[agent via tool]`. The executive summary (5–7 lines) synthesizes across domains. Alternative: each sub-agent produces its own summary and the user reads four separate reports. Rejected per explicit user requirement: the orchestrator consolidates, sub-agents are responsible for their own evidence.

## Risks / Trade-offs

[Risk] Sub-agents may run fewer tools than needed if context signals are ambiguous → Mitigation: `<context_assessment>` includes a fallback heuristic for each agent (e.g., security_agent defaults to gitleaks when language is unknown).

[Risk] Evidence requirement adds output length → Mitigation: requirement is per-finding, not per-run. If a sub-agent finds nothing, the output is short. Length grows only with actual findings.

[Risk] Consolidated summary may omit findings if sub-agent output is poorly structured → Mitigation: orchestrator is instructed to synthesize, not copy verbatim. If a sub-agent returns no structured findings, that absence is itself reported.

## Migration Plan

Pure prompt changes — no deployment steps, no rollback strategy needed. Old prompts are replaced in-place. Reverting means restoring the previous prompt text from git history.

## Open Questions

None. All decisions made and implemented.
