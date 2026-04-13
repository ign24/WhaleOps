## ADDED Requirements

### Requirement: Agent can generate a structured markdown report
The system SHALL expose a `generate_report` tool that produces a date-stamped markdown file summarizing agent findings, dependency observations, and code quality metrics.

#### Scenario: Generate report with findings available
- **WHEN** the agent calls `generate_report` and Milvus contains findings
- **THEN** the system SHALL write a markdown file to `{REPORT_OUTPUT_DIR}/YYYY-MM-DD.md` with sections for findings summary, dependency observations, and a summary block

#### Scenario: Generate report with no findings
- **WHEN** the agent calls `generate_report` and Milvus contains no findings
- **THEN** the system SHALL write a markdown file with empty sections and a note indicating no findings were recorded

#### Scenario: Generate report with Milvus unavailable
- **WHEN** the agent calls `generate_report` and Milvus is unreachable
- **THEN** the system SHALL write a markdown file with a "Findings unavailable — Milvus unreachable" note in the findings section, and SHALL NOT fail the tool call

---

### Requirement: Report output path is configurable
The report output directory SHALL be configurable via the `REPORT_OUTPUT_DIR` environment variable, defaulting to `/app/workspace/reports/`.

#### Scenario: Default output directory
- **WHEN** `REPORT_OUTPUT_DIR` is not set
- **THEN** reports SHALL be written to `/app/workspace/reports/YYYY-MM-DD.md`

#### Scenario: Custom output directory
- **WHEN** `REPORT_OUTPUT_DIR` is set to `/data/obsidian-vault/reports`
- **THEN** reports SHALL be written to `/data/obsidian-vault/reports/YYYY-MM-DD.md`

#### Scenario: Directory does not exist
- **WHEN** the configured output directory does not exist
- **THEN** the system SHALL create it (including intermediate directories) before writing the report

---

### Requirement: Report includes YAML frontmatter for Obsidian compatibility
Each report file SHALL include YAML frontmatter with metadata fields that enable Obsidian Dataview queries without additional configuration.

#### Scenario: Frontmatter contains required fields
- **WHEN** a report is generated for repo `owner/repo-name` on `2026-04-08`
- **THEN** the frontmatter SHALL include `date: 2026-04-08`, `type: daily-report`, and `repos: [owner/repo-name]`

#### Scenario: Report with multiple repos
- **WHEN** findings span multiple repositories
- **THEN** the `repos` frontmatter field SHALL list all unique repository identifiers

---

### Requirement: Report is idempotent within a day
Running the report tool multiple times on the same day SHALL overwrite the existing report file for that date, not create duplicates.

#### Scenario: Second run overwrites first
- **WHEN** `generate_report` is called twice on `2026-04-08`
- **THEN** `2026-04-08.md` SHALL contain only the data from the second run

---

### Requirement: Report content sections
The report SHALL contain the following sections in order: Findings Summary, Dependency Observations, and Summary.

#### Scenario: Findings summary section
- **WHEN** Milvus contains findings with severity and type metadata
- **THEN** the Findings Summary section SHALL group findings by severity (critical, high, medium, low) with count, type, and brief description for each

#### Scenario: Dependency observations section
- **WHEN** the report is generated for a repository
- **THEN** the Dependency Observations section SHALL include a placeholder noting that dependency intelligence is not yet integrated, with a link to future capability

#### Scenario: Summary block
- **WHEN** the report is generated
- **THEN** the Summary section SHALL include total finding count, breakdown by severity, and the date range covered (since last report or last 24 hours if no prior report exists)

---

### Requirement: generate_report is available in execute mode only
The `generate_report` tool SHALL be registered in `execute` mode's `tool_names` list and SHALL NOT be available in `analyze` or `chat` modes.

#### Scenario: Tool available in execute mode
- **WHEN** the agent is running in execute mode
- **THEN** `generate_report` SHALL be in the available tool list

#### Scenario: Tool unavailable in analyze mode
- **WHEN** the agent is running in analyze mode
- **THEN** `generate_report` SHALL NOT be in the available tool list
