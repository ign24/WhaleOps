## Why

El panel de actividad muestra el timeline de herramientas usadas por el agente, pero no hay ninguna vista consolidada de qué repos clonó, qué archivos tocó y qué estructura de directorios exploró durante la sesión. Esta información ya fluye en `ActivityEntry[]` — solo falta extraerla y renderizarla de forma limpia.

## What Changes

- Nuevo `workspace-snapshot.ts`: función pura `deriveWorkspaceSnapshot(entries: ActivityEntry[])` que extrae repos clonados, archivos leídos/escritos, directorios explorados y comandos shell del array de entries existente.
- Nuevo componente `session-workspace.tsx`: renderiza el snapshot derivado con la estética del proyecto (neu-raised, var(--border), var(--surface), font-mono, text-muted). Se oculta si no hay datos.
- Modificación de `activity-panel.tsx`: inserta `<SessionWorkspace entries={entries} />` entre `ActivityTimeline` y `SessionSummary`.
- Sin cambios en el backend, sin nuevos eventos, sin modificación de tipos existentes.

## Capabilities

### New Capabilities

- `workspace-snapshot-derivation`: Lógica pura que parsea `ActivityEntry[]` y produce un objeto `WorkspaceSnapshot` tipado con repos, archivos y comandos de la sesión.
- `session-workspace-ui`: Componente visual colapsable que muestra el workspace snapshot debajo de la timeline en el activity panel.

### Modified Capabilities

(ninguna — el contrato de `ActivityEntry` y `ActivityPanel` no cambia)

## Impact

- **Archivos nuevos**: `ui-cognitive/components/activity/workspace-snapshot.ts`, `ui-cognitive/components/activity/session-workspace.tsx`
- **Archivo modificado**: `ui-cognitive/components/activity/activity-panel.tsx` (agregar `<SessionWorkspace>` al layout)
- **Sin cambios en**: backend, tipos existentes, SSE stream, `chat-panel.tsx`, `chat-session-layout.tsx`
- **Dependencias**: ninguna nueva (solo React + tipos ya existentes)
