## ADDED Requirements

### Requirement: Analyze findings include file paths for every finding
The analyze system prompt SHALL instruct the agent to include a `file_path` (relative to repo root) in every `persist_findings` call. Findings without specific file paths MUST use the most relevant file path discovered during analysis.

#### Scenario: Code review finding includes file path
- **WHEN** the agent persists a code review finding about a specific issue
- **THEN** the finding's `file_path` field SHALL contain the exact relative path (e.g., `backend/app/app.py`), not a generic label like "various files"

#### Scenario: Repo overview finding includes structural paths
- **WHEN** the agent persists the Phase 0 "repo-overview" finding
- **THEN** the `summary` field SHALL include the tech stack with versions, key model/table names with file paths, key endpoint paths with file locations, and frontend component structure with paths

### Requirement: Repo overview finding contains stack and structure context
The analyze system prompt SHALL require the Phase 0 "repo-overview" finding summary to include: tech stack with versions (from requirements.txt, package.json, Dockerfile), key model/table names and their file paths, key endpoint paths and their file locations, frontend component structure with paths, and infrastructure details.

#### Scenario: Python backend stack detection
- **WHEN** the agent analyzes a repo containing `requirements.txt` with Flask==3.0.0
- **THEN** the repo-overview finding summary SHALL mention "Flask 3.0.0" and list the main app entry point file path

#### Scenario: Fullstack project structure
- **WHEN** the agent analyzes a repo with both `backend/` and `frontend/` directories
- **THEN** the repo-overview finding SHALL list key files from both sides with their paths, not just a high-level "fullstack project" label

### Requirement: Finding summaries are specific and actionable
The analyze system prompt SHALL require each finding summary to be specific (referencing concrete code elements) and actionable (describing what should change), not generic (e.g., "code smells found" or "improvements needed").

#### Scenario: Specific vs generic finding
- **WHEN** the agent finds that `app.py` has 15 endpoints with no input validation
- **THEN** the finding summary SHALL reference the file and the specific issue, not just "security concerns in backend"
