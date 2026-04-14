## 1. Cambios triviales (sidebar + tipos)

- [x] 1.1 En `sidebar.tsx` cambiar el label "Workspace" (línea ~352) a "Conversaciones"
- [x] 1.2 En `types/chat.ts` agregar el type `OpsSnapshot`: `{ containersReferenced: string[]; logsFetched: { container: string; lines: number }[]; notesSaved: { type: string; container?: string }[]; schedulesCreated: { name: string; cron: string }[]; isEmpty: boolean }`

## 2. TDD — deriveOpsSnapshot (RED)

- [x] 2.1 Crear `tests/ops-session-context.test.tsx` con casos para `deriveOpsSnapshot`:
  - entrada vacía → snapshot con `isEmpty: true` y todos los arrays vacíos
  - entry con toolName `get_container_logs` y args `{container_name, lines}` → `logsFetched` con ese registro
  - entries duplicadas del mismo container → `containersReferenced` deduplica
  - entry con `save_note` y args `{note_type, container_name}` → `notesSaved` con ese registro
  - entry con `schedule_task` y args `{action: "create", name, cron}` → `schedulesCreated` con ese registro
  - mix de tool calls → `isEmpty: false`
- [x] 2.2 Verificar que todos los tests de 2.1 fallan (función no existe aún)

## 3. Implementar deriveOpsSnapshot (GREEN)

- [x] 3.1 Crear `components/activity/ops-session-context.tsx` con la función `deriveOpsSnapshot(entries: ActivityEntry[]): OpsSnapshot`
  - Iterar entries donde `kind === "tool"` y `toolArgs` está presente
  - Extraer `container_name` o `container_id` de `toolArgs` para `containersReferenced` (deduplicar con Set)
  - Si `toolNameNormalized` o `label` incluye `get_container_logs`, agregar a `logsFetched`
  - Si incluye `save_note`, agregar a `notesSaved`
  - Si incluye `schedule_task` y `toolArgs.action === "create"`, agregar a `schedulesCreated`
- [x] 3.2 Ejecutar tests de 2.1 — todos deben pasar

## 4. TDD — OpsSessionContext component (RED)

- [x] 4.1 Agregar casos de render en `tests/ops-session-context.test.tsx`:
  - snapshot vacío → componente no se renderiza (returns null)
  - snapshot con 1 container → sección "Containers consultados" visible
  - snapshot con log fetch → sección "Logs obtenidos" visible
  - snapshot con nota guardada → sección "Notas guardadas" visible
  - snapshot con schedule → sección "Tareas programadas" visible
  - snapshot con > 10 ítems → panel colapsado por defecto
- [x] 4.2 Verificar que los tests de render fallan (componente no renderiza esas secciones aún)

## 5. Implementar OpsSessionContext component (GREEN)

- [x] 5.1 Agregar el componente `OpsSessionContext` en `components/activity/ops-session-context.tsx`
  - Acepta `{ entries: ActivityEntry[] }`
  - Llama `deriveOpsSnapshot(entries)` con `useMemo`
  - Si `snapshot.isEmpty` → return null
  - Renderiza un panel colapsable (mismo patrón que `SessionWorkspace`) con secciones por tipo
  - Default collapsed cuando total items > 10
- [x] 5.2 Ejecutar todos los tests de 4.1 — deben pasar

## 6. Integrar OpsSessionContext en ActivityPanel

- [x] 6.1 En `components/activity/activity-panel.tsx`, reemplazar `import { SessionWorkspace }` con `import { OpsSessionContext }`
- [x] 6.2 Reemplazar `<SessionWorkspace entries={...} />` con `<OpsSessionContext entries={...} />`
- [x] 6.3 Adaptar test existente `tests/session-workspace.test.tsx` (si existe) o crear `tests/activity-panel-ops.test.tsx` verificando que `OpsSessionContext` se renderiza en lugar de `SessionWorkspace`

## 7. TDD — ToolCallCard container chip (RED)

- [x] 7.1 En `tests/tool-call-card-visual.test.tsx`, agregar casos:
  - args con `container_name` → chip con ese valor se renderiza
  - args con `container_id` → chip con ese valor se renderiza
  - args sin container ref → no se renderiza chip de container
  - verificar que no se renderiza ningún chip con contenido de `sandboxPath`
- [x] 7.2 Verificar que los nuevos casos fallan (lógica aún no cambiada)

## 8. Implementar cambios en ToolCallCard (GREEN)

- [x] 8.1 En `components/chat/tool-call-card.tsx`:
  - Remover prop `sandboxPath` del tipo `ToolCallCardProps`
  - Remover `sandboxPath` de `ContextChips` props y de su render
  - Agregar prop opcional `containerRef?: string` a `ContextChips`
  - Renderizar chip de container cuando `containerRef` está presente (mismo estilo que el anterior sandbox chip)
- [x] 8.2 En el uso de `ToolCallCard` (buscar en `agent-step-card.tsx` o `timeline-entry.tsx`), extraer `container_name ?? container_id` de `toolArgs` y pasarlo como `containerRef`
- [x] 8.3 Ejecutar tests de 7.1 — deben pasar

## 9. TDD — ChatHelpCard capability cards (RED)

- [x] 9.1 En `tests/chat-help-card.test.tsx`, agregar casos:
  - card con título "Tareas programadas" está presente
  - card con título "Registro de incidentes" está presente
  - click en "Tareas programadas" llama `onPromptSelect` con "Listá las tareas programadas activas"
  - click en "Registro de incidentes" llama `onPromptSelect` con "¿Qué problemas recurrentes tiene este host?"
- [x] 9.2 Verificar que los nuevos casos fallan (cards no existen aún)

## 10. Implementar capability cards en ChatHelpCard (GREEN)

- [x] 10.1 En `components/chat/chat-help-card.tsx`, agregar dos entradas al array `capabilities`:
  - `{ icon: Clock, title: "Tareas programadas", description: "Crea, lista o cancela tareas cron recurrentes.", prompt: "Listá las tareas programadas activas" }`
  - `{ icon: BookOpen, title: "Registro de incidentes", description: "Guarda y consulta findings estructurados asociados a containers.", prompt: "¿Qué problemas recurrentes tiene este host?" }`
- [x] 10.2 Importar `Clock` y `BookOpen` desde `lucide-react`
- [x] 10.3 Ejecutar tests de 9.1 — deben pasar

## 11. Verificación final

- [x] 11.1 Ejecutar suite completa: `cd ui-cognitive && bun run test`
- [x] 11.2 Ejecutar build: `bun run build` — debe pasar sin errores TypeScript
- [x] 11.3 Verificar que `SessionWorkspace` ya no es importado en ningún archivo de la app (puede quedar el archivo o eliminarse)
