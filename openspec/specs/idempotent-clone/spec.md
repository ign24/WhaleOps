## ADDED Requirements

### Requirement: clone_repository SHALL reuse valid existing clones
When the destination directory already exists and contains a git repository whose `origin` remote URL matches the requested repository, the tool SHALL return a success response with `"message": "Repository already cloned"` and `"clone_type": "existing"`. The tool SHALL NOT attempt to re-clone or delete the existing directory.

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

### Requirement: Existing clone validation SHALL use git remote check
The tool SHALL validate existing clones by running `git -C <dest> remote get-url origin` with a 5-second timeout. URL comparison SHALL normalize both URLs by stripping `.git` suffix, authentication tokens, and trailing slashes before comparing.

#### Scenario: URL matching normalizes .git suffix
- **WHEN** the requested URL is `https://github.com/owner/repo` and the origin remote is `https://github.com/owner/repo.git`
- **THEN** the URLs SHALL be considered a match

#### Scenario: URL matching strips authentication tokens
- **WHEN** the origin remote contains `x-access-token:TOKEN@github.com`
- **THEN** the token SHALL be stripped before comparison

#### Scenario: Git remote check times out
- **WHEN** `git remote get-url origin` does not complete within 5 seconds
- **THEN** the tool SHALL treat the directory as a conflict and return an error response
