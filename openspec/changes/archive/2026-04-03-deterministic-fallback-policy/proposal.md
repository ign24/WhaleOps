## Why

Current failure handling is partially graceful but not deterministic across sub-agent recursion, tool failures, and evidence quality gates. This causes hard stops, inconsistent fallback behavior, and low-trust outputs when the agent cannot fully complete long analyses.

## What Changes

- Define a deterministic fallback policy with explicit error classes and required actions per class.
- Add a bounded recovery loop (single scoped replan/retry) for recursion/timeout/tool failures before returning a structured partial response.
- Introduce loop-guard rules to prevent repeating equivalent tool calls under the same budget window.
- Enforce evidence-gated audit output: findings without file/line/tool evidence are marked as unconfirmed instead of asserted.
- Add runbook-grade observability events and counters for fallback activation, recovery success, and partial-output rate.

## Capabilities

### New Capabilities
- `deterministic-fallback-policy`: Classify runtime failures and apply deterministic recovery or graceful partial responses.
- `structured-partial-response-contract`: Standardize user-facing partial responses with verified scope, gaps, and next steps.
- `tool-loop-guard`: Detect repeated equivalent tool-call attempts and force replan instead of looping.

### Modified Capabilities
- `instruction-hierarchy`: Clarify that deterministic fallback policy overrides prompt-level discretionary behavior during runtime failures.
- `automatic-memory-retrieval`: Extend memory usage contract to include recovery context (recent failed attempts) as non-directive support for replanning.

## Impact

- Affected backend workflow: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py`.
- Affected prompts/contracts: analyze and specialist-agent output contracts where evidence and partial response sections are required.
- Affected observability: new trace events/counters for fallback classes and recovery outcomes.
- Affected tests: unit/integration coverage for recursion/timeouts/tool-validation failures, loop guards, and evidence-gated synthesis.
