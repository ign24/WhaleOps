# release-and-rollback-governance Specification

## Purpose
TBD - created by archiving change establish-operating-culture-and-gga. Update Purpose after archive.
## Requirements
### Requirement: Semantic Version Release Contract
Production deployments MUST be associated with annotated semantic version tags in the format `vMAJOR.MINOR.PATCH`.

#### Scenario: Deployment request from non-tagged commit
- **WHEN** a deployment is initiated from a commit without an approved release tag
- **THEN** the deployment process MUST reject promotion to production

#### Scenario: Release tag creation
- **WHEN** maintainers approve a release candidate on `main`
- **THEN** they MUST create an annotated tag that maps to the exact deployable commit

### Requirement: Immutable Deployment Artifacts
Each release MUST produce immutable deploy artifacts that reference the same version identifier as the Git tag.

#### Scenario: Artifact uses mutable latest tag
- **WHEN** a release pipeline attempts to publish a production artifact as `latest` only
- **THEN** the pipeline MUST fail until a versioned immutable tag is produced

### Requirement: Deterministic Rollback Procedure
The system SHALL maintain a documented rollback runbook and MUST support redeploying the previous stable release in operational incident conditions.

#### Scenario: Production incident after rollout
- **WHEN** post-release health checks fail beyond defined error budget
- **THEN** operators MUST execute rollback to the prior stable release tag using the runbook

#### Scenario: Rollback drill validation
- **WHEN** the team performs a scheduled rollback drill
- **THEN** the runbook MUST restore the previous version and pass defined health checks

### Requirement: Hotfix Patch Lifecycle
Urgent production fixes MUST follow a hotfix flow with patch version bump and back-merge into the mainline branch.

#### Scenario: Emergency fix applied
- **WHEN** a critical defect requires immediate correction
- **THEN** the fix MUST be released as a PATCH version and merged back into `main` after stabilization

