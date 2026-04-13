## ADDED Requirements

### Requirement: every sub-agent finding must cite tool-backed evidence
Each domain sub-agent SHALL include an `<evidence_requirement>` section mandating that every reported finding includes:
- A location reference: file:line for code findings, or dependency:version for CVE findings.
- The source tool that produced the finding.
- A specific output excerpt from that tool that supports the claim.

#### Scenario: Security finding with file evidence
- **WHEN** security_agent reports a leaked secret
- **THEN** the finding includes the file path and line number where the secret appears
- **THEN** the finding includes the tool (e.g., run_gitleaks) and a truncated output excerpt showing the match

#### Scenario: CVE finding with dependency evidence
- **WHEN** security_agent reports a known CVE
- **THEN** the finding includes the dependency name and affected version
- **THEN** the finding includes the tool (e.g., run_trivy) and the CVE identifier from the output

#### Scenario: QA finding with test output evidence
- **WHEN** qa_agent reports a failing test
- **THEN** the finding includes the test file path and line of the failure assertion
- **THEN** the finding includes the failure message excerpt from run_pytest or run_jest output

#### Scenario: Coverage finding with metric evidence
- **WHEN** qa_agent reports a coverage gap
- **THEN** the finding includes the file or module with the gap
- **THEN** the finding includes the coverage percentage from analyze_test_coverage output

### Requirement: unverifiable findings are labeled and include a verification step
If a sub-agent cannot back a finding with tool output, it SHALL label it `[unconfirmed]` and include a concrete, deterministic verification step. The agent SHALL NOT present unconfirmed findings with the same weight as tool-backed ones.

#### Scenario: Tool unavailable for a suspected issue
- **WHEN** a sub-agent suspects an issue but the relevant tool is not installed or fails
- **THEN** the finding is labeled `[unconfirmed]`
- **THEN** the finding includes a specific command or step the user can run to verify it

#### Scenario: Pattern-based inference without tool confirmation
- **WHEN** a sub-agent infers a risk from code structure without running a scanner
- **THEN** the finding is labeled `[unconfirmed]`
- **THEN** the finding does NOT appear in the severity counts as a confirmed finding
