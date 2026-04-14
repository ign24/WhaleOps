## Why

El ops-agent corre en D09 y tiene herramientas para inspeccionar containers, guardar notas y programar tareas, pero toda esa información solo es visible mientras el agente la ejecuta en un chat. No existe una vista de estado del sistema independiente de la conversación activa. Se necesita un panel que muestre el estado operacional del host en tiempo real, sin tener que iniciar una sesión de chat.

## What Changes

- Nueva página `/ops` en `ui-cognitive` con layout de dashboard
- Nuevo endpoint de backend `/api/ops/status` que agrega datos Docker sin pasar por el agente LLM
- Nuevo endpoint `/api/ops/notes` que expone las notas guardadas en SQLite
- El sidebar existente agrega un link a `/ops` junto a "Dashboard" de observabilidad
- Todas las URLs de servicios externos se leen desde variables de entorno — sin rutas hardcodeadas

## Capabilities

### New Capabilities

- `ops-dashboard`: Página `/ops` con tres secciones: containers en tiempo real (polling), cron jobs activos, y notas/anomalías recientes. Data fetching con SWR, refresh automático cada 30s para containers.
- `ops-status-api`: Endpoint FastAPI `/api/ops/status` que llama directamente al Docker SDK (`docker.from_env()`) y retorna lista de containers con status, image, ports y uptime. Endpoint `/api/ops/notes` que consulta SQLite y retorna notas filtradas por tipo y container.

### Modified Capabilities

- `ops-tools`: Los tools Docker existentes no cambian en comportamiento, pero el nuevo `ops-status-api` usa el mismo `docker.from_env()` directamente (sin NAT tools) para no requerir sesión de agente.

## Impact

- **Frontend**: nueva ruta `app/(app)/ops/page.tsx` + componentes en `components/ops/`
- **Backend**: 2 nuevos endpoints en un archivo `ops_api.py` registrado en `register.py`
- **Sidebar**: agregar link `/ops` en `sidebar.tsx`
- **Env vars**: `DOCKER_HOST` (opcional, default socket local), `NOTES_DB_PATH` (ya existe)
- **Sin cambios** a: tools NAT, memory, system prompts, cron tools
- **Deployment**: compatible con EasyPanel — las URLs del frontend son relativas (`/api/...`), el backend se conecta al socket Docker del host vía volume mount
