## Context

The repository hosts a multi-agent system with separate agent modules and shared operational risk. Current development is fast but lacks a formal governance model for branch lifecycle, release reproducibility, and production fallback. Existing quality controls (`ruff`, `pytest`, and GGA in warning mode) are present but not yet codified into a single enforced delivery flow.

Constraints:
- Keep process lightweight to avoid reducing delivery speed.
- Preserve current developer autonomy while protecting `main`.
- Ensure rollback can be executed from immutable references (Git tags + image tags).

Stakeholders:
- Core maintainers of `ceo-agent`, `code-agent`, and `marketing-agent`.
- Anyone on-call for production incidents.

## Goals / Non-Goals

**Goals:**
- Standardize daily collaboration around short-lived branches and protected `main`.
- Define deterministic release and rollback governance for production safety.
- Introduce GGA as a phased quality gate across local development and CI.
- Make risk, rollout, and rollback explicit in PR/release artifacts.

**Non-Goals:**
- Re-architecting agent internals, memory stack, or orchestration topology.
- Replacing existing test/lint tooling.
- Introducing heavy enterprise process (e.g., multi-layer approval boards).

## Decisions

1. **Adopt trunk-based branching with controlled branch types**
   - Decision: Use `main` as the only production source-of-truth, plus `feat/*`, `fix/*`, and `hotfix/*` short-lived branches.
   - Rationale: Minimizes divergence while preserving isolation for work-in-progress.
   - Alternatives considered:
     - GitFlow (`develop` + release branches by default): rejected due to added overhead for a small/medium team.

2. **Release only from semantic version tags with immutable deploy artifacts**
   - Decision: Every production deployment must map to a Git tag (`vMAJOR.MINOR.PATCH`) and immutable image tags.
   - Rationale: Guarantees reproducibility and enables deterministic rollback.
   - Alternatives considered:
     - Deploy from branch head or mutable `latest`: rejected due to weak traceability.

3. **Phased GGA enforcement model**
   - Decision: Start with warning mode in CI, then progress to blocking high/critical findings, then broaden scope/severity.
   - Rationale: Avoid workflow disruption while calibrating false positives.
   - Alternatives considered:
     - Immediate strict blocking for all findings: rejected due to likely adoption friction.

4. **Mandatory PR/release metadata for operational traceability**
   - Decision: PR template and release checklist require risk assessment, rollout plan, rollback plan, and verification evidence.
   - Rationale: Reduces ambiguity during incidents and audits.
   - Alternatives considered:
     - Free-form PR descriptions: rejected due to inconsistent quality.

5. **Explicit hotfix flow with back-merge requirement**
   - Decision: Urgent fixes branch from production-compatible base, release as patch, then back-merge into normal flow.
   - Rationale: Prevents regression and keeps history coherent.
   - Alternatives considered:
     - Patch directly on `main` without process: rejected due to increased incident risk.

## Risks / Trade-offs

- **[Risk] Increased process overhead for small changes** → **Mitigation:** Keep branch and checklist requirements minimal and automate checks.
- **[Risk] GGA false positives slowing merges** → **Mitigation:** Start non-blocking, tune prompts/rules, and enforce by severity in phases.
- **[Risk] Rollback remains theoretical if never rehearsed** → **Mitigation:** Run recurring rollback drills and document outcomes.
- **[Risk] Inconsistent adoption across agent modules** → **Mitigation:** Single policy docs and shared CI workflow at repository level.

## Migration Plan

1. Publish governance docs (`operating culture`, `release runbook`, `rollback runbook`).
2. Add PR template and release checklist artifacts.
3. Enable CI quality job with lint/tests/GGA in non-blocking mode.
4. Apply branch protection on `main` (required checks + review).
5. Cut first baseline release tag and validate rollback to previous tag in a drill.
6. Raise GGA enforcement level according to agreed adoption milestones.

Rollback strategy for migration:
- If governance rollout blocks delivery unexpectedly, keep docs and templates but temporarily disable blocking gates while tuning.

## Open Questions

- Which severity taxonomy will be authoritative for GGA blocking (tool-native vs team-mapped)?
- Should `hotfix/*` require one reviewer or allow expedited self-merge under incident mode?
- Will release artifacts be stored only in GitHub Releases or also in an external operations log?
