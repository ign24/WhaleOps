## MODIFIED Requirements

### Requirement: Refactoring skill activates on refactoring-related user messages
The system SHALL activate the `refactoring` skill when the user message contains refactoring-related keywords. The skill SHALL be registered in `registry.yml` with triggers for both English and Spanish. The skill SHALL NOT activate in analyze mode — skill injection is disabled for analyze.

#### Scenario: English refactoring request activates skill in refactor mode
- **WHEN** the user sends a message containing "refactor", "rewrite", "restructure", "reorganize", or "clean up" while in refactor mode
- **THEN** the `refactoring` skill SHALL be activated for that request

#### Scenario: Spanish refactoring request activates skill in refactor mode
- **WHEN** the user sends a message containing "refactorizar", "reestructurar", "reorganizar", or "limpiar codigo" while in refactor mode
- **THEN** the `refactoring` skill SHALL be activated for that request

#### Scenario: Analyze mode does not activate refactoring skill
- **WHEN** the user sends any message while in analyze mode
- **THEN** NO skill block SHALL be injected — the `build_active_skills_block` call is skipped entirely for analyze mode
