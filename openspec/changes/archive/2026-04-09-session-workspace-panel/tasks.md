## 1. Tipos y lógica de derivación

- [x] 1.1 Definir el tipo `WorkspaceSnapshot` en `ui-cognitive/types/chat.ts` (repos, filesRead, filesWritten, directoriesExplored, commandsRun, isEmpty)
- [x] 1.2 Crear `ui-cognitive/components/activity/workspace-snapshot.ts` con los sets de tool names (`CLONE_TOOLS`, `READ_TOOLS`, `WRITE_TOOLS`, `DIR_TOOLS`, `SHELL_TOOLS`)
- [x] 1.3 Implementar `deriveWorkspaceSnapshot(entries: ActivityEntry[]): WorkspaceSnapshot` — parsear toolResult JSON para clone, extraer paths de toolArgs para read/write/dir, deduplicar
- [x] 1.4 Implementar `relativizeToRepo(filePath: string, repos: WorkspaceSnapshot["repos"]): string`
- [x] 1.5 Verificar que entries con status != "completed" son ignorados

## 2. Componente SessionWorkspace

- [x] 2.1 Crear `ui-cognitive/components/activity/session-workspace.tsx` con el scaffold del componente (props: `entries: ActivityEntry[]`, estado: `isExpanded`)
- [x] 2.2 Lógica de expansión por defecto: collapsed si totalItems > 10, expandido si <= 10
- [x] 2.3 Sección de repos clonados: URL, ruta local (font-mono), badge shallow/full, duración formateada con `formatDuration`
- [x] 2.4 Sección de archivos leídos: lista de paths relativizados, scroll si > 5 items, `font-mono text-xs`
- [x] 2.5 Sección de archivos escritos: separada, con badge de operación (write/edit/create) usando colores `var(--success)`/`var(--error)`/muted
- [x] 2.6 Sección de árbol de directorio: `<pre>` con `max-h-40 overflow-y-auto`, font-mono, text-xs
- [x] 2.7 Sección de comandos shell: lista colapsada si > 5, comandos truncados a 80 chars
- [x] 2.8 Retornar `null` cuando `snapshot.isEmpty === true`
- [x] 2.9 Header de la sección con toggle expand/collapse y conteo de items totales

## 3. Integración en ActivityPanel

- [x] 3.1 Importar `SessionWorkspace` en `activity-panel.tsx`
- [x] 3.2 Insertar `<SessionWorkspace entries={entries} />` entre `ActivityTimeline` (div flex-1) y `<SessionSummary />`
- [x] 3.3 Verificar que el layout del panel no se rompe cuando `SessionWorkspace` retorna `null`
- [x] 3.4 Verificar que con datos la sección aparece con `border-t border-[var(--border)]` como separador

## 4. Verificación visual y estética

- [x] 4.1 Confirmar que todos los colores son variables CSS del design system (ningún color hardcodeado)
- [x] 4.2 Confirmar que tipografía es `text-xs` y `font-mono` para paths/comandos, consistente con `ToolCallCard`
- [x] 4.3 Probar con sesión de clone + análisis: verificar repo, archivos y árbol aparecen correctamente
- [x] 4.4 Probar con sesión sin file ops: verificar que el componente no aparece (isEmpty)
- [x] 4.5 Probar con sesión histórica (entries cargados desde historial): verificar que funciona igual que live

## 5. Soporte spawn_agent (arquitectura padre-subagente)

- [x] 5.1 Agregar `WorkspaceSubagentTask` type en `types/chat.ts` y añadir `subagentTasks` a `WorkspaceSnapshot`
- [x] 5.2 Detectar `spawn_agent` en `workspace-snapshot.ts` — extraer repo path con regex `/tmp/analysis/<name>` del campo `task`
- [x] 5.3 Mapear status del entry al status del subagent task (running/completed/failed)
- [x] 5.4 Incluir `subagentTasks.length` en el check de `isEmpty`
- [x] 5.5 Agregar `SubagentTasksSection` en `session-workspace.tsx` (status dot + tarea + repo path + tools como badges)
- [x] 5.6 Eliminar indicador debug del componente (la línea "Workspace: N entries, sin ops de archivos")
- [x] 5.7 Agregar tests de `spawn_agent` en `workspace-snapshot.test.ts`
