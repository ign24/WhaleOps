## 1. Runtime preflight wiring (execute mode)

- [ ] 1.1 Identify execute-mode entry point in `safe_tool_calling_agent` pipeline where preflight can run exactly once per request
- [ ] 1.2 Implement `execute` preflight helper that invokes `query_findings` with bounded timeout/result cap and maps outcomes to `hit|miss|degraded|skipped`
- [ ] 1.3 Persist preflight output in structured request state (status, reason, count, compact summary)
- [ ] 1.4 Ensure preflight runs before first write-capable tool call in `execute` and is not forced in `analyze`/`chat`

## 2. Findings-store compatibility and fallback contract

- [ ] 2.1 Confirm `query_findings` degraded payload shape is stable for runtime mapping; adjust only if needed for deterministic preflight mapping
- [ ] 2.2 Add/adjust lightweight config knobs for preflight bounds (timeout and top-k) with safe defaults
- [ ] 2.3 Add structured logging for preflight outcome (`mode`, `status`, `reason`, `count`)

## 3. Tests

- [ ] 3.1 Unit test: `execute` triggers preflight before write-capable tool execution
- [ ] 3.2 Unit test: preflight `hit` stores context in state and flow proceeds
- [ ] 3.3 Unit test: preflight `miss` stores status and flow proceeds
- [ ] 3.4 Unit test: preflight timeout/backend failure maps to `degraded` and flow remains fail-open
- [ ] 3.5 Unit test: `analyze` and `chat` do not enforce deterministic preflight
- [ ] 3.6 Integration test: end-to-end execute sequence verifies ordering `preload -> execution`

## 4. Validation and docs

- [ ] 4.1 Run targeted test suite for agent runtime + findings-store affected tests
- [ ] 4.2 Update prompt/config comments if needed to align docs with runtime enforcement
- [ ] 4.3 Run full test suite and confirm no regressions before archive
