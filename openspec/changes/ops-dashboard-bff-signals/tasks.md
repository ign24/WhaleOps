## 1. BFF routes en ui-cognitive

- [x] 1.1 Crear `ui-cognitive/app/api/ops/status/route.ts` con auth server-side, proxy a `${NAT_BACKEND_URL}/api/ops/status`, timeout y errores normalizados.
- [x] 1.2 Crear `ui-cognitive/app/api/ops/notes/route.ts` con auth server-side, passthrough de `limit/note_type/container_name` y respuesta `{ notes: [] }` en fallback seguro.
- [x] 1.3 Unificar tipado de respuestas de rutas BFF para que `use-ops-status` y `use-ops-notes` no requieran cambios de contrato.

## 2. Strategic signals y alertas por excepcion

- [x] 2.1 Implementar agregador de senales estrategicas en `ui-cognitive` reutilizando `/api/ops/status`, `/api/jobs/cron` y `/api/observability/summary`.
- [x] 2.2 Extender componentes de `/ops` para mostrar KPIs: running/total, degradados, jobs activos, latency/error.
- [x] 2.3 Aplicar politica "exception-only" para alertas (sin banners informativos en estado normal).
- [x] 2.4 Implementar drill-down opcional por contenedor (logs/inspect) con carga lazy y manejo de degradacion.

## 3. TDD (RED -> GREEN -> REFACTOR)

- [x] 3.1 Escribir primero tests unitarios de `GET /api/ops/status` y `GET /api/ops/notes` (auth, proxy success, backend error, fallback).
- [x] 3.2 Escribir tests unitarios del agregador de KPIs/alertas con fixtures normales y degradados antes de implementar la logica final.
- [x] 3.3 Escribir tests de componentes/hook para validar render de KPIs, ausencia de alertas en estado normal y presencia de alertas solo por excepcion.
- [x] 3.4 Refactorizar para claridad (sin romper tests) y consolidar utilidades compartidas.

## 4. Validacion y cierre

- [ ] 4.1 Ejecutar `bun run lint`, `bun run test`, `bun run build` en `ui-cognitive` y corregir fallas. (lint/build OK; `bun run test` con fallas preexistentes no relacionadas: workspace routes faltantes y expectativas de chat/model-registry en suite actual)
- [ ] 4.2 Ejecutar smoke test manual de `/ops` verificando: datos visibles, degradacion parcial, alertas exception-only y drill-down opcional.
- [x] 4.3 Actualizar documentacion operativa minima (`ui-cognitive/README.md` o docs relevantes) con nuevas rutas BFF `/api/ops/status` y `/api/ops/notes`.
