## ADDED Requirements

### Requirement: Workspace tree API SHALL reject path traversal attempts

The `/api/workspace/tree` route MUST validate the `path` query parameter before forwarding it to the backend. Path traversal sequences MUST be rejected.

#### Scenario: Path with double-dot is rejected
- **WHEN** a GET request is sent to `/api/workspace/tree?path=../../etc/passwd`
- **THEN** the API SHALL return status 400 with body `{ "error": "Invalid path" }`

#### Scenario: Path with encoded double-dot is rejected
- **WHEN** a GET request is sent to `/api/workspace/tree?path=%2e%2e%2f%2e%2e%2fetc%2fpasswd`
- **THEN** the API SHALL return status 400 with body `{ "error": "Invalid path" }`

#### Scenario: Absolute path is rejected
- **WHEN** a GET request is sent to `/api/workspace/tree?path=/etc/passwd`
- **THEN** the API SHALL return status 400 with body `{ "error": "Invalid path" }`

#### Scenario: Valid relative path is accepted
- **WHEN** a GET request is sent to `/api/workspace/tree?path=src/components`
- **THEN** the API SHALL forward the request to the backend normally

#### Scenario: Empty or missing path uses default
- **WHEN** a GET request is sent to `/api/workspace/tree` without a `path` parameter
- **THEN** the API SHALL forward the request to the backend with default behavior (unchanged)
