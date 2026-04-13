## MODIFIED Requirements

### Requirement: Partial responses SHALL follow a fixed structure
When the workflow cannot fully complete under available budget, the final assistant response SHALL use a structured partial-response contract with explicit sections: `Verified`, `Unverified`, `Blocked By`, and `Next Steps`.

This contract SHALL apply to constrained execution outcomes including recursion exhaustion, tool timeout exhaustion, and deterministic budget denials.

#### Scenario: Recursion exhaustion returns structured partial output
- **WHEN** recovery is exhausted after `RECURSION_LIMIT`
- **THEN** the assistant response SHALL include all required sections
- **AND** SHALL identify what was verified versus what remained unverified

#### Scenario: Tool timeout returns structured partial output
- **WHEN** recovery is exhausted after `TOOL_TIMEOUT`
- **THEN** the assistant response SHALL include required sections
- **AND** SHALL include a concrete next step that can continue the analysis

#### Scenario: Budget exhaustion returns structured partial output
- **WHEN** deterministic tool-budget limits prevent full task completion
- **THEN** the assistant response SHALL include required sections
- **AND** SHALL explicitly separate completed scope from pending scope in `Verified` and `Unverified`

## ADDED Requirements

### Requirement: Structured partial output SHALL remain machine-consumable
Structured partial outputs SHALL avoid free-form failure wrappers that break downstream parsing and SHALL preserve stable section labels.

#### Scenario: Constrained run keeps stable section labels
- **WHEN** a response is finalized under constrained budget
- **THEN** section labels SHALL remain exactly `Verified`, `Unverified`, `Blocked By`, and `Next Steps`
- **AND** output SHALL not be replaced with generic processing-error prose only
