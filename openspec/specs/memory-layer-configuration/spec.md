## ADDED Requirements

### Requirement: Memory layers use a schema-safe configuration source
The system SHALL load L0/L1/L2 memory configuration from an application-owned config source that does not conflict with NAT root schema validation.

#### Scenario: Dedicated memory config file is present
- **WHEN** the memory config loader initializes
- **THEN** it reads memory settings from the dedicated memory config path
- **AND** applies `working`, `episodic`, `semantic`, and `auto_retrieval` settings from that source

#### Scenario: Dedicated memory config file is absent
- **WHEN** the dedicated memory config path does not exist
- **THEN** the loader falls back to legacy inlined config (if present)
- **AND** otherwise uses safe defaults

### Requirement: Memory layer mapping is explicit and operator-visible
The system SHALL expose a documented mapping between memory layers and configuration sections.

#### Scenario: Operator reads configuration docs
- **WHEN** an operator checks setup documentation
- **THEN** L0 is documented as `working`
- **AND** L1 is documented as `episodic` + `findings`
- **AND** L2 is documented as `semantic`
