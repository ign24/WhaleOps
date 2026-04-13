## ADDED Requirements

### Requirement: Protected Mainline Development
The project SHALL enforce `main` as the protected integration branch and MUST require pull requests for all non-administrative changes.

#### Scenario: Merge attempt without pull request
- **WHEN** a contributor attempts to push changes directly to `main`
- **THEN** branch protection MUST reject the direct push

#### Scenario: Merge with unmet required checks
- **WHEN** a pull request targeting `main` has failed required checks
- **THEN** the repository MUST block merge until required checks pass

### Requirement: Short-Lived Branch Naming and Scope
The project SHALL require work branches to use standard prefixes (`feat/`, `fix/`, `hotfix/`, `chore/`) and each branch MUST target a single coherent change objective.

#### Scenario: Branch name does not follow policy
- **WHEN** a contributor opens a pull request from a branch without an approved prefix
- **THEN** reviewers MUST request rename or re-creation of the branch before merge

#### Scenario: Branch mixes unrelated work
- **WHEN** a pull request includes unrelated features and refactors in a single change
- **THEN** maintainers MUST request split pull requests before approval

### Requirement: Pull Request Operational Metadata
Every pull request SHALL include risk level, rollout plan, rollback plan, and verification evidence.

#### Scenario: Pull request missing rollback plan
- **WHEN** a pull request description omits rollback information
- **THEN** the pull request MUST remain unapproved until rollback details are provided
