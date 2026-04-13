## Why

El panel de actividad muestra lo que el agente *hizo* durante una sesión (clones, lecturas, escrituras), pero no muestra el estado real del disco. El usuario no puede ver qué repos existen en `/app/workspace` ni qué hay en `/tmp/analysis` sin lanzar una nueva sesión. Una tarjeta de filesystem independiente resuelve esto: muestra el estado actual del disco en todo momento, complementando el panel de actividad sin reemplazarlo.

## What Changes

- Se agrega un nuevo componente `FolderCard` que lee directamente `/app/workspace` y `/tmp/analysis` vía el endpoint `/api/workspace/tree` ya existente.
- La columna derecha de `ChatSessionLayout` pasa de contener solo `ActivityPanel` a ser un `flex col` con `ActivityPanel` (flex-1) + `FolderCard` (altura fija) apilados.
- `FolderCard` auto-polling cada 5 segundos cuando `isLive=true`, pausa cuando `isLive=false`.
- El renderer `TreeNode` se extrae de `session-workspace.tsx` a un módulo compartido para reutilización.
- `FolderCard` es visible únicamente cuando el panel de actividad está abierto (mismo toggle).

## Capabilities

### New Capabilities

- `workspace-folder-card`: Tarjeta de filesystem independiente que muestra el árbol de `/app/workspace` y `/tmp/analysis` con auto-polling durante sesiones activas.

### Modified Capabilities

- `split-chat-layout`: La columna derecha ahora contiene dos componentes apilados (`ActivityPanel` + `FolderCard`) en lugar de uno solo.

## Impact

- **Archivos nuevos**: `components/activity/folder-card.tsx`, `components/activity/tree-node.tsx`
- **Archivos modificados**: `components/chat/chat-session-layout.tsx`, `components/activity/session-workspace.tsx`
- **Sin cambios al backend**: `/api/workspace/tree` ya existe y soporta ambas rutas.
- **Sin cambios a types ni a SSE/streaming**.
