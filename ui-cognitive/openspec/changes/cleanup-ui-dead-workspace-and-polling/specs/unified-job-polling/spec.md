## ADDED Requirements

### Requirement: Single Polling Source of Truth
The system SHALL use a single shared polling mechanism for each jobs data domain to avoid duplicated requests from concurrent pollers.

#### Scenario: Multiple views request the same jobs updates
- **WHEN** two or more UI consumers subscribe to the same jobs data scope
- **THEN** only one effective polling loop issues network requests for that scope

### Requirement: Polling Lifecycle Control
The polling mechanism MUST provide centralized start, stop, and cancellation behavior to prevent orphan loops and race conditions.

#### Scenario: Consumer unmounts or scope changes
- **WHEN** the last consumer unsubscribes or request scope changes
- **THEN** the active polling loop for the previous scope is stopped or cancelled

### Requirement: Polling Request Reduction Verification
The system SHALL include before/after request measurement for affected jobs polling paths.

#### Scenario: Validate duplicate request reduction
- **WHEN** the consolidated poller is enabled and validated
- **THEN** measured duplicate requests for the same jobs scope are lower than baseline

### Requirement: Critical Flow Non-Regression Under Consolidated Polling
The system MUST preserve data freshness and user-visible behavior in critical flows after polling consolidation.

#### Scenario: Ops view under consolidated polling
- **WHEN** jobs status changes while the ops interface is active
- **THEN** updates remain visible within the expected polling refresh window
