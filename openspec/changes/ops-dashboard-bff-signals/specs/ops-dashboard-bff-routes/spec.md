## ADDED Requirements

### Requirement: BFF route GET /api/ops/status in ui-cognitive
El sistema SHALL exponer `GET /api/ops/status` en `ui-cognitive/app/api/ops/status/route.ts` como ruta BFF autenticada. La ruta SHALL validar sesion, consultar `NAT_BACKEND_URL/api/ops/status` en server-side y retornar payload JSON consistente para la UI.

#### Scenario: status proxy success
- **WHEN** un usuario autenticado llama `GET /api/ops/status` y el backend responde 200
- **THEN** la ruta BFF responde 200 con `containers` y metadatos sin alterar el contrato esperado por los hooks del dashboard

#### Scenario: status unauthorized
- **WHEN** un usuario no autenticado llama `GET /api/ops/status`
- **THEN** la ruta BFF responde 401 con JSON de error

#### Scenario: status backend unavailable
- **WHEN** el backend no responde o retorna error 5xx
- **THEN** la ruta BFF responde 503 con error normalizado y sin filtrar detalles sensibles

### Requirement: BFF route GET /api/ops/notes in ui-cognitive
El sistema SHALL exponer `GET /api/ops/notes` en `ui-cognitive/app/api/ops/notes/route.ts` como ruta BFF autenticada. La ruta SHALL reenviar `limit`, `note_type` y `container_name` hacia `NAT_BACKEND_URL/api/ops/notes` y conservar semantica de filtros.

#### Scenario: notes proxy with filters
- **WHEN** el cliente llama `GET /api/ops/notes?limit=10&note_type=anomaly`
- **THEN** la ruta BFF reenvia esos query params al backend y responde 200 con `notes`

#### Scenario: notes fallback empty
- **WHEN** el backend responde sin notas o con DB vacia
- **THEN** la ruta BFF responde 200 con `{ "notes": [] }`

#### Scenario: notes unauthorized
- **WHEN** un usuario no autenticado llama `GET /api/ops/notes`
- **THEN** la ruta BFF responde 401 con JSON de error

### Requirement: Dashboard hooks consume only BFF routes
Los hooks `use-ops-status` y `use-ops-notes` SHALL consumir exclusivamente rutas relativas `/api/ops/status` y `/api/ops/notes` (sin host hardcodeado), de forma consistente entre local y despliegue.

#### Scenario: portable relative URLs
- **WHEN** la aplicacion corre en localhost o en EasyPanel
- **THEN** los hooks resuelven correctamente las mismas rutas relativas sin cambios de codigo
