## ADDED Requirements

### Requirement: Endpoint GET /api/ops/status
El sistema SHALL exponer un endpoint FastAPI `GET /api/ops/status` en `src/cognitive_code_agent/ops_api.py`. El endpoint SHALL llamar a `docker.from_env()` directamente (no via NAT tools) y retornar la lista de containers con sus metadatos. El endpoint SHALL respetar la variable de entorno `DOCKER_HOST` si está definida; si no, usa el socket local por defecto.

#### Scenario: Respuesta exitosa con containers
- **WHEN** el endpoint recibe GET /api/ops/status y el Docker daemon está disponible
- **THEN** retorna HTTP 200 con JSON `{ "containers": [...] }` donde cada item tiene: `name`, `id` (12 chars), `image`, `status`, `state`, `ports`, `created_at`, `started_at`

#### Scenario: Docker daemon no disponible
- **WHEN** `docker.from_env()` lanza `DockerException`
- **THEN** el endpoint retorna HTTP 503 con `{ "error": "Docker daemon unavailable: <mensaje>" }`

#### Scenario: Containers incluye todos los estados
- **WHEN** hay containers en estado running, exited y restarting
- **THEN** el endpoint los retorna todos (equivalente a `docker ps -a`)

#### Scenario: Ports formateados como lista de strings
- **WHEN** un container tiene puertos mapeados
- **THEN** cada puerto aparece como string en formato "host_port:container_port/proto" o "container_port/proto" si no hay binding

### Requirement: Endpoint GET /api/ops/notes
El sistema SHALL exponer un endpoint FastAPI `GET /api/ops/notes` que consulte la base de datos SQLite en `$NOTES_DB_PATH`. El endpoint SHALL aceptar query params opcionales: `limit` (default 10, max 50), `note_type` (filtra por tipo), `container_name` (filtra por container).

#### Scenario: Respuesta exitosa con notas
- **WHEN** el endpoint recibe GET /api/ops/notes y la DB tiene registros
- **THEN** retorna HTTP 200 con JSON `{ "notes": [...] }` donde cada item tiene: `id`, `container_name`, `note_type`, `content`, `created_at` (ISO string)

#### Scenario: DB vacía o path no configurado
- **WHEN** `NOTES_DB_PATH` no está definido o la tabla está vacía
- **THEN** el endpoint retorna HTTP 200 con `{ "notes": [] }` — nunca un error 5xx por lista vacía

#### Scenario: Filtro por tipo de nota
- **WHEN** se pasa query param `note_type=anomaly`
- **THEN** el endpoint retorna solo notas con `note_type = "anomaly"` ordenadas por `created_at DESC`

#### Scenario: Límite de resultados respetado
- **WHEN** se pasa `limit=5`
- **THEN** el endpoint retorna máximo 5 notas; si se pasa `limit=100` se clampea a 50

### Requirement: ops_api.py registrado en register.py
El router de `ops_api.py` SHALL incluirse en `register.py` junto a los demás routers existentes (`jobs_api`, etc.) para que los endpoints queden disponibles en el servidor FastAPI principal.

#### Scenario: Endpoints accesibles en servidor
- **WHEN** el servidor arranca con `ops_api` registrado
- **THEN** GET /api/ops/status y GET /api/ops/notes responden sin errores de routing

### Requirement: Sin rutas hardcodeadas en el cliente
El frontend SHALL consumir los endpoints usando paths relativos (`/api/ops/status`, `/api/ops/notes`). Ningún archivo TypeScript/JavaScript SHALL contener un hostname o puerto hardcodeado para estos endpoints.

#### Scenario: Fetch relativo funciona en local y producción
- **WHEN** el frontend hace fetch a `/api/ops/status` en localhost:3000 y en el dominio de EasyPanel
- **THEN** el request llega correctamente al backend en ambos entornos via Next.js proxy
