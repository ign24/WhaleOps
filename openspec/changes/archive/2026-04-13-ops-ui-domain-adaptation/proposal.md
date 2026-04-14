## Why

La UI fue forkeada del code-agent y aún expone conceptos del dominio incorrecto: "Workspace", sandbox paths, archivos leídos/escritos y repositorios. El ops-agent opera sobre contenedores Docker, no sobre código fuente. Esto genera ruido visual y oculta información operativa relevante.

## What Changes

- Renombrar label "Workspace" en sidebar a "Conversaciones"
- Eliminar el chip `sandboxPath` del `ToolCallCard`; agregar chip de container name/id cuando el tool call lo incluye como argumento
- Reemplazar `SessionWorkspace` (repos, archivos, comandos) con `OpsSessionContext`: vista de containers consultados, logs fetched, notas guardadas y tareas programadas, derivados de los `ActivityEntry` de la sesión
- Agregar dos capability cards faltantes en `ChatHelpCard`: `schedule_task` y `save_note`/`get_notes`

## Capabilities

### New Capabilities

- `ops-session-context`: Panel de resumen de sesión ops-aware que reemplaza el workspace de code-agent. Trackea containers, logs, notas y schedules referenciados en los tool calls de la sesión.

### Modified Capabilities

- `ops-tools`: Agrega cards de UI para `schedule_task` y `save_note`/`get_notes` en el help card (actualmente solo cubre Docker read tools).

## Impact

- `ui-cognitive/components/layout/sidebar.tsx` — cambio de label (1 línea)
- `ui-cognitive/components/chat/tool-call-card.tsx` — eliminar prop `sandboxPath` de `ContextChips`, agregar lógica de container chip
- `ui-cognitive/components/activity/session-workspace.tsx` — reemplazado por nuevo componente
- `ui-cognitive/components/activity/ops-session-context.tsx` — nuevo archivo
- `ui-cognitive/components/chat/chat-help-card.tsx` — agregar 2 capability cards
- Tests unitarios en `ui-cognitive/tests/` para el nuevo componente y los cambios
