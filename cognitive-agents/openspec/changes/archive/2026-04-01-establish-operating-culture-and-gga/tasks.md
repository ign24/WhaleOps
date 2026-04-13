## 1. Governance Baseline

- [x] 1.1 Create `docs/operating-culture.md` defining branch policy (`main`, `feat/*`, `fix/*`, `hotfix/*`) and merge expectations
- [x] 1.2 Add `.github/pull_request_template.md` requiring risk level, rollout plan, rollback plan, and verification evidence
- [x] 1.3 Document hotfix lifecycle and mandatory back-merge flow in governance docs

## 2. Release and Rollback Runbooks

- [x] 2.1 Create `docs/release-runbook.md` with semantic version tagging, release checklist, and deployment contract
- [x] 2.2 Create `docs/rollback-runbook.md` with deterministic rollback steps to previous stable tag and required health checks
- [x] 2.3 Add release notes template that records version, artifact references, risk notes, and rollback target

## 3. GGA Quality Gate Integration

- [x] 3.1 Standardize local quality command(s) combining `uv run ruff check .`, `uv run pytest -x`, and GGA execution
- [x] 3.2 Add CI quality workflow that runs lint, tests, and GGA on pull requests and publishes status
- [x] 3.3 Configure phase-1 non-blocking GGA reporting and document criteria to move to blocking high/critical findings
- [x] 3.4 Define waiver process (justification, approver, expiration) and enforce its use in PR documentation

## 4. Enforcement and Operational Readiness

- [ ] 4.1 Enable branch protection for `main` with required checks and at least one review
- [x] 4.2 Perform initial tagged release dry run (`vX.Y.Z`) to validate release contract and artifact traceability
- [x] 4.3 Execute one rollback drill to previous tag and record outcomes/actions in the runbook
- [x] 4.4 Publish adoption timeline for GGA enforcement phases and ownership of policy maintenance

Blocked note for 4.1: GitHub API returned HTTP 403 (`Upgrade to GitHub Pro or make this repository public to enable this feature.`) when attempting to apply branch protection.
