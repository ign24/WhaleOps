## ADDED Requirements

### Requirement: Chat panel registers Python-issued token in Next.js store
When the SSE stream delivers a `tool_end` event with `status: "awaiting_ui_confirmation"`, the chat panel SHALL call the token registration API with the token UUID, path, size_mb, location, and target before rendering the delete confirmation modal.

#### Scenario: Token registration on awaiting_ui_confirmation
- **WHEN** a tool_end SSE event contains `status: "awaiting_ui_confirmation"` and `confirmation_token`
- **THEN** the chat panel SHALL POST to `/api/workspace/delete/register-token` with `{ token, path, size_mb, location, target }` and only render the DeleteConfirmModal after the POST succeeds

#### Scenario: Token registration failure
- **WHEN** the POST to `/api/workspace/delete/register-token` fails
- **THEN** the chat panel SHALL NOT show the modal and SHALL inject an error message into the chat

### Requirement: Register-token API route accepts pre-existing token ID
The `/api/workspace/delete/register-token` POST route SHALL accept a JSON body with `{ token, path, size_mb, location, target }` and store it in the in-memory token Map using the provided token ID (not generating a new one).

#### Scenario: Successful token registration
- **WHEN** a valid POST arrives with all required fields
- **THEN** the route SHALL store the token with a 5-minute TTL and return 200

#### Scenario: Missing fields
- **WHEN** a POST arrives with missing required fields
- **THEN** the route SHALL return 400

#### Scenario: Auth required
- **WHEN** a POST arrives without a valid session
- **THEN** the route SHALL return 401

### Requirement: Token store supports registration with explicit ID
The `workspace-delete-tokens.ts` module SHALL export a `registerDeleteTokenWithId` function that accepts a token string and metadata, storing it with the standard TTL.

#### Scenario: Register with explicit ID
- **WHEN** `registerDeleteTokenWithId("abc-123", { path, size_mb, location, target })` is called
- **THEN** `checkTokenStatus("abc-123")` SHALL return `"valid"`
