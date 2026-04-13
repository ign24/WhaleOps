## ADDED Requirements

### Requirement: Frontend routes /refactor to backend agent
The frontend SHALL forward messages starting with `/refactor` to the backend agent via `sendMessageToAgent()`, preserving the `/refactor` prefix in the message body. The message MUST NOT be intercepted as a local command.

#### Scenario: User sends /refactor with arguments
- **WHEN** the user types `/refactor Refactorizar el sistema de alertas`
- **THEN** the frontend SHALL call `sendMessageToAgent("/refactor Refactorizar el sistema de alertas")` and the message SHALL reach the backend with prefix intact

#### Scenario: User sends /refactor without arguments
- **WHEN** the user types `/refactor` with no arguments
- **THEN** the frontend SHALL call `sendMessageToAgent("/refactor")` and the backend agent SHALL ask for clarification

#### Scenario: /refactor does not trigger Comando desconocido
- **WHEN** the user types `/refactor anything`
- **THEN** the frontend SHALL NOT display "Comando desconocido"

### Requirement: Frontend routes /execute to backend agent
The frontend SHALL forward messages starting with `/execute` to the backend agent via `sendMessageToAgent()`, preserving the `/execute` prefix in the message body.

#### Scenario: User sends /execute with arguments
- **WHEN** the user types `/execute commit and push to feat/refactor-alerts`
- **THEN** the frontend SHALL call `sendMessageToAgent("/execute commit and push to feat/refactor-alerts")`

#### Scenario: /execute does not trigger Comando desconocido
- **WHEN** the user types `/execute anything`
- **THEN** the frontend SHALL NOT display "Comando desconocido"

### Requirement: /refactor and /execute appear in command autocomplete
The command registry SHALL include entries for `/refactor` and `/execute` so they appear in the autocomplete dropdown when the user types `/`.

#### Scenario: Autocomplete shows /refactor
- **WHEN** the user types `/ref` in the chat input
- **THEN** the autocomplete dropdown SHALL show `/refactor` as an option with a description indicating it sends a refactoring request to Devstral

#### Scenario: Autocomplete shows /execute
- **WHEN** the user types `/exe` in the chat input
- **THEN** the autocomplete dropdown SHALL show `/execute` as an option with a description indicating it runs git operations via Kimi

### Requirement: /help text includes /refactor and /execute
The `/help` command output SHALL list `/refactor` and `/execute` alongside existing commands.

#### Scenario: Help text shows all agent-routed commands
- **WHEN** the user types `/help`
- **THEN** the output SHALL include lines describing `/refactor` and `/execute` with their purpose
