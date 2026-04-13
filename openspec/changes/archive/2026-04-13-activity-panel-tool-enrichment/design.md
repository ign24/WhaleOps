## Context

El pipeline de actividad en streaming emite dos eventos por tool call:
- `tool_start`: incluye `toolArgs` pero el label crudo es el nombre de la función con namespace (e.g. `fs_tools__write_file`)
- `tool_end`: incluye `toolResult` y el label puede tener prefijo distinto (`write_file` sin namespace)

`mergeActivityEntry` en `chat-panel.tsx` intenta colapsar ambos en una entry, buscando primero por `stepId` y luego por `label === label`. El fallback por label falla cuando los nombres difieren. `humanizeActivityLabel` ya tiene `stripLabelPrefixes` que normaliza estos prefijos, pero no se usa en el merge.

## Goals / Non-Goals

**Goals:**
- Eliminar duplicados en el timeline causados por mismatch de label en merge
- Mostrar commandSummary y path durante estado `running` (antes de tool_end)
- Agregar tooltip en labels truncados (modelo, nombre de herramienta largo)
- Prefijo `$` en subtitle de Terminal para contexto visual de shell

**Non-Goals:**
- No cambiar el contrato de eventos del backend
- No rediseñar la estructura de ActivityEntry ni AgentActivityEvent
- No agregar animaciones ni cambios visuales más allá de tooltip y prefijo `$`

## Decisions

### 1. Exponer `stripLabelPrefixes` desde `session-meta.ts`

Actualmente es una función interna (`const stripLabelPrefixes = ...`). Se exporta como named export para poder importarla en `chat-panel.tsx`.

Alternativa descartada: duplicar la lógica en `chat-panel.tsx` — viola DRY y genera drift.

### 2. Normalizar label en ambos lados del match (no solo en el nuevo evento)

En `mergeActivityEntry`, al buscar la entry candidata, normalizar `row.label` y el nuevo `label` con `stripLabelPrefixes` antes de comparar:

```ts
// antes
if (row.label === label && ...)

// después
if (normalizeLabel(row.label) === normalizeLabel(label) && ...)
```

La normalización se aplica solo para el match — el `row.label` almacenado no se modifica, para preservar el label original de la entry.

Alternativa descartada: normalizar el label al momento de crear la entry — pierde el nombre original que puede ser útil en debug/tooltip.

### 3. Extracción de contexto en tool_start

`summarizeToolContext` ya extrae `commandSummary` de `toolArgs.command`. En `tool_start` los `toolArgs` están disponibles, entonces el contexto se puede extraer igualmente. El merge actualiza `toolContext` en el `tool_end`, pero si la entry ya tiene `commandSummary` desde el `tool_start`, el usuario ve la info desde que el tool empieza a ejecutarse.

No requiere cambio de estructura — `summarizeToolContext` ya recibe el evento completo. El cambio es que `mergeActivityEntry` propaga `toolContext` desde la primera entry creada (en el `else` branch que crea una entry nueva).

### 4. Tooltip via atributo `title` nativo

Para labels truncados, agregar `title={fullLabel}` en el `<p>` del label en `timeline-entry.tsx`. No requiere librería externa ni componente adicional. El tooltip nativo del browser es suficiente para este caso de uso (texto completo on hover).

Alternativa considerada: componente Tooltip de Radix/shadcn — overhead innecesario para un caso simple de overflow text.

### 5. Prefijo `$` en subtitle de Terminal

En `timeline-entry.tsx`, cuando la category es `"terminal"` y existe subtitle:
```tsx
const displaySubtitle = category === "terminal" && subtitle
  ? `$ ${subtitle}`
  : subtitle;
```

Comunicación visual clara de que es un comando de shell.

## Risks / Trade-offs

- [Normalización de label en merge] Si dos tools distintos tienen el mismo nombre normalizado (e.g. `fs_tools__read` y `shell_tools__read`), el merge podría colapsar entries incorrectamente → Mitigación: el match además requiere `status === "running" || "pending"`, lo que limita la ventana de error a herramientas concurrentes con el mismo nombre base — caso poco probable en la práctica.
- [title attr como tooltip] No es estilizable y tiene delay en algunos browsers → aceptable para MVP, se puede reemplazar con componente si el UX lo requiere.
