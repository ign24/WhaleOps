## 1. Backend: ops_api.py

- [x] 1.1 Crear `src/cognitive_code_agent/ops_api.py` con router FastAPI y endpoint `GET /api/ops/status` que llama a `docker.from_env()` y retorna containers (nombre, id, imagen, status, state, ports, created_at, started_at). Retorna 503 si Docker no está disponible.
- [x] 1.2 Agregar endpoint `GET /api/ops/notes` en el mismo archivo: consulta SQLite en `$NOTES_DB_PATH`, acepta query params `limit` (default 10, max 50), `note_type` y `container_name`. Retorna `{ "notes": [] }` si la DB está vacía o el path no está definido — nunca 5xx.
- [x] 1.3 Registrar el router de `ops_api.py` en `src/cognitive_code_agent/register.py` junto a los routers existentes.
- [x] 1.4 Verificar que `GET /api/ops/status` y `GET /api/ops/notes` responden correctamente con `uv run` o equivalente.

## 2. Frontend: tipos y hooks

- [x] 2.1 Agregar tipos TypeScript en `ui-cognitive/types/`: `OpsContainer` (name, id, image, status, state, ports, created_at, started_at) y `OpsNote` (id, container_name, note_type, content, created_at).
- [x] 2.2 Crear hook `ui-cognitive/hooks/use-ops-status.ts` con SWR, URL relativa `/api/ops/status`, `refreshInterval: 30000`.
- [x] 2.3 Crear hook `ui-cognitive/hooks/use-ops-notes.ts` con SWR, URL relativa `/api/ops/notes`, `refreshInterval: 60000`.

## 3. Frontend: componentes de dashboard

- [x] 3.1 Crear `ui-cognitive/components/ops/ops-header.tsx`: muestra "N running / M total" containers. Recibe datos del hook de containers.
- [x] 3.2 Crear `ui-cognitive/components/ops/containers-table.tsx`: tabla con columnas nombre, imagen, status badge (verde/gris/amarillo según state), uptime, puertos. Incluye skeleton loader para estado inicial y mensaje de error con retry para estado 503.
- [x] 3.3 Crear `ui-cognitive/components/ops/cron-jobs-panel.tsx`: lista de cron jobs activos usando el endpoint existente `/api/jobs/cron`. Reusar tipos `CronJobItem`. Muestra "Sin tareas programadas" si lista vacía.
- [x] 3.4 Crear `ui-cognitive/components/ops/notes-panel.tsx`: lista de últimas 10 notas con chip de tipo (anomaly con borde diferenciado), contenido truncado a 2 líneas. Muestra "Sin notas registradas" si lista vacía.

## 4. Frontend: página /ops

- [x] 4.1 Crear `ui-cognitive/app/(app)/ops/page.tsx` con layout de dashboard: header de estado (OpsHeader) arriba, tabla de containers en el centro, fila inferior con CronJobsPanel (izquierda) y NotesPanel (derecha).
- [x] 4.2 Verificar que la página usa los hooks con URLs relativas — ninguna URL hardcodeada con hostname o puerto.

## 5. Frontend: navegación

- [x] 5.1 Agregar link a `/ops` en `ui-cognitive/components/layout/sidebar.tsx` con ícono apropiado (e.g. `Server` de lucide-react). Debe aparecer en estado activo cuando la ruta actual es `/ops`.

## 6. Tests

- [x] 6.1 Escribir tests unitarios para `GET /api/ops/status`: respuesta exitosa con containers mockeados, respuesta 503 cuando Docker lanza `DockerException`.
- [x] 6.2 Escribir tests unitarios para `GET /api/ops/notes`: retorna notas de SQLite, retorna `[]` si DB vacía, respeta filtros `note_type` y `limit`.
- [x] 6.3 Escribir tests para `containers-table.tsx`: renderiza skeleton en loading, renderiza filas con datos, muestra error cuando status es 503.
- [x] 6.4 Verificar que el build de `ui-cognitive` pasa sin errores de tipos: `bun run build`.
