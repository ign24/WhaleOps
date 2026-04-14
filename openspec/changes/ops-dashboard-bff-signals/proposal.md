## Why

El dashboard `/ops` de `ui-cognitive` hoy no captura datos reales porque el cliente llama a rutas BFF que no existen (`/api/ops/status` y `/api/ops/notes`). Esto deja la vista operativa sin señal accionable justo cuando se necesita monitoreo en tiempo real con bajo ruido.

## What Changes

- Agregar rutas BFF en `ui-cognitive` para `GET /api/ops/status` y `GET /api/ops/notes`, reutilizando el backend existente (`src/cognitive_code_agent/ops_api.py`) en lugar de duplicar logica.
- Extender `/ops` para mostrar un resumen estrategico (no verbose) con KPIs: `running/total`, `degradados`, `jobs activos`, `latencia promedio`, `errores`.
- Reutilizar fuentes ya existentes: `ops_api.py` (estado y notas), `jobs_api.py` (cron activos) y `app/api/observability/summary/route.ts` (latency/error).
- Cambiar politica visual de alertas: mostrar alertas solo por excepcion (degradacion, error, timeout o falta de datos), eliminando avisos informativos ruidosos.
- Incorporar drill-down opcional por contenedor (logs/inspect) bajo demanda, sin sobrecargar la vista principal.

## Capabilities

### New Capabilities
- `ops-dashboard-bff-routes`: BFF de `ui-cognitive` para proxy autenticado de `/api/ops/status` y `/api/ops/notes` hacia backend NAT.
- `ops-dashboard-strategic-signals`: tablero `/ops` centrado en KPIs y alertas por excepcion, con drill-down opcional por contenedor.

### Modified Capabilities
- Ninguna.

## Impact

- **Frontend (ui-cognitive)**: nuevas rutas en `app/api/ops/*`, ajustes en hooks `use-ops-*`, componentes de `/ops` y tipos asociados.
- **Backend existente (sin endpoints nuevos obligatorios)**: se consume `src/cognitive_code_agent/ops_api.py` y `src/cognitive_code_agent/jobs_api.py` como fuentes de verdad.
- **Observabilidad**: se integra el payload de `/api/observability/summary` para KPI de latencia/error en una vista operativa unica.
- **QA/TDD**: nuevos tests unitarios de BFF, hooks y componentes; validacion end-to-end del flujo `/ops` con datos reales y estados degradados.
