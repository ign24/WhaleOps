## ADDED Requirements

### Requirement: orchestrator produces a consolidated cross-domain findings summary
The analyze orchestrator (`analyze.md`) output_contract SHALL include a consolidated findings summary as the final section. This summary SHALL aggregate findings from all invoked sub-agents into a single cross-domain view grouped by severity (P0 → P1 → P2). The orchestrator SHALL synthesize, not copy sub-agent outputs verbatim.

#### Scenario: Full analysis with findings across multiple domains
- **WHEN** the orchestrator receives outputs from two or more sub-agents with findings
- **THEN** it produces a consolidated section listing all findings grouped by severity
- **THEN** each finding is tagged with its source in the format `[agent via tool]`
- **THEN** the section ends with a 5–7 line executive summary stating overall risk level, most critical domain, and top recommended action

#### Scenario: Full analysis with no findings
- **WHEN** all invoked sub-agents return no findings
- **THEN** the consolidated summary states that no issues were found across the analyzed domains
- **THEN** the executive summary notes which domains were covered and confirms clean status

#### Scenario: Partial analysis (single sub-agent invoked)
- **WHEN** only one sub-agent is invoked (targeted request)
- **THEN** the consolidated summary reflects only that domain's findings
- **THEN** the executive summary does not speculate about unchecked domains

### Requirement: consolidated summary uses source attribution per finding
Each finding in the consolidated summary SHALL include a source tag identifying the sub-agent and the specific tool that produced it.

#### Scenario: Finding from security_agent via run_gitleaks
- **WHEN** security_agent reports a leaked credential detected by run_gitleaks
- **THEN** the consolidated summary entry reads: `[security_agent via run_gitleaks] <description> — <file:line>`

#### Scenario: Finding from review_agent via run_ruff
- **WHEN** review_agent reports a linting violation detected by run_ruff
- **THEN** the consolidated summary entry reads: `[review_agent via run_ruff] <description> — <file:line>`

#### Scenario: Unconfirmed finding in consolidated summary
- **WHEN** a sub-agent reports an `[unconfirmed]` finding
- **THEN** the consolidated summary preserves the `[unconfirmed]` label
- **THEN** the finding is NOT counted in the severity totals as a confirmed issue
