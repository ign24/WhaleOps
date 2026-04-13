## ADDED Requirements

### Requirement: workspace_delete SHALL delete sandbox targets automatically
When `location="sandbox"`, the tool SHALL delete the target directory from `/tmp/analysis` using `shutil.rmtree` and return `status="deleted"` with the size freed. No PIN confirmation is required.

#### Scenario: Successful sandbox delete
- **WHEN** `workspace_delete(location="sandbox", target="django")` is called
- **AND** `/tmp/analysis/django` exists
- **THEN** the response SHALL have `"status": "deleted"`
- **AND** `"location": "sandbox"`
- **AND** `"size_freed_mb"` containing the approximate MB freed
- **AND** the directory SHALL no longer exist on disk

#### Scenario: Sandbox target not found
- **WHEN** `workspace_delete(location="sandbox", target="nonexistent")` is called
- **AND** the directory does not exist
- **THEN** the response SHALL have `"status": "not_found"`
- **AND** `"retryable": false`
- **AND** the message SHALL suggest listing the sandbox to find valid targets

#### Scenario: Sandbox delete execution error
- **WHEN** `workspace_delete(location="sandbox", target="locked-repo")` is called
- **AND** the delete fails due to a filesystem error (permissions, busy)
- **THEN** the response SHALL have `"status": "execution_error"`
- **AND** `"retryable": true`
- **AND** `"error_type": "execution_error"`

### Requirement: workspace_delete SHALL require UI PIN confirmation for workspace targets
When `location="workspace"`, the tool SHALL NOT delete immediately. It SHALL generate a UUID v4 confirmation token, return `status="awaiting_ui_confirmation"` with the token and target metadata, and take no destructive action.

#### Scenario: Workspace delete returns awaiting confirmation
- **WHEN** `workspace_delete(location="workspace", target="fastapi")` is called
- **THEN** the response SHALL have `"status": "awaiting_ui_confirmation"`
- **AND** `"confirmation_token"` containing a UUID v4 string
- **AND** `"target_path"` with the resolved absolute path
- **AND** `"size_mb"` with the approximate directory size
- **AND** `"retryable": false`
- **AND** NO filesystem changes SHALL have occurred

#### Scenario: Workspace target not found before issuing token
- **WHEN** `workspace_delete(location="workspace", target="nonexistent")` is called
- **THEN** the response SHALL have `"status": "not_found"`
- **AND** `"retryable": false`
- **AND** NO confirmation token SHALL be issued

### Requirement: workspace_delete SHALL enforce path confinement
The tool SHALL resolve the target path and verify it is within the allowed root before any action. Paths that resolve outside the allowed root SHALL be rejected immediately.

#### Scenario: Path traversal attempt blocked
- **WHEN** `workspace_delete(location="sandbox", target="../etc/passwd")` is called
- **THEN** the response SHALL have `"status": "blocked"`
- **AND** `"retryable": false`
- **AND** the message SHALL indicate the path is outside the allowed root
- **AND** NO filesystem changes SHALL have occurred

#### Scenario: Absolute path target blocked
- **WHEN** `workspace_delete(location="sandbox", target="/etc/hosts")` is called
- **THEN** the response SHALL have `"status": "blocked"`
- **AND** `"retryable": false`

### Requirement: workspace_delete SHALL always return structured JSON for agent loop continuity
Every response from `workspace_delete` SHALL include `status`, `message`, and `retryable` fields so the agent can decide next actions without hanging.

#### Scenario: Agent can continue after confirmation_denied
- **WHEN** the confirm endpoint returns 403 (wrong PIN)
- **AND** the agent has the tool result with `"status": "confirmation_denied"`
- **THEN** `"retryable"` SHALL be `false`
- **AND** `"message"` SHALL indicate the user can retry the PIN from the UI
- **AND** the agent loop SHALL NOT block or throw

#### Scenario: Agent can retry after token_expired
- **WHEN** `workspace_delete` is called with a token that has expired
- **THEN** the response SHALL have `"status": "token_expired"`
- **AND** `"retryable": true`
- **AND** the message SHALL instruct the agent to call `workspace_delete` again to get a fresh token
