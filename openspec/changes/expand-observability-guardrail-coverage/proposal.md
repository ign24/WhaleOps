## Why

La política non-terminating ya evita que el loop se corte, pero hoy el dashboard no explica con suficiente granularidad por qué una ejecución terminó parcial (por ejemplo `DEGRADED function cannot be invoked`). Necesitamos cobertura operativa completa para distinguir causa raíz de síntoma y ajustar budgets/retries con datos reales.

## What Changes

- Agregar métricas y agregaciones de observabilidad para fallbacks, budget exhaustion, retry outcomes y degradación de tools.
- Extender la taxonomía de errores del dashboard para separar `degraded_function`, `budget_exhausted`, `fallback_failed`, `retry_succeeded`, `retry_exhausted` y `provider_4xx/5xx`.
- Incorporar paneles/indicadores de presión de presupuesto (tool caps), ratio de partial finalize y salud de tools degradadas.
- Estandarizar trazas mínimas requeridas desde runtime para que el dashboard pueda reconstruir una línea causal por request.
- Añadir pruebas de agregación y render para los nuevos indicadores.

## Capabilities

### New Capabilities
- `observability-guardrail-coverage`: Cobertura de dashboard y agregador para fallback/guardrails con métricas accionables de causa raíz.

### Modified Capabilities
- `deterministic-fallback-policy`: Requiere eventos trazables y consistentes para cada activación de fallback y su resultado.
- `tool-loop-guard`: Requiere señalización observable de bloqueos y retorno a replan sin terminación.
- `structured-partial-response-contract`: Requiere clasificación de bloqueo consumible por observabilidad para diferenciar parcial por presupuesto vs parcial por degradación de tool.

## Impact

- Backend runtime: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` (normalización/eventos de fallback y guardrails).
- API/UI observabilidad: `ui-cognitive/lib/observability.ts`, `ui-cognitive/app/api/observability/summary/route.ts`, `ui-cognitive/components/observability/dashboard-view.tsx`.
- Tests: suites de agregación observability y tests de dashboard en `ui-cognitive/tests/*`.
