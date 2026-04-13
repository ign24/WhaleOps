## MODIFIED Requirements

### Requirement: Dashboard observability loading behavior
The dashboard MUST differentiate between "no trace data" and "configuration/connectivity failure" states when loading observability metrics.

#### Scenario: No traces produced yet
- **WHEN** the configured trace source exists but there are no processable trace lines
- **THEN** the dashboard MUST show a non-error empty-state hint for missing trace activity

#### Scenario: Trace source is unavailable
- **WHEN** the configured trace source path cannot be resolved or read
- **THEN** the dashboard MUST show a configuration error hint with the expected trace path contract

#### Scenario: NAT monitor endpoint unavailable
- **WHEN** the dashboard summary endpoint cannot obtain monitor metrics from NAT
- **THEN** the dashboard MUST show backend monitor unavailability without hiding available trace metrics
