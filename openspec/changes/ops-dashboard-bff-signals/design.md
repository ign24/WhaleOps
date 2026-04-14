## Context

El backend FastAPI ya expone `GET /api/ops/status` y `GET /api/ops/notes` en `src/cognitive_code_agent/ops_api.py`, y tambien existe `GET /api/jobs/cron` en `src/cognitive_code_agent/jobs_api.py`. En `ui-cognitive`, la pagina `/ops` y sus hooks (`use-ops-status`, `use-ops-notes`) consumen rutas relativas `/api/ops/*`, pero esas rutas BFF no estan implementadas en App Router, por lo que la UI queda sin datos.

Ademas, la capa de observabilidad ya publica `latencia` y `errores` via `app/api/observability/summary/route.ts`. El problema no es falta de fuentes, sino falta de composicion operacional: hoy la pagina mezcla paneles sin priorizar senales estrategicas ni politica anti-ruido.

## Goals / Non-Goals

**Goals:**
- Restaurar la captura de datos en `/ops` creando rutas BFF faltantes para status y notes.
- Consolidar un resumen estrategico con KPIs de estado operativo (running/total, degradados, jobs activos, latency/error).
- Definir alertado por excepcion: solo alertas accionables, sin ruido informativo.
- Habilitar drill-down opcional por contenedor (logs/inspect) bajo interaccion explicita.
- Asegurar TDD y validacion funcional del flujo completo.

**Non-Goals:**
- Redisenar completo de UI fuera del dashboard `/ops`.
- Cambiar contratos core de `ops_api.py` o `jobs_api.py` salvo normalizacion minima de formato.
- Introducir nuevas dependencias de infraestructura (colas, nuevos servicios, DB adicional).

## Decisions

### D1. BFF dedicado para `/api/ops/status` y `/api/ops/notes` en `ui-cognitive`
Se agregan `app/api/ops/status/route.ts` y `app/api/ops/notes/route.ts` con el mismo patron de las otras rutas internas: validacion de sesion, proxy server-to-server al backend (`NAT_BACKEND_URL`) y respuestas JSON estables para frontend.

**Alternativas consideradas**
- Cliente llamando backend directo desde browser: rechazada por romper el patron BFF y exponer topologia.
- Mover agregacion al backend Python: descartada para no acoplar vistas UI con logica de presentacion.

### D2. Agregador de senales estrategicas en frontend server layer
Se construye un agregador en la capa server de `ui-cognitive` que combina:
- containers desde `/api/ops/status`
- jobs desde `/api/jobs/cron`
- latency/error desde `/api/observability/summary`

El resultado se consume por `/ops` como `strategicSignals` con metrica reducida y semaforizacion.

**Alternativas consideradas**
- Calculo en cliente con multiples fetch paralelos: rechazada por complejidad de estados y duplicacion.
- Nuevo endpoint Python unico: postergado, innecesario para cerrar el gap actual.

### D3. Politica de alertas "exception-only"
El dashboard solo mostrara alertas cuando exista:
- contenedores degradados/fallidos
- errores recientes por encima del umbral
- latencia por encima del umbral
- fallo/timeout de una fuente critica

No se mostraran banners de estado normal.

**Alternativas consideradas**
- Alertas de todo evento (info/warn/error): rechazada por ruido operacional.

### D4. Drill-down opcional y lazy
Logs/inspect por contenedor se activa solo al expandir detalle o abrir modal contextual. Si la fuente no esta disponible, se retorna estado degradado sin romper la vista principal.

**Alternativas consideradas**
- Cargar logs/inspect para todos los contenedores al inicio: rechazada por costo y ruido.

## Risks / Trade-offs

- [Inconsistencia temporal entre fuentes] -> Mitigacion: `generatedAt` comun y tolerancia a datos parciales.
- [Fallas intermitentes del backend NAT] -> Mitigacion: timeouts cortos, retries controlados y fallback degradado.
- [Definicion ambigua de "degradado"] -> Mitigacion: regla explicita basada en estado container (`restarting`, `exited`, `dead`, `unhealthy`) + tests de tabla de verdad.
- [Complejidad UI por nuevo resumen] -> Mitigacion: separar componentes de KPI/alertas/drill-down y cubrir con tests unitarios.

## Migration Plan

1. Implementar y probar rutas BFF `/api/ops/status` y `/api/ops/notes`.
2. Implementar agregador de senales y adaptar hooks/componentes de `/ops`.
3. Activar politica de alertas por excepcion y agregar drill-down lazy.
4. Ejecutar suite de validacion (lint, unit tests, build) y smoke de `/ops`.
5. Rollback: desactivar agregador nuevo y volver temporalmente al render de tabla/paneles existente (sin eliminar rutas BFF ya anadidas).

## Open Questions

- Umbral inicial de latencia para alerta (p.ej. 1200ms vs 2000ms).
- Fuente exacta para `inspect/logs` en drill-down (reusar endpoint existente o exponer BFF adicional).
