## ADDED Requirements

### Requirement: Session stores creator metadata
When a session is created, the system SHALL record the authenticated user's id and display name as the session creator in the persistent session record.

#### Scenario: New session records creator
- **WHEN** an authenticated user creates a new session via POST /api/sessions
- **THEN** the session JSON SHALL contain `createdBy: { id: "<userId>", name: "<userDisplayName>" }`

#### Scenario: Creator persists after session update
- **WHEN** a session is updated (e.g., messages appended, title changed)
- **THEN** the `createdBy` field SHALL remain unchanged

### Requirement: Legacy sessions without createdBy are handled gracefully
Sessions created before this change do not have a `createdBy` field. The system SHALL treat them as system-owned without error.

#### Scenario: Reading a legacy session
- **WHEN** any endpoint reads a session JSON that has no `createdBy` field
- **THEN** the system SHALL substitute `{ id: "system", name: "Sistema" }` without modifying the file

#### Scenario: Deleting a legacy session
- **WHEN** a non-admin user attempts to DELETE a legacy session (createdBy.id === "system")
- **THEN** the system SHALL return 403 Forbidden (only admins can delete system-owned sessions)

#### Scenario: Admin deletes a legacy session
- **WHEN** an admin user attempts to DELETE a legacy session
- **THEN** the system SHALL allow the deletion

### Requirement: Session DELETE enforces creator-or-admin authorization
Only the user who created a session or an admin user SHALL be permitted to delete it.

#### Scenario: Creator deletes own session
- **WHEN** the authenticated user's id matches `session.createdBy.id`
- **THEN** DELETE /api/sessions/[sessionKey] SHALL succeed with 200

#### Scenario: Non-creator non-admin attempts to delete
- **WHEN** the authenticated user's id does NOT match `session.createdBy.id` AND the user role is not "admin"
- **THEN** DELETE /api/sessions/[sessionKey] SHALL return 403 Forbidden with body `{ "error": "No tienes permiso para borrar esta sesión" }`

#### Scenario: Admin deletes any session
- **WHEN** the authenticated user has role "admin"
- **THEN** DELETE /api/sessions/[sessionKey] SHALL succeed regardless of who created it

#### Scenario: Session not found during delete
- **WHEN** the sessionKey does not match any existing session
- **THEN** DELETE SHALL return 404 Not Found

### Requirement: Session list response includes createdBy
The GET /api/sessions endpoint SHALL include the `createdBy` field in each session entry so that clients can display ownership without additional requests.

#### Scenario: List sessions response includes creator
- **WHEN** GET /api/sessions is called by any authenticated user
- **THEN** each session object in the response SHALL include `createdBy: { id: string; name: string }`

#### Scenario: Legacy sessions in list have fallback creator
- **WHEN** GET /api/sessions returns sessions without `createdBy` in their JSON
- **THEN** those sessions SHALL show `createdBy: { id: "system", name: "Sistema" }` in the response
