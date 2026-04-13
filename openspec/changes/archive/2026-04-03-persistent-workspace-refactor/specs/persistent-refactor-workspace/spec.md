## ADDED Requirements

### Requirement: Clone destination root selection
The clone repository capability SHALL allow callers to select a destination root of either `analysis` or `workspace`. The selected root MUST map to `/tmp/analysis` for `analysis` and `/app/workspace` for `workspace`. If no destination root is provided, the system MUST default to `analysis`.

#### Scenario: Clone to persistent workspace
- **WHEN** a caller invokes clone with destination root `workspace` and a valid repository URL
- **THEN** the repository is cloned under `/app/workspace/<destination-name>`

#### Scenario: Backward-compatible default behavior
- **WHEN** a caller invokes clone without a destination root
- **THEN** the repository is cloned under `/tmp/analysis/<destination-name>`

### Requirement: Deterministic root boundary enforcement
All repository clone destinations SHALL be validated against the approved root set (`/tmp/analysis`, `/app/workspace`). The system MUST reject any destination that resolves outside the selected approved root, including traversal attempts and invalid destination names.

#### Scenario: Reject traversal destination
- **WHEN** a caller provides a destination name that resolves outside the selected root
- **THEN** the clone request fails with a non-retryable validation error describing that the destination is outside the allowed root

#### Scenario: Reject unsupported root selector
- **WHEN** a caller provides a destination root value outside the supported set (`analysis`, `workspace`)
- **THEN** the clone request fails with a non-retryable validation error explaining supported values

### Requirement: Workspace persistence semantics
The system SHALL document and expose `/app/workspace` as persistent working memory for refactor/execute flows and `/tmp/analysis` as ephemeral sandbox working area. The system MUST clarify that findings persisted to the findings store are episodic memory and do not replace filesystem persistence.

#### Scenario: Refactor guidance for persistent output
- **WHEN** refactor or execute mode guidance references output paths
- **THEN** it explicitly states that persistent repository outputs belong in `/app/workspace`

#### Scenario: Memory layer clarification
- **WHEN** operator-facing documentation describes memory behavior
- **THEN** it differentiates working-memory files (`/tmp/analysis`, `/app/workspace`) from episodic findings storage
