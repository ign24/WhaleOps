# refactoring-skill Specification

## Purpose
TBD - created by archiving change agent-refactoring-powers. Update Purpose after archive.
## Requirements
### Requirement: Custom refactor_gen tool with professional system prompt
The system SHALL provide a custom `refactor_gen` tool that wraps devstral with a system prompt establishing the identity of a senior software engineer performing production refactoring for an enterprise. The tool MUST NOT use the generic `code_gen` system prompt ("teach a junior developer"). The tool MUST accept a single query string and return the complete refactored file content.

#### Scenario: refactor_gen system prompt identity
- **WHEN** the `refactor_gen` tool is invoked
- **THEN** the system prompt SHALL establish the LLM as a senior software engineer performing production-grade refactoring, and SHALL instruct it to follow expert guidelines provided in the query

#### Scenario: refactor_gen does not hardcode a language
- **WHEN** the `refactor_gen` tool is invoked for a Python file and then for a TypeScript file
- **THEN** the system prompt SHALL NOT hardcode any programming language; the language context SHALL come from the query

#### Scenario: refactor_gen outputs complete files
- **WHEN** the `refactor_gen` tool returns a response
- **THEN** the output SHALL be a complete, production-ready file — not a diff, not a snippet, not an explanation with inline code

### Requirement: Refactoring skill activates on refactoring-related user messages
The system SHALL activate the `refactoring` skill when the user message contains refactoring-related keywords. The skill SHALL be registered in `registry.yml` with triggers for both English and Spanish.

#### Scenario: English refactoring request
- **WHEN** the user sends a message containing "refactor", "rewrite", "restructure", "reorganize", or "clean up"
- **THEN** the `refactoring` skill SHALL be activated for that request

#### Scenario: Spanish refactoring request
- **WHEN** the user sends a message containing "refactorizar", "reestructurar", "reorganizar", or "limpiar codigo"
- **THEN** the `refactoring` skill SHALL be activated for that request

### Requirement: Refactoring skill guides the orchestrator through stack detection
The skill SHALL instruct deepseek (the orchestrator) to detect the project stack before planning. Detection MUST be based on reading actual project files, not guessing from the user message.

#### Scenario: Python project detection
- **WHEN** the cloned repo contains `pyproject.toml` or `setup.py` or `requirements.txt`
- **THEN** the orchestrator SHALL classify the project as Python stack and select Python expert guidelines

#### Scenario: Frontend project detection
- **WHEN** the cloned repo contains `package.json` with React/Next.js dependencies
- **THEN** the orchestrator SHALL classify the project as Frontend stack and select frontend expert guidelines

#### Scenario: Fullstack project detection
- **WHEN** the cloned repo contains both Python config files and a package.json with frontend framework dependencies
- **THEN** the orchestrator SHALL classify the project as Fullstack and select both Python and frontend expert guidelines

#### Scenario: Backend Node.js detection
- **WHEN** the cloned repo contains `package.json` with Express/Fastify/NestJS dependencies but no frontend framework
- **THEN** the orchestrator SHALL classify the project as Backend Node.js and select backend-patterns expert guidelines

### Requirement: Refactoring skill includes curated expert guidelines per stack
The skill SHALL contain curated extracts from expert skills that deepseek packages into the query sent to `refactor_gen`. These extracts MUST come from the authoritative curated skills.

#### Scenario: Python refactoring receives python-expert guidelines
- **WHEN** the orchestrator calls `refactor_gen` for a Python file
- **THEN** the query SHALL include curated guidelines from python-expert covering: PEP 8 compliance, type hints on all public functions, proper error handling, avoiding mutable defaults, preferring comprehensions and context managers, and docstring conventions

#### Scenario: Frontend refactoring receives frontend expert guidelines
- **WHEN** the orchestrator calls `refactor_gen` for a React/Next.js file
- **THEN** the query SHALL include curated guidelines from senior-frontend and vercel-react-best-practices covering: component composition patterns, hooks discipline, TypeScript strictness, performance optimization, and RSC boundaries where applicable

