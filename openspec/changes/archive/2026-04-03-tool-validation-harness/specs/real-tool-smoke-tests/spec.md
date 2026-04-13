## ADDED Requirements

### Requirement: ruff smoke test validates code review tool output contract
The `test_code_review_flow_e2e.py` test SHALL invoke `run_ruff_tool` against the shared fixture repo using the real `ruff` binary (skipped if not installed), and assert that the JSON output contains `issues`, `returncode`, and `duration_ms` fields with a non-null `issues` value.

#### Scenario: ruff detects issues in fixture repo
- **WHEN** `run_ruff_tool` runs against `tests/fixtures/sample_repo/` with the real binary
- **THEN** `returncode` is an integer, `issues` is a non-empty string, and `duration_ms` is greater than 0

#### Scenario: ruff binary not installed
- **WHEN** `shutil.which("ruff")` returns None
- **THEN** the test is skipped with reason "ruff binary not installed"

### Requirement: semgrep smoke test validates security tool output contract
The `test_code_review_flow_e2e.py` test SHALL invoke `run_semgrep_tool` against the shared fixture repo using the real `semgrep` binary (skipped if not installed), and assert that the JSON output contains `findings`, `returncode`, and `duration_ms` fields.

#### Scenario: semgrep scans fixture repo
- **WHEN** `run_semgrep_tool` runs against `tests/fixtures/sample_repo/` with the real binary
- **THEN** `returncode` is an integer, `findings` is a valid JSON string, and `duration_ms` is greater than 0

#### Scenario: semgrep binary not installed
- **WHEN** `shutil.which("semgrep")` returns None
- **THEN** the test is skipped with reason "semgrep binary not installed"

### Requirement: All real_tools e2e tests target the shared fixture repo
All tests marked `real_tools` SHALL use `tests/fixtures/sample_repo/` as the target, bypassing sandbox path checks via `monkeypatch.setattr(module, "ensure_repo_path", ...)`.

#### Scenario: Fixture repo path is injected via monkeypatch
- **WHEN** a `real_tools` test runs
- **THEN** `ensure_repo_path` is patched to return the fixture path directly, preventing `ValueError` from sandbox root validation
