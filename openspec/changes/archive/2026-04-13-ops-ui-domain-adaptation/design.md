## Context

La UI fue forkeada del cognitive-code-agent. El Activity Panel incluye `SessionWorkspace`, que deriva un snapshot de repos clonados, archivos leídos/escritos, directorios explorados y comandos ejecutados a partir de los `ActivityEntry` de la sesión. Ninguno de esos conceptos aplica al ops-agent, cuyo dominio son contenedores Docker.

El `ToolCallCard` expone un chip `sandboxPath` que el code-agent emitía junto a cada tool call. El ops-agent no tiene sandbox.

El `ChatHelpCard` ya fue parcialmente adaptado (capabilities de Docker), pero faltan `schedule_task` y las notas (`save_note`/`get_notes`).

## Goals / Non-Goals

**Goals:**
- Reemplazar `SessionWorkspace` con `OpsSessionContext`: derivar un ops snapshot (containers, logs, notas, schedules) desde los mismos `ActivityEntry`
- Eliminar `sandboxPath` del `ContextChips`; mostrar container name/id como chip cuando está presente en los args del tool call
- Agregar 2 capability cards faltantes en `ChatHelpCard`
- Renombrar label "Workspace" → "Conversaciones" en sidebar
- Implementación TDD: tests primero para el nuevo componente y los cambios

**Non-Goals:**
- Polling activo de containers en el sidebar (requiere backend adicional, Tier 1)
- Cambios en el Activity Panel de código (timeline, agent-step-card)
- Modificar la API o el backend Python

## Decisions

### D1: OpsSessionContext deriva desde ActivityEntry (sin nueva API)
**Decisión**: parsear los `ActivityEntry` existentes para extraer containers/logs/notas/schedules, igual que `deriveWorkspaceSnapshot` hace con repos y archivos.

**Alternativa descartada**: endpoint REST dedicado `/api/ops/session-context`. Agrega complejidad de backend y latencia sin necesidad — toda la información ya existe en los entries del stream SSE.

**Rationale**: zero new API surface, misma arquitectura que el código existente.

### D2: Detección de container por args, no por tool name
**Decisión**: en `ContextChips`, mostrar container chip cuando los args del tool call incluyen `container_name` o `container_id` (cualquier tool).

**Alternativa descartada**: hardcodear los tool names (`list_containers`, `inspect_container`, etc.). Frágil si los nombres cambian.

**Rationale**: basado en shape de args, más robusto y extensible.

### D3: OpsSnapshot type — estructura plana, no árbol
**Decisión**: el snapshot tiene arrays planos: `containersReferenced: string[]`, `logsFetched: {container: string, lines: number}[]`, `notesSaved: {type: string, container?: string}[]`, `schedulesCreated: {name: string, cron: string}[]`.

**Rationale**: suficiente para el panel de resumen. No necesita árbol de archivos ni anidamiento.

### D4: TDD — tests primero
**Decisión**: para `OpsSessionContext` y `deriveOpsSnapshot`, escribir tests unitarios antes de implementar. Para los cambios en archivos existentes (sidebar, tool-call-card, chat-help-card), adaptar los tests existentes primero.

## Risks / Trade-offs

- [Risk] `ActivityEntry` puede no exponer el tool name ni los args de forma consistente → revisar `types/chat.ts` antes de implementar `deriveOpsSnapshot`; si los args no están disponibles, el snapshot queda vacío (graceful degradation).
- [Risk] Romper tests existentes de `session-workspace` al reemplazar el componente → los tests de `SessionWorkspace` se reemplazan por tests de `OpsSessionContext`; el `ActivityPanel` cambia la importación.
