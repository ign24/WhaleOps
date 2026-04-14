## Context

El ops-agent corre en D09 como contenedor Docker (EasyPanel). El frontend (`ui-cognitive`) es Next.js corriendo en el mismo proceso/contenedor que el backend FastAPI, conectados via Next.js rewrites a `/api/*`. El backend tiene acceso al Docker socket del host vía volume mount (`/var/run/docker.sock`). Existe SQLite en `$NOTES_DB_PATH` con notas guardadas por el agente.

**Constraint crítico**: todas las URLs del frontend son relativas (`/api/...`). Las URLs de servicios externos (si las hubiera) se leen desde env vars. No hay rutas hardcodeadas. Esto garantiza que el mismo build funcione en `localhost:3000` y en EasyPanel sin cambios.

## Goals / Non-Goals

**Goals:**
- Página `/ops` con estado Docker en tiempo real (polling, sin agente LLM)
- Endpoint backend `/api/ops/status` que consulta Docker SDK directamente
- Endpoint backend `/api/ops/notes` que expone notas SQLite
- Compatible con despliegue EasyPanel en D09 sin cambios de config
- Cero rutas hardcodeadas — todo relativo o desde env vars

**Non-Goals:**
- Métricas de host (CPU, RAM, disco) — eso es D03 API, fuera de scope
- Edición o borrado de notas desde el dashboard
- WebSocket/SSE — polling es suficiente para containers
- Autenticación diferenciada para el dashboard

## Decisions

### 1. Endpoint directo al Docker SDK (no pasar por NAT tools)

**Decisión**: El nuevo `ops_api.py` llama a `docker.from_env()` directamente, igual que `ops_tools.py`, pero expuesto como endpoint HTTP.

**Alternativa descartada**: Reutilizar NAT tools disparando un agente — agrega latencia de LLM innecesaria para datos que son puramente consultas SDK.

**Rationale**: El dashboard es un panel de estado, no requiere razonamiento del agente. Docker SDK es síncrono y rápido.

### 2. Polling desde el frontend con SWR (no WebSocket)

**Decisión**: El frontend usa `useSWR` con `refreshInterval: 30000` para containers y `refreshInterval: 60000` para notas.

**Alternativa descartada**: SSE (Server-Sent Events) — agrega complejidad de streaming sin ganancia real para datos que cambian cada varios minutos.

**Rationale**: Los containers en D09 son estables. 30s es suficiente para detectar cambios. SWR ya está en el proyecto.

### 3. URLs 100% relativas en el frontend

**Decisión**: Todos los fetches usan `/api/ops/status` y `/api/ops/notes` — paths relativos, sin hostname.

**Rationale**: EasyPanel expone el servicio en un dominio custom. Hardcodear `localhost` o cualquier hostname rompe el despliegue. Los rewrites de Next.js (`next.config.js`) ya proxean `/api/*` al backend FastAPI.

### 4. Nuevo archivo `ops_api.py` (no modificar archivos existentes de tools)

**Decisión**: Los endpoints van en `src/cognitive_code_agent/ops_api.py`, registrado en `register.py` junto a `jobs_api.py`.

**Alternativa descartada**: Agregar routes a un archivo existente — viola separación de concerns.

### 5. Layout de dashboard: grid de cards con tabla de containers

**Decisión**: Layout de 3 secciones verticales:
1. Header con estado general (N containers running / total)
2. Tabla de containers (nombre, imagen, status, uptime, puertos)
3. Fila inferior: Cron Jobs activos (izquierda) + Notas recientes (derecha)

**Rationale**: Patrón estándar de ops dashboard. Información más crítica (containers) arriba, contexto histórico (notas) abajo.

## Risks / Trade-offs

- **Docker socket no disponible** → `docker.from_env()` lanza `DockerException`. El endpoint debe devolver `503` con mensaje claro en lugar de 500. El frontend muestra un estado de error amigable.
- **SQLite vacío o path incorrecto** → `get_notes` puede retornar lista vacía. El endpoint no debe fallar — retorna `[]` y el frontend muestra "Sin notas registradas".
- **EasyPanel routing** → Si EasyPanel usa un path prefix (ej. `/ops-agent/`), los rewrites de Next.js deben estar configurados correctamente. Esto es responsabilidad de la config de EasyPanel, no del código.
- **Polling en múltiples tabs** → Cada tab abre su propio intervalo de polling. Con SWR y `dedupingInterval` configurado, múltiples tabs del mismo usuario comparten el caché — bajo riesgo.

## Migration Plan

1. Agregar `ops_api.py` con los dos endpoints
2. Registrar en `register.py`
3. Crear componentes frontend en `components/ops/`
4. Agregar ruta `app/(app)/ops/page.tsx`
5. Agregar link en `sidebar.tsx`
6. No requiere migraciones de base de datos — SQLite ya existe
7. Rollback: revertir `register.py` y `sidebar.tsx` es suficiente para desactivar sin borrar código

## Open Questions

- ¿Qué campos de container son prioritarios en la tabla? (propuesta: nombre, imagen, status, uptime, puertos)
- ¿El link en sidebar se llama "Ops" o "Containers" o "Estado del host"?
