## MODIFIED Requirements

### Requirement: Ops tools registered in NAT via @register_function
Each tool function in `ops_tools.py` SHALL use the `@register_function` decorator so NAT discovers and exposes it when listed in `config.yml` tool_names.

#### Scenario: Tools discoverable by NAT at startup
- **WHEN** the agent server starts with `vps_status`, `list_services`, `get_logs` in the `ops` mode tool_names
- **THEN** all three tools are bound and available without import errors

## ADDED Requirements

### Requirement: schedule_task capability card in ChatHelpCard
The `ChatHelpCard` SHALL include a capability card for `schedule_task`. The card SHALL describe the tool as managing recurring scheduled tasks via cron expressions, and its prompt SHALL pre-fill "Listá las tareas programadas activas".

#### Scenario: schedule_task card rendered in capabilities grid
- **WHEN** the ChatHelpCard is rendered
- **THEN** a capability card with title "Tareas programadas" is visible in the capabilities section

#### Scenario: Clicking card fills prompt input
- **WHEN** the user clicks the schedule_task capability card
- **THEN** `onPromptSelect` is called with "Listá las tareas programadas activas"

### Requirement: save_note/get_notes capability card in ChatHelpCard
The `ChatHelpCard` SHALL include a capability card for notes (`save_note`/`get_notes`). The card SHALL describe the tool as saving and querying structured incident notes, and its prompt SHALL pre-fill "¿Qué problemas recurrentes tiene este host?".

#### Scenario: Notes card rendered in capabilities grid
- **WHEN** the ChatHelpCard is rendered
- **THEN** a capability card with title "Registro de incidentes" is visible in the capabilities section

#### Scenario: Clicking notes card fills prompt input
- **WHEN** the user clicks the notes capability card
- **THEN** `onPromptSelect` is called with "¿Qué problemas recurrentes tiene este host?"