#### Scenario: Backend Node.js refactoring receives backend guidelines
- **WHEN** the orchestrator calls `refactor_gen` for a Node.js/Express file
- **THEN** the query SHALL include curated guidelines from backend-patterns covering: repository/service pattern, proper error handling middleware, input validation, query optimization, and middleware composition

### Requirement: Refactoring skill enforces a per-file read-plan-write-validate cycle
The skill SHALL instruct the orchestrator to process files one at a time following a mandatory cycle. The orchestrator MUST NOT stop at showing snippets or proposing changes. **When existing tests are detected, the orchestrator SHALL verify they pass before starting any refactoring (safety net), and verify they still pass after completing each file.**

#### Scenario: Single file refactoring cycle
- **WHEN** the orchestrator processes a file from the refactoring plan
- **THEN** it SHALL: (1) read the file content, (2) package a structured query with project context + plan for this file + file content + relevant expert guidelines, (3) call `refactor_gen`, (4) write the result to the cloned repo with `write_file`, (5) run the appropriate linter

#### Scenario: Devstral adjusts the plan
- **WHEN** `refactor_gen` returns code that differs from the original plan (e.g., devstral found an issue the plan missed)
- **THEN** the orchestrator SHALL accept the adjustment and note it in the final manifest

#### Scenario: Validation failure
- **WHEN** a linter reports errors after writing a refactored file
- **THEN** the orchestrator SHALL re-invoke `refactor_gen` with the error output appended to the query, up to 2 retry attempts per file

#### Scenario: Test safety net before refactoring
- **WHEN** the orchestrator detects an existing test suite in the project (pytest, jest, or equivalent)
- **THEN** it SHALL run the test suite before beginning any file modifications to establish a GREEN baseline

#### Scenario: Test safety net after each file
- **WHEN** the orchestrator completes the write-validate cycle for a refactored file and a test suite exists
- **THEN** it SHALL run the relevant tests to verify the refactoring did not introduce regressions

### Requirement: Refactored files are written on the cloned repo
The system SHALL write refactored files in-place on the cloned repository at `/tmp/analysis/{repo_name}`.

#### Scenario: Repo already cloned
- **WHEN** the repository has been previously cloned to `/tmp/analysis/{repo_name}`
- **THEN** the orchestrator SHALL write refactored files directly in that directory tree

#### Scenario: Repo not yet cloned
- **WHEN** the user asks for a refactoring but no cloned repo exists
- **THEN** the orchestrator SHALL clone the repository first using `clone_repository`, then proceed

### Requirement: Agent provides a change manifest after refactoring
The system SHALL produce a summary of all changes after completing the refactoring cycle.

#### Scenario: Successful multi-file refactoring
- **WHEN** the orchestrator completes refactoring of multiple files
- **THEN** it SHALL output a manifest listing: file path, change type (modified/created), one-line description of what changed, and whether devstral adjusted the plan

#### Scenario: Partial completion due to iteration budget
- **WHEN** the orchestrator exhausts its iteration budget before finishing all planned files
- **THEN** it SHALL output the manifest for completed files and explicitly list remaining files that were not refactored

### Requirement: Token budgets support multi-file refactoring
The system SHALL configure LLM token limits sufficient for full-project refactoring.

#### Scenario: Devstral generates a large refactored file
- **WHEN** devstral generates a refactored file that exceeds 8192 tokens
- **THEN** the output SHALL NOT be truncated (max_tokens MUST be at least 32768)

#### Scenario: Deepseek orchestrates a long refactoring session
- **WHEN** the orchestrator reasons about a multi-file refactoring plan
- **THEN** the output SHALL NOT be truncated (max_tokens MUST be at least 16384)

#### Scenario: Agent handles 8+ file refactoring
- **WHEN** the user requests refactoring of a project with 8 or more files
- **THEN** the agent SHALL have enough iterations to complete the cycle (max_iterations MUST be at least 40)

