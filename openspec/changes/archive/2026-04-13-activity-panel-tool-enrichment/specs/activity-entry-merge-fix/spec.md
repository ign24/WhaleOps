## Capability: activity-entry-merge-fix

Colapso correcto de eventos `tool_start` y `tool_end` en una única entrada del timeline, incluso cuando sus labels crudos difieren por prefijos de namespace.

---

### Requirement: label-normalization-before-match

`mergeActivityEntry` SHALL normalize ambos labels (el del evento nuevo y el de la entry candidata) usando `stripLabelPrefixes` antes de comparar, en el fallback de matching por label.

#### Scenario: tool_start y tool_end con namespace diferente se colapsan

WHEN se recibe un evento `tool_end` con label `"write_file"`
AND existe en el timeline una entry con label `"fs_tools__write_file"` en estado `running`
THEN la entry existente es actualizada en lugar de crear una nueva
AND el timeline muestra exactamente una entrada para esa operación

#### Scenario: tool_start sin stepId se colapsa por label normalizado

WHEN se recibe un evento `tool_start` sin `stepId`
AND luego llega un `tool_end` con el mismo nombre de herramienta pero con prefijo de namespace
THEN el merge encuentra la entry por label normalizado
AND no aparece duplicado en el panel de actividad

#### Scenario: herramientas distintas con mismo nombre base no se colapsan

WHEN existen dos entries `running` con labels normalizados idénticos para herramientas concurrentes distintas
THEN el merge actualiza la entry más reciente (último elemento en el array que matchea)
AND el comportamiento es determinista

---

### Requirement: strip-label-prefixes-exported

`stripLabelPrefixes` en `session-meta.ts` SHALL ser un named export para poder ser importado en `chat-panel.tsx`.

#### Scenario: función accesible en merge

WHEN `chat-panel.tsx` necesita normalizar un label para matching
THEN puede importar `stripLabelPrefixes` desde `session-meta.ts`
AND no duplica la lógica de normalización
