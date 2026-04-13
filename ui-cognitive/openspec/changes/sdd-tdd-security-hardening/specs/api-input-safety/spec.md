## ADDED Requirements

### Requirement: API routes SHALL return 400 on malformed JSON body

All API routes that parse request bodies MUST wrap `request.json()` in a try-catch. When the body is not valid JSON, the route SHALL return HTTP 400 with `{ error: "Invalid JSON in request body" }`. The route MUST NOT crash with an unhandled 500 error.

Affected routes: `/api/users`, `/api/users/[userId]`, `/api/sessions/[sessionKey]`, `/api/sessions/[sessionKey]/feedback`, `/api/chat`.

#### Scenario: Malformed JSON body returns 400
- **WHEN** a POST/PATCH request is sent with a body that is not valid JSON (e.g., `"not json{{"`)
- **THEN** the API SHALL return status 400 with body `{ "error": "Invalid JSON in request body" }`

#### Scenario: Empty body returns 400
- **WHEN** a POST/PATCH request is sent with an empty body
- **THEN** the API SHALL return status 400 with body `{ "error": "Invalid JSON in request body" }`

#### Scenario: Valid JSON is processed normally
- **WHEN** a POST/PATCH request is sent with valid JSON
- **THEN** the API SHALL parse the body and continue normal processing

### Requirement: API error responses SHALL NOT leak internal details

All API routes MUST return generic error messages to clients. Internal error details (stack traces, file paths, database errors) MUST be logged server-side only. Client-facing error responses SHALL use the format `{ error: "<generic message>" }`.

#### Scenario: Internal error returns generic message
- **WHEN** an unexpected error occurs during request processing
- **THEN** the API SHALL return status 500 with body `{ "error": "Internal server error" }`
- **AND** the actual error details SHALL be logged server-side with `console.error`

#### Scenario: Known validation errors return specific messages
- **WHEN** input fails validation (missing required fields, invalid format)
- **THEN** the API SHALL return status 400 with a descriptive but safe error message (no internal paths or stack traces)
