## ADDED Requirements

### Requirement: NAT-registered tool signatures MUST be introspection-safe at startup
For every NAT tool built with `FunctionInfo.from_fn`, function annotations used during workflow build SHALL resolve to concrete runtime classes compatible with NAT subtype checks.

#### Scenario: Workflow build evaluates tool output type
- **WHEN** NAT builds function metadata for a registered tool via `FunctionInfo.from_fn`
- **THEN** annotation inspection SHALL NOT raise `TypeError` due to non-class output types

#### Scenario: Deferred annotation strings are avoided in NAT-sensitive tool modules
- **WHEN** a tool module is known to be NAT-introspection-sensitive
- **THEN** the module SHALL avoid deferred annotation behavior that can expose string-based annotations at build time

---

### Requirement: Registration-level regression test coverage MUST exist for startup-critical tools
Startup-critical tools SHALL include at least one automated test that exercises registration metadata creation, not only runtime business logic.

#### Scenario: Registration metadata creation for `generate_report`
- **WHEN** unit tests run for report tooling
- **THEN** at least one test SHALL verify that report tool registration metadata creation succeeds without raising introspection errors
