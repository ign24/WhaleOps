## 1. Sub-agent prompt refactoring

- [x] 1.1 Replace `Execution order` in `security_agent.md` with `<context_assessment>`, `<available_tools>`, and `<evidence_requirement>`
- [x] 1.2 Replace `Execution order` in `qa_agent.md` with `<context_assessment>`, `<available_tools>`, and `<evidence_requirement>`
- [x] 1.3 Replace `Execution order` in `review_agent.md` with `<context_assessment>`, `<available_tools>`, and `<evidence_requirement>`
- [x] 1.4 Replace `Execution order` in `docs_agent.md` with `<context_assessment>`, `<available_tools>`, and `<evidence_requirement>`

## 2. Orchestrator enhancements

- [x] 2.1 Add `<adaptive_delegation>` section to `analyze.md` instructing orchestrator to pass context without prescribing tools
- [x] 2.2 Extend `analyze.md` output_contract with step 5: consolidated findings summary grouped by severity with `[agent via tool]` source attribution and executive summary
