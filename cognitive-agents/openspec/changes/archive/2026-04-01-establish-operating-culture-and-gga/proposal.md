## Why

The project has reached a point where rapid iteration without formal delivery controls creates release risk and makes production recovery slow when incidents happen. We need a lightweight but explicit operating culture that keeps `main` stable, enables faster safe delivery, and guarantees rollback/fallback paths.

## What Changes

- Define a project-wide engineering operating culture for branching, pull requests, release management, and incident handling.
- Establish a standard release contract based on semantic version tags, immutable deploy artifacts, and reproducible rollback steps.
- Introduce a hotfix path for urgent production incidents with back-merge requirements.
- Add quality gates that combine existing lint/tests with GGA policy checks, starting in non-blocking mode and moving to severity-based enforcement.
- Standardize required PR/release metadata so every change documents risk, rollout, and rollback plans.

## Capabilities

### New Capabilities
- `engineering-operating-culture`: Defines day-to-day collaboration rules (branching, PR expectations, merge rules, commit conventions, ownership, and traceability).
- `release-and-rollback-governance`: Defines how versions are cut, tagged, deployed, and rolled back with a deterministic operational runbook.
- `gga-quality-gate-enforcement`: Defines how GGA is configured and enforced locally and in CI with staged adoption and severity thresholds.

### Modified Capabilities
- None.

## Impact

- Affects repository governance documentation and team workflow expectations.
- Requires CI updates to include GGA checks and quality gate reporting.
- Affects release process for all agents (`ceo-agent`, `code-agent`, `marketing-agent`) and their deployment packaging.
- Introduces small process overhead in exchange for significantly improved production safety and recovery speed.
