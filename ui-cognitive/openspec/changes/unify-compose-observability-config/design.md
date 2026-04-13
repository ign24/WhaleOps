## Context

Actualmente el dashboard consolida:

1) metricas de trazas desde archivo JSONL (`TRACES_PATH`)
2) metricas runtime desde endpoint NAT (`/monitor/users` via `NAT_BACKEND_URL`)

La implementacion usa fallbacks hardcodeados pensados para escenarios heterogeneos. En Compose (local y VPS), esto introduce ambiguedad:

- `127.0.0.1` dentro del contenedor no representa necesariamente el servicio NAT.
- rutas de trazas relativas o fallback `/app/traces` pueden ocultar mounts mal configurados.

## Goals / Non-Goals

**Goals:**
- Unificar comportamiento entre local y VPS con contrato Compose unico.
- Hacer explicita la causa de fallo cuando falta conectividad a NAT o acceso a trazas.
- Reducir configuracion implicita y debugging por prueba/error.

**Non-Goals:**
- Redisenar visualmente el dashboard.
- Cambiar el formato de trazas o su pipeline de generacion en NAT.
- Introducir proveedores externos de observabilidad en esta iteracion.

## Decisions

1. **Contrato unico para Compose**
   - En entornos Compose se define `NAT_BACKEND_URL=http://nat:8000` y `TRACES_PATH=/app/traces/agent_traces.jsonl`.
   - Se considera invalida una configuracion que dependa de `127.0.0.1` para conectar UI->NAT desde contenedor.

2. **Fail-fast de configuracion para observabilidad**
   - El endpoint de summary debe distinguir entre:
     - fallo de backend NAT,
     - trazas no disponibles,
     - ambas fuentes no disponibles.
   - El dashboard debe mostrar mensajes accionables, no solo “sin datos”.

3. **Minimizar heuristicas de path en observabilidad**
   - Priorizar `TRACES_PATH` y diagnosticar su ausencia/inaccesibilidad.
   - Mantener fallback solo si aporta compatibilidad intencional y documentada.

4. **Documentacion como parte del contrato**
   - README + `.env.example` + Compose deben reflejar exactamente la misma topologia.
   - Se elimina ambiguedad en ejemplos para que operacion sea copy/paste-safe.

## Risks / Trade-offs

- **Riesgo:** romper setups ad-hoc que dependian de fallbacks antiguos.
  **Mitigacion:** mensajes de migracion y docs claras para Compose.

- **Trade-off:** configuracion mas estricta reduce “magia” pero mejora predictibilidad.

- **Riesgo:** NAT y UI con nombres de servicio distintos en algunos despliegues.
  **Mitigacion:** documentar convencion de servicio `nat` o explicitar override controlado.
