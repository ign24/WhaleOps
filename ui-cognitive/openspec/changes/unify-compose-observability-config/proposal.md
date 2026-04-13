## Why

El dashboard de observabilidad mezcla dos fuentes de datos (HTTP a NAT y lectura de trazas por archivo) con fallbacks hardcodeados orientados a entornos distintos (`127.0.0.1`, rutas relativas y `/app/traces`).

Aunque local y VPS usan Docker Compose, hoy la configuracion permite comportamientos divergentes y dificulta diagnosticar por que no llegan datos al dashboard.

Necesitamos un contrato unico de configuracion para Compose que haga el comportamiento identico en local y VPS, y que falle de forma explicita cuando la configuracion es invalida.

## What Changes

- Definir una topologia unica para Compose (local y VPS):
  - `NAT_BACKEND_URL=http://nat:8000`
  - `TRACES_PATH=/app/traces/agent_traces.jsonl`
- Endurecer resolucion de configuracion en observabilidad para priorizar contrato explicito sobre fallbacks ambiguos.
- Exponer errores de configuracion y diagnostico en `/api/observability/summary` para facilitar operacion.
- Actualizar documentacion y ejemplos de entorno/deploy para reflejar la topologia unica.

## Capabilities

### New Capabilities
- `compose-observability-config`: contrato unificado de configuracion de observabilidad para despliegues Docker Compose en local y VPS.

### Modified Capabilities
- `observability-dashboard`: cambiar comportamiento de carga para reportar de forma explicita errores de configuracion de backend y trazas.

## Impact

- Archivos de API y librerias de observabilidad (`app/api/observability/summary/route.ts`, `lib/observability.ts`).
- Superficie de UX del dashboard (`components/observability/dashboard-view.tsx`) para mensajes de error/diagnostico.
- Configuracion operativa (`docker-compose.yml`, `.env.example`, `README.md`).
- Menor riesgo de divergencia entre local y VPS y menor tiempo de troubleshooting.
