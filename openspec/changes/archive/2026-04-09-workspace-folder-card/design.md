## Context

`ChatSessionLayout` renderiza una grilla de 2 columnas: chat (izquierda) + actividad (derecha, 380px). La columna derecha contiene un solo `ActivityPanel` que ocupa `h-full`. El `ActivityPanel` muestra eventos de herramientas derivados de tool calls SSE.

El endpoint `/api/workspace/tree?path=...` ya existe, está autenticado, y soporta exactamente las dos rutas que nos interesan (`/app/workspace`, `/tmp/analysis`). El renderer `TreeNode` existe en `session-workspace.tsx` pero está embebido sin exportar.

## Goals / Non-Goals

**Goals:**
- Mostrar el estado real del disco de `/app/workspace` y `/tmp/analysis` como tarjeta separada debajo del `ActivityPanel`.
- Auto-refresh cada 5s cuando `isLive=true`, pausa cuando es `false`.
- Reutilizar `TreeNode` extrayéndolo a un módulo compartido.
- La tarjeta aparece/desaparece con el mismo toggle del panel de actividad.

**Non-Goals:**
- No modificar el backend ni el endpoint `/api/workspace/tree`.
- No reemplazar ni modificar `SessionWorkspace` (complemento, no sustituto).
- No mostrar la tarjeta en mobile (overlay) — solo desktop.
- No implementar WebSocket/SSE para actualizaciones en tiempo real.

## Decisions

### D1: Polling con `setInterval` en lugar de SSE

Las rutas de filesystem no emiten eventos. Se usa `setInterval` de 5s activo cuando `isLive=true`. Alternativa considerada: event-source custom. Descartada: overhead innecesario para datos que cambian lentamente (un clone tarda segundos, no milisegundos).

El hook `useFolderTree(path, isLive)` maneja: fetch inicial, polling, cleanup en unmount, y deduplicación si la respuesta no cambia.

### D2: Altura con `flex col` en la columna derecha

La columna derecha pasa de un único `div.relative.min-h-0` con `ActivityPanel` a un `flex flex-col gap-2 h-full min-h-0`:

```
┌─ right column (flex col, h-full) ──────────┐
│  ActivityPanel  (flex-1, min-h-0)           │
│  FolderCard     (max-h-[280px], shrink-0)   │
└────────────────────────────────────────────┘
```

`ActivityPanel` toma el espacio restante con `flex-1`. `FolderCard` tiene altura máxima fija con scroll interno. Alternativa: split por porcentaje (60/40). Descartada: a pantallas bajas la card quedaría demasiado pequeña para ser útil; `max-h` fijo es más predecible.

### D3: Extracción de TreeNode a módulo compartido

`TreeNode` y `formatBytes` se mueven a `components/activity/tree-node.tsx` con exportaciones nombradas. `session-workspace.tsx` lo importa desde ahí. Sin cambios de comportamiento.

### D4: FolderCard siempre monta cuando el panel está abierto

La card se monta cuando `isActivityOpen && isDesktop`, igual que el panel. Esto dispara el fetch inicial inmediatamente al abrir el panel. Alternativa: montar siempre y mostrar/ocultar con CSS. Descartada: evita fetches innecesarios cuando el panel está cerrado.

## Risks / Trade-offs

- **[Riesgo] Paths no existen en dev local** → `/app/workspace` y `/tmp/analysis` son rutas del contenedor Docker. En dev local el API devuelve 404. La card muestra estado "no disponible" sin crashear. Mitigation: handle graceful en el componente.

- **[Riesgo] Polling durante sesiones largas** → 5s de intervalo × sesión de 10 min = 120 fetches. El endpoint es filesystem local (< 50ms). Impacto mínimo. Mitigation: el intervalo se pausa inmediatamente cuando `isLive` cambia a `false`.

- **[Trade-off] Altura fija vs dinámica** → `max-h-[280px]` puede sentirse pequeño en pantallas 4K o insuficiente si hay muchos repos. Decisión: valor inicial razonable para 1080p; ajustable post-ship.
