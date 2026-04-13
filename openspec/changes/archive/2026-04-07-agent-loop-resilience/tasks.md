## 1. Idempotent Clone

- [x] 1.1 Add `_normalize_repo_url(url: str) -> str` helper in `clone_tools.py` that strips `.git` suffix, auth tokens, and trailing slashes for URL comparison
- [x] 1.2 Add `_check_existing_clone(destination: Path, expected_url: str) -> dict | None` helper that runs `git -C <dest> remote get-url origin` with 5s timeout and returns a result dict (`match`, `conflict`, or `error`) or `None` if dir doesn't exist
- [x] 1.3 Modify `_resolve_destination()` to return `(path, existing_clone_result)` tuple instead of raising on existing directory — move the exists-check to caller
- [x] 1.4 Update `clone_repository_tool()` to check existing clone before git clone: if match → return success with `"clone_type": "existing"`; if conflict → return error; if not a repo → return error
- [x] 1.5 Write unit tests: `test_clone_reuses_existing_matching_repo`, `test_clone_rejects_existing_different_repo`, `test_clone_rejects_existing_non_git_dir`, `test_clone_rejects_corrupted_git_dir`, `test_normalize_repo_url_strips_git_suffix`, `test_normalize_repo_url_strips_auth_token`

## 2. DEGRADED Function Recovery (ainvoke probe)

- [x] 2.1 Write failing test: when stream fails with DEGRADED and ainvoke probe succeeds, agent returns ainvoke content (not partial response)
- [x] 2.2 Write failing test: when stream fails with DEGRADED and ainvoke probe also fails with DEGRADED, agent returns structured partial response with `blocked_by`
- [x] 2.3 Write failing test: when stream fails with DEGRADED and ainvoke probe fails with SERVER_ERROR, agent applies SERVER_ERROR policy
- [x] 2.4 Replace the hard ainvoke skip block (lines 2256-2278) with guarded single-attempt ainvoke probe: try ainvoke once → on success use result, on DEGRADED failure fall through to partial, on other failure classify and apply policy
- [x] 2.5 Add trace events: `degraded_probe_recovered` on success, `degraded_probe_failed` on failure
- [x] 2.6 Verify all existing DEGRADED-related tests still pass (no regression)

## 3. Integration Verification

- [x] 3.1 Run full test suite (`uv run pytest -x`) and fix any regressions
- [x] 3.2 Run linter (`uv run ruff check . && uv run ruff format --check .`)
