## ADDED Requirements

### Requirement: Default max active skills is 2
The `registry.yml` SHALL set `default_max_active_skills` to 2. At most 2 skills SHALL be injected into the system prompt per request.

#### Scenario: Full analysis activates only 2 skills
- **WHEN** a user requests "full analysis" which matches triggers for security-review, code-reviewer, senior-qa, and technical-writer
- **THEN** only the 2 highest-scoring skills by trigger match are injected

#### Scenario: Single-dimension request activates 1 skill
- **WHEN** a user requests "review the code" which matches only code-reviewer
- **THEN** only 1 skill is injected

### Requirement: Skill content has a size cap
Each skill's content SHALL be capped at a configurable maximum character count before injection. The global default SHALL be 8000 characters. Individual skills MAY override this with a per-skill `max_chars` field in `registry.yml`.

#### Scenario: Skill under the cap is injected in full
- **WHEN** a skill file is 4,000 characters and the cap is 8,000
- **THEN** the full skill content is injected without modification

#### Scenario: Skill over the cap is truncated at section boundary
- **WHEN** a skill file is 13,000 characters and the cap is 8,000
- **THEN** the content is truncated at the nearest `##` heading boundary at or before 8,000 characters
- **AND** a notice `[SKILL TRUNCATED: full content at {file_path}]` is appended

#### Scenario: Per-skill override takes precedence
- **WHEN** `registry.yml` defines `max_chars: 12000` for a specific skill and the global default is 8000
- **THEN** the skill is capped at 12,000 characters, not 8,000

### Requirement: Total skill payload has a token budget
The combined character count of all injected skills SHALL NOT exceed 16,000 characters. If selecting 2 skills would exceed this budget, the lower-priority skill is truncated further or dropped.

#### Scenario: Two skills within budget
- **WHEN** skill A is 7,000 chars and skill B is 5,000 chars (total 12,000)
- **THEN** both are injected in full

#### Scenario: Two skills exceed budget
- **WHEN** skill A is 8,000 chars and skill B is 10,000 chars (total 18,000 > 16,000)
- **THEN** skill B is truncated to fit within the 16,000 total budget
