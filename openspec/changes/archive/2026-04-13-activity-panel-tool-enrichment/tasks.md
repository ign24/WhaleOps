## 1. Preparación y baseline

- [x] 1.1 Leer `session-meta.ts` y confirmar que `stripLabelPrefixes` es una función interna (`const` sin `export`).
- [x] 1.2 Leer el bloque `mergeActivityEntry` en `chat-panel.tsx` (líneas ~280-370) para entender el flow de matching actual.
- [x] 1.3 Escribir test RED en `chat-panel.test.tsx`: dos eventos `tool_start` + `tool_end` con labels `"fs_tools__write_file"` / `"write_file"` deben producir **una sola** entry en el timeline.

## 2. Fix de merge — normalización de label

- [x] 2.1 Exportar `stripLabelPrefixes` como named export en `session-meta.ts` (mantener la implementación existente, solo agregar `export`).
- [x] 2.2 En `chat-panel.tsx`, importar `stripLabelPrefixes` desde `session-meta.ts`.
- [x] 2.3 En el fallback de matching por label dentro de `mergeActivityEntry`, reemplazar `row.label === label` por `stripLabelPrefixes(row.label.trim()) === stripLabelPrefixes(label.trim())`.
- [x] 2.4 Correr el test del paso 1.3 y confirmar que pasa (GREEN).
- [x] 2.5 Correr toda la suite de `chat-panel.test.tsx` y confirmar que no hay regresiones.

## 3. Extracción temprana de contexto en tool_start

- [x] 3.1 Escribir test RED: un evento `tool_start` con `toolArgs = { command: "git status" }` debe producir una entry con `commandSummary = "git status"`.
- [x] 3.2 En el branch de creación de nueva entry dentro de `mergeActivityEntry` (el `return [...previous, { ... }]`), incluir `toolContext` en el spread de la nueva entry (ya se calcula antes del branch, solo hay que propagarlo).
- [x] 3.3 Verificar que `summarizeToolContext` extrae correctamente `commandSummary` desde el evento de `tool_start` — no requiere cambio, solo confirmar que el campo ya está disponible.
- [x] 3.4 Escribir test RED: `tool_start` con `toolArgs = { path: "/workspace/agent.py" }` debe producir `sandboxPath = "/workspace/agent.py"`.
- [x] 3.5 En `summarizeToolContext`, agregar `"path"` y `"file_path"` a los keys de búsqueda del `sandboxPath` (junto a los existentes `"repo_path"`, `"repoPath"`, etc.).
- [x] 3.6 Correr los tests del paso 3.1 y 3.4 y confirmar GREEN.

## 4. Enrichment visual en timeline-entry

- [x] 4.1 En `timeline-entry.tsx`, agregar lógica de prefijo `$` al subtitle cuando la category es `"terminal"`:
  ```ts
  const displaySubtitle = category === "terminal" && subtitle
    ? `$ ${subtitle}`
    : subtitle;
  ```
  Usar `displaySubtitle` en el render del `<p>` de subtitle.
- [x] 4.2 Agregar `title={humanizeActivityLabel(entry.label)}` al `<p>` del label para exponer el texto completo en tooltip nativo.
- [x] 4.3 Agregar `title={subtitle}` (el valor sin prefijo) al `<p>` del subtitle cuando existe.
- [x] 4.4 Escribir tests de snapshot o render en `session-meta.test.ts` / el test de `timeline-entry` si existe, validando que el prefix `$` aparece para terminal y no para file.

## 5. Validación final

- [x] 5.1 Correr `bun run test` en `ui-cognitive/` y confirmar que toda la suite pasa sin nuevos fallos.
- [ ] 5.2 Verificar manualmente en el panel de actividad que: (a) ya no hay duplicados para write/read/terminal, (b) el comando de terminal aparece durante `running`, (c) el path de archivo aparece durante `running`, (d) hover en label largo muestra tooltip completo.
- [x] 5.3 Correr `bun run lint` y confirmar sin errores de tipo.
