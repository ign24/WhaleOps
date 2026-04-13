## ADDED Requirements

### Requirement: POST /api/workspace/delete/confirm SHALL validate PIN and execute delete
The endpoint SHALL accept `{token, pin}`, verify the PIN against `WORKSPACE_DELETE_PIN_HASH` using bcrypt, resolve the token to a pending delete request, call the Python backend to execute the delete, and return the result.

#### Scenario: Valid PIN and valid token executes delete
- **WHEN** `POST /api/workspace/delete/confirm` is called with a valid token and correct PIN
- **THEN** the response SHALL be HTTP 200
- **AND** include `{status: "deleted", size_freed_mb, target_path}`
- **AND** the target directory SHALL no longer exist

#### Scenario: Wrong PIN returns 403
- **WHEN** `POST /api/workspace/delete/confirm` is called with an incorrect PIN
- **THEN** the response SHALL be HTTP 403
- **AND** include `{error: "invalid_pin"}`
- **AND** NO filesystem changes SHALL have occurred
- **AND** the token SHALL remain valid for retry (not consumed)

#### Scenario: Expired token returns 410
- **WHEN** `POST /api/workspace/delete/confirm` is called with a token older than 5 minutes
- **THEN** the response SHALL be HTTP 410
- **AND** include `{error: "token_expired"}`

#### Scenario: Unknown token returns 404
- **WHEN** `POST /api/workspace/delete/confirm` is called with a token not in the store
- **THEN** the response SHALL be HTTP 404
- **AND** include `{error: "token_not_found"}`

#### Scenario: Missing WORKSPACE_DELETE_PIN_HASH env var blocks all confirms
- **WHEN** `WORKSPACE_DELETE_PIN_HASH` is not set
- **THEN** the endpoint SHALL return HTTP 503
- **AND** include `{error: "pin_not_configured"}`
- **AND** NO filesystem changes SHALL have occurred

### Requirement: Confirmation token SHALL be single-use
Once a token is successfully used to execute a delete, it SHALL be removed from the store and SHALL NOT be reusable.

#### Scenario: Token consumed after successful delete
- **WHEN** a delete is confirmed successfully with token T
- **THEN** a second `POST /api/workspace/delete/confirm` with the same token T
- **SHALL** return HTTP 404 with `{error: "token_not_found"}`

### Requirement: Confirmation tokens SHALL expire after 5 minutes
Tokens older than 300 seconds SHALL be treated as expired regardless of whether they were used.

#### Scenario: Token expires after TTL
- **WHEN** a token was issued more than 300 seconds ago
- **THEN** the endpoint SHALL return HTTP 410
- **AND** the token SHALL be removed from the store
