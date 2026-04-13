## ADDED Requirements

### Requirement: Fixture repo contains known intentional issues
The directory `tests/fixtures/sample_repo/` SHALL contain: a Python module with at least one `ruff`-detectable lint issue, a Python module with at least one `bandit`-detectable security issue, a `README.md` with `## Install` and `## Usage` sections, and a `test_*.py` file with at least one passing test.

#### Scenario: ruff finds lint issues in fixture
- **WHEN** `ruff check tests/fixtures/sample_repo/` is run
- **THEN** it exits with non-zero and reports at least one issue

#### Scenario: bandit finds security issue in fixture
- **WHEN** `bandit -r tests/fixtures/sample_repo/ -f json` is run
- **THEN** the JSON output contains at least one result in the `results` array

#### Scenario: README passes docs tool check
- **WHEN** `check_readme_tool` runs against `tests/fixtures/sample_repo/`
- **THEN** `exists`, `has_install`, and `has_usage` are all `true`

#### Scenario: pytest runs cleanly on fixture
- **WHEN** `pytest tests/fixtures/sample_repo/ -q` is run
- **THEN** at least one test passes and exit code is 0

### Requirement: Fixture repo has a README documenting intentional issues
`tests/fixtures/sample_repo/README.md` SHALL include an `## Intentional Issues` section listing each known issue by tool name, so maintainers know not to "fix" them.

#### Scenario: README documents issues
- **WHEN** a developer reads `tests/fixtures/sample_repo/README.md`
- **THEN** they can identify which lint/security issues are intentional and which tool detects them
