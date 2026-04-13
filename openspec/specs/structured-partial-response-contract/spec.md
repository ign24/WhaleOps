## ADDED Requirements

### Requirement: Partial responses SHALL follow a fixed structure
When the workflow cannot fully complete under available budget, the final assistant response SHALL use a structured partial-response contract with explicit sections: `Verified`, `Unverified`, `Blocked By`, and `Next Steps`.

#### Scenario: Recursion exhaustion returns structured partial output
- **WHEN** recovery is exhausted after `RECURSION_LIMIT`
- **THEN** the assistant response SHALL include all required sections
- **AND** SHALL identify what was verified versus what remained unverified

#### Scenario: Tool timeout returns structured partial output
- **WHEN** recovery is exhausted after `TOOL_TIMEOUT`
- **THEN** the assistant response SHALL include required sections
- **AND** SHALL include a concrete next step that can continue the analysis

### Requirement: Findings SHALL be evidence-gated in partial and final synthesis
Security and audit findings SHALL only be asserted as confirmed when evidence is present (file path, line/range, and source tool). Findings without sufficient evidence SHALL be labeled `unconfirmed`.

#### Scenario: Finding with full evidence is confirmed
- **WHEN** a finding includes `path:line`, contextual snippet, and source tool
- **THEN** the finding SHALL be marked as confirmed in the response

#### Scenario: Finding without evidence is unconfirmed
- **WHEN** a finding lacks any required evidence field
- **THEN** the finding SHALL be labeled `unconfirmed`
- **AND** SHALL include a verification step under `Next Steps`
