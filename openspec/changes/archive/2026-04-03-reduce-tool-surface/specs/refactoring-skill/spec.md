## MODIFIED Requirements

### Requirement: Refactoring skill activates on refactoring-related user messages
The system SHALL activate the `refactoring` skill when the user message contains refactoring-related keywords. The skill SHALL be registered in `registry.yml` with triggers for both English and Spanish. The triggers SHALL be domain-specific; generic analysis phrases (e.g., `full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`) MUST NOT appear in the `refactoring` skill's trigger list.

#### Scenario: English refactoring request
- **WHEN** the user sends a message containing "refactor", "rewrite", "restructure", "reorganize", or "clean up"
- **THEN** the `refactoring` skill SHALL be activated for that request

#### Scenario: Spanish refactoring request
- **WHEN** the user sends a message containing "refactorizar", "reestructurar", "reorganizar", or "limpiar codigo"
- **THEN** the `refactoring` skill SHALL be activated for that request

#### Scenario: Generic analysis phrase does not activate refactoring skill
- **WHEN** the user sends a message containing only "full analysis", "analisis completo", "analizar repositorio", "review completo", "analiza el repo", or "analisis" — with no refactoring-specific keyword
- **THEN** the `refactoring` skill SHALL NOT be activated

### Requirement: security-review skill triggers are domain-specific
The `security-review` skill SHALL be triggered only by security-domain keywords. The triggers MUST NOT include generic analysis phrases (`full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`).

#### Scenario: Security keyword activates security-review skill
- **WHEN** the user message contains "security", "vulnerability", "vulnerabilities", "cve", "cves", "secret", "secrets", "owasp", "hardening", or "audit"
- **THEN** the `security-review` skill SHALL be activated

#### Scenario: Generic analysis phrase does not activate security-review skill
- **WHEN** the user sends a message containing only "full analysis" or "analisis completo" with no security-specific keyword
- **THEN** the `security-review` skill SHALL NOT be activated

### Requirement: code-reviewer skill triggers are domain-specific
The `code-reviewer` skill SHALL be triggered only by code-review-domain keywords. The triggers MUST NOT include generic analysis phrases (`full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`).

#### Scenario: Code review keyword activates code-reviewer skill
- **WHEN** the user message contains "code review", "pr review", "pull request", "lint", "complexity", "code smell", "diff", "quick review", or "quick analysis"
- **THEN** the `code-reviewer` skill SHALL be activated

#### Scenario: Generic analysis phrase does not activate code-reviewer skill
- **WHEN** the user sends a message containing only "analizar repositorio" or "review completo" with no code-review-specific keyword
- **THEN** the `code-reviewer` skill SHALL NOT be activated

### Requirement: senior-qa skill triggers are domain-specific
The `senior-qa` skill SHALL be triggered only by QA-domain keywords. The triggers MUST NOT include generic analysis phrases (`full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`).

#### Scenario: QA keyword activates senior-qa skill
- **WHEN** the user message contains "test", "tests", "qa", "coverage", "flaky", "regression", or "failing"
- **THEN** the `senior-qa` skill SHALL be activated

#### Scenario: Generic analysis phrase does not activate senior-qa skill
- **WHEN** the user sends a message containing only "analisis" or "full analysis" with no QA-specific keyword
- **THEN** the `senior-qa` skill SHALL NOT be activated

### Requirement: technical-writer skill triggers are domain-specific
The `technical-writer` skill SHALL be triggered only by documentation-domain keywords. The triggers MUST NOT include generic analysis phrases (`full analysis`, `analisis completo`, `analizar repositorio`, `review completo`, `analiza el repo`, `analisis`).

#### Scenario: Documentation keyword activates technical-writer skill
- **WHEN** the user message contains "docs", "documentation", "readme", "docstring", "onboarding", or "api docs"
- **THEN** the `technical-writer` skill SHALL be activated

#### Scenario: Generic analysis phrase does not activate technical-writer skill
- **WHEN** the user sends a message containing only "full analysis" or "analiza el repo" with no documentation-specific keyword
- **THEN** the `technical-writer` skill SHALL NOT be activated
