## Why

El panel de actividad muestra entradas duplicadas para el mismo tool call porque `mergeActivityEntry` compara labels sin normalizar — `tool_start` emite `"write_file"` y `tool_end` emite `"fs_tools__write_file"`, rompiendo el match. Además, la información contextual de cada herramienta (comando ejecutado, ruta del archivo) solo aparece al completarse la herramienta, no durante su ejecución, y los nombres de modelo se truncan sin tooltip.

## What Changes

- Fix de `mergeActivityEntry` en `chat-panel.tsx`: normalizar el label antes de comparar usando la misma función `stripLabelPrefixes` ya existente en `session-meta.ts`, eliminando los duplicados.
- Extracción temprana de contexto en `summarizeToolContext`: leer `commandSummary` desde `toolArgs` en `tool_start`, no solo en `tool_end`, para mostrar el comando mientras la herramienta está `running`.
- Enriquecimiento del subtitle de Terminal en `timeline-entry.tsx`: agregar prefijo `$` al comando y mostrarlo durante todo el ciclo de vida de la entry.
- Subtitle para file tools durante `running`: extraer `path`/`file_path` de `toolArgs` en `tool_start` para mostrarlo antes de tener el resultado.
- Tooltip en labels truncados: wrappear el label text con un tooltip nativo (`title` attr) o componente para que el nombre completo sea accesible en hover.

## Capabilities

### New Capabilities
- `activity-entry-merge-fix`: Colapso correcto de tool_start/tool_end en una sola entry mediante normalización de label antes del match.
- `tool-context-early-extraction`: Extracción de commandSummary y path desde toolArgs en tool_start para enriquecer la entry durante estado running.
- `timeline-entry-tooltip`: Tooltip en labels que se truncan (modelo, herramienta con nombre largo).

### Modified Capabilities
- Ninguna.

## Impact

- `ui-cognitive/components/chat/chat-panel.tsx` — `mergeActivityEntry`, `summarizeToolContext`
- `ui-cognitive/components/activity/timeline-entry.tsx` — subtitle rendering, tooltip
- `ui-cognitive/components/activity/session-meta.ts` — exponer `stripLabelPrefixes` como export nombrado para reusar en chat-panel
- Tests afectados: `ui-cognitive/tests/chat-panel.test.tsx`, `ui-cognitive/tests/session-meta.test.ts`
- Sin impacto en APIs, contratos de datos ni backend
