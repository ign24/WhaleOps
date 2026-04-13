## MODIFIED Requirements

### Requirement: clone_repository SHALL reuse valid existing clones
When the destination directory already exists and contains a git repository whose `origin` remote URL matches the requested repository, the tool SHALL return a success response with `"message": "Repository already cloned"` and `"clone_type": "existing"`. The tool SHALL NOT attempt to re-clone or delete the existing directory. After any successful clone (new or reused), the tool SHALL write `.clone_meta.json` to the repo root with `cloned_by`, `cloned_at`, `repo_url`, and `location` fields.

#### Scenario: Destination exists with matching repo
- **WHEN** `clone_repository` is called with `repo_url="https://github.com/sqlmapproject/sqlmap"`
- **AND** the destination directory already exists with `origin` remote matching `github.com/sqlmapproject/sqlmap`
- **THEN** the response SHALL have `"status": "ok"`
- **AND** `"message": "Repository already cloned"`
- **AND** `"clone_type": "existing"`
- **AND** `"repo_path"` pointing to the existing directory

#### Scenario: Destination exists with different repo
- **WHEN** `clone_repository` is called with `repo_url="https://github.com/owner/repo-a"`
- **AND** the destination directory already exists with `origin` remote matching a different repository
- **THEN** the response SHALL have `"status": "error"`
- **AND** `"retryable": false`
- **AND** the message SHALL explain the conflict and suggest using a different `dest_name`

#### Scenario: Destination exists but is not a git repository
- **WHEN** `clone_repository` is called and the destination directory exists but is not a valid git repository
- **THEN** the response SHALL have `"status": "error"`
- **AND** `"retryable": false`
- **AND** the message SHALL explain that the directory exists but is not a git repo

#### Scenario: Destination exists with corrupted git state
- **WHEN** `clone_repository` is called and the destination directory contains a `.git` directory but `git remote get-url origin` fails
- **THEN** the response SHALL have `"status": "error"`
- **AND** `"retryable": false`
- **AND** the message SHALL explain the directory has a corrupted or unreadable git state

#### Scenario: New clone writes .clone_meta.json
- **WHEN** `clone_repository` completes a new clone successfully
- **THEN** `<repo_dir>/.clone_meta.json` SHALL exist
- **AND** contain `cloned_by` (user id or "unknown"), `cloned_at` (ISO 8601), `repo_url`, and `location` ("sandbox" or "workspace")

#### Scenario: .clone_meta.json write failure does not fail the clone
- **WHEN** `clone_repository` completes but writing `.clone_meta.json` raises an IOError
- **THEN** the response SHALL still have `"status": "ok"`
- **AND** a warning SHALL be logged but NOT surfaced in the tool response
