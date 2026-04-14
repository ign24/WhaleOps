## Why

El backend tiene drift entre `register.py`, `config.yml`, prompts y rutas montadas, lo que genera carga de startup innecesaria, herramientas declaradas pero no siempre disponibles por modo, y riesgo de regresiones silenciosas en tests/config. Corregir esta desalineacion ahora reduce errores operativos y prepara una limpieza segura de legado sin romper consumidores externos.

## What Changes

- Definir y aplicar un contrato de runtime unico entre registro de tools, modos y configuracion efectiva.
- Alinear prompts por modo con el conjunto real de tools habilitadas por `tool_names`.
- Corregir drift de tests/config (incluyendo precedencia de memoria y validacion de configuracion cargada en runtime).
- Introducir un plan de deprecacion por fases para modulos legacy/dormidos con flags y observacion previa.
- Definir estrategia para `workspace_api`: montaje explicito con guardrails o deprecacion explicita con compatibilidad temporal.
- Agregar observabilidad de arranque y de ejecucion de tools para medir impacto y habilitar rollback rapido.

## Non-Goals

- No rediseñar la arquitectura de modes ni reemplazar NAT/LangGraph.
- No eliminar de forma inmediata endpoints/tools que puedan tener consumidores externos.
- No cambiar contratos publicos de streaming/chat fuera de lo necesario para alineacion.

## Capabilities

### New Capabilities
- `runtime-config-alignment`: contrato verificable entre `register.py`, `config.yml`, modos y rutas montadas.
- `prompt-tool-contract`: prompts por modo consistentes con tools realmente disponibles y politicas de fallback.
- `legacy-module-lifecycle`: deprecacion por fases de modulos legacy con feature flags, telemetria y criterio de remocion.
- `workspace-api-lifecycle`: decision segura para `workspace_api` (montaje correcto o deprecacion explicita) con ventana de observacion.

### Modified Capabilities
- (none)

## Scope

- Backend Python en `src/cognitive_code_agent/` (registro, configuracion, prompts, rutas FastAPI, carga de tools).
- Tests y fixtures de configuracion en `tests/` y `src/cognitive_code_agent/configs/`.
- Telemetria/logging para metricas de startup, tool-calls y uso de rutas legacy.

## Risks

- Riesgo de deshabilitar accidentalmente tools usadas por flujos reales.
- Riesgo de cambiar semantica de modos por inconsistencias historicas en prompts.
- Riesgo de impacto en consumers externos si se depreca `workspace_api` sin observacion.

## Impact

- Afecta `register.py`, `configs/config.yml`, prompts de sistema y modulo(s) de rutas opcionales.
- Introduce flags de compatibilidad y metricas de salud de runtime/CI.
- Exige cobertura de pruebas unit/integration/smoke/contract para evitar regresiones.

## Success Metrics

- Reducir >= 40% errores de tool-call por nombre no disponible o timeout de binding (medido en logs/traces).
- Reducir >= 20% overhead de startup (tiempo de bootstrap y/o modulos importados al inicio).
- Mantener estabilidad CI >= 95% en pipelines de backend durante la migracion.
- Cero incidentes de ruptura de contrato en APIs publicas durante la fase de observacion.
