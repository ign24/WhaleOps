## Context

El activity panel (`activity-panel.tsx`) recibe `ActivityEntry[]` y los renderiza como timeline. Cada entry ya contiene `toolNameNormalized`, `toolArgs`, `toolResult`, `sandboxPath` y `commandSummary`. Los datos para construir un workspace snapshot están enteramente en ese array — nunca fueron aprovechados para una vista agregada.

Las herramientas file-aware actuales y su data disponible:

| Tool | `toolArgs` relevantes | `toolResult` relevante |
|---|---|---|
| `clone_repository` | `url`, `destination_root` | `{repo_path, clone_type, duration_ms, returncode}` |
| `directory_tree` | `path`, `max_depth` | texto del árbol (raw string) |
| `list_directory` | `path` | texto de listado |
| `read_text_file` | `path` | contenido del archivo (truncado a 30k) |
| `write_file` / `edit_file` | `path`, `content` | status |
| `create_directory` | `path` | status |
| `find_files` | `pattern`, `directory` | lista de paths |
| `shell_execute` | `command` | `{returncode, stdout, stderr}` |

Restricciones del entorno:
- `toolResult` para `read_text_file` puede estar truncado — no se puede contar líneas de forma confiable.
- Los MCP tools (`fs_tools__*`) tienen el prefijo stripeado en `toolNameNormalized` por `stripLabelPrefixes()`.
- El componente debe funcionar en modo live (streaming) y en modo histórico (entries ya completadas).

## Goals / Non-Goals

**Goals:**
- Derivar un `WorkspaceSnapshot` tipado a partir de `ActivityEntry[]` existente, sin modificar el flujo de datos.
- Mostrar repos clonados (URL, ruta, tipo, duración), archivos leídos y escritos (agrupados por directorio), árbol de directorios (si fue explorado), y comandos shell ejecutados.
- El componente es colapsable, se oculta si no hay data relevante.
- Estética consistente con el panel existente: neu-raised, var(--border/surface/muted), font-mono xs, colores de status de var(--success/error).
- Funcionar live durante streaming (entries se actualizan en tiempo real).

**Non-Goals:**
- Line counts por archivo (requeriría cambio en backend).
- File sizes en bytes.
- Garantizar cobertura de todos los archivos si el agente no llamó `directory_tree`.
- Modificar el backend, los eventos SSE, o el contrato de `ActivityEntry`.
- Vista en mobile (el panel de actividad ya es desktop-only en la práctica).

## Decisions

### D1: Derivación como función pura, no hook

`deriveWorkspaceSnapshot(entries: ActivityEntry[]): WorkspaceSnapshot` es una función pura en `workspace-snapshot.ts`. No es un hook — el componente padre puede memoizarlo con `useMemo`.

**Alternativa considerada**: hook `useWorkspaceSnapshot(entries)`.
**Razón de rechazo**: una función pura es más testeable, más reutilizable, y el `useMemo` en el componente es suficiente para performance.

### D2: Detección de tools por `toolNameNormalized`

Matchear contra `toolNameNormalized` (ya lowercase, sin prefijos MCP) en lugar de `label`. Fallback a `toolArgs` key inspection para tools que no tienen `toolNameNormalized` seteado.

Tools file-aware detectados:
```typescript
const CLONE_TOOLS = new Set(["clone_repository"]);
const READ_TOOLS = new Set(["read_text_file", "read_file"]);
const WRITE_TOOLS = new Set(["write_file", "edit_file", "apply_patch", "create_file"]);
const DIR_TOOLS = new Set(["directory_tree", "list_directory"]);
const FIND_TOOLS = new Set(["find_files"]);
const SHELL_TOOLS = new Set(["shell_execute", "bash", "shell"]);
```

**Alternativa considerada**: usar `getToolCategory()` de `session-meta.ts`.
**Razón de rechazo**: `getToolCategory` opera sobre el `label` humanizado y es demasiado permisivo. El `toolNameNormalized` es más preciso.

### D3: Deduplicación de paths leídos

Un mismo archivo puede ser leído múltiples veces. Se deduplica por path, mostrando solo la primera aparición. No se muestra conteo de accesos (ruido innecesario).

### D4: Árbol de directorios: solo el último resultado por path

Si el agente llamó `directory_tree` varias veces sobre el mismo path, se usa el último resultado (el más completo generalmente).

### D5: Posición en el panel — sección colapsable entre timeline y footer

```
ActivityPanel layout:
  ┌── header ──────────────────────────┐
  │── SessionInfo ─────────────────────│
  │                                    │
  │   ActivityTimeline (flex-1)        │
  │                                    │
  │── SessionWorkspace (colapsable) ───│  ← nuevo
  │── SessionSummary (footer) ─────────│
  └────────────────────────────────────┘
```

El `SessionWorkspace` tiene altura máxima fija (`max-h-64`) con scroll interno para no comprimir la timeline. Se colapsa por defecto si hay más de 10 archivos (para no dominar el panel).

**Alternativa considerada**: Tab en el header del panel ("Actividad" / "Workspace").
**Razón de rechazo**: aumenta la complejidad del componente padre (`ChatSessionLayout` y `ActivityPanel`) y cambia el contrato de props. La sección colapsable es additive y no rompe nada.

### D6: Agrupar archivos por directorio raíz del repo

Si hay un repo clonado en `/tmp/analysis/django`, los archivos en `/tmp/analysis/django/src/...` se muestran relativos a ese root. Mejora legibilidad y conecta visualmente los archivos con el repo al que pertenecen.

## Risks / Trade-offs

**[R1] `toolNameNormalized` puede estar vacío en algunos events** → Fallback a inspección de `toolArgs` keys: si tiene `path` y `content`, asumir write; si tiene `path` solo, asumir read.

**[R2] `toolResult` del `directory_tree` es texto libre sin formato garantizado** → Se renderiza como `<pre>` con scroll en lugar de parsear. Evita romper con distintas versiones del MCP tool.

**[R3] Compresión visual del panel en sesiones largas** → `SessionWorkspace` colapsado por defecto y con max-height. El flex-1 de `ActivityTimeline` absorbe el espacio restante correctamente.

**[R4] Repo path no siempre en `toolArgs` para clone** → Fallback a `sandboxPath` (ya extraído por `summarizeToolContext` en `chat-panel.tsx`). Es el campo `sandboxPath` de `ActivityEntry`.

## Open Questions

- ¿Mostrar comandos shell individuales o solo un conteo? (recomendación: lista colapsada, máx 5 visibles)
- ¿El panel workspace debe estar abierto o cerrado por defecto al inicio? (recomendación: cerrado si hay ≥ 5 items, abierto si hay menos)
