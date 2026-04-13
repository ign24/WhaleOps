## Context

La UI de observabilidad ya calcula volumen, latencia, costo, top tools y top errores, pero la taxonomía actual es demasiado genérica para operar un runtime con guardrails non-terminating. En incidentes reales (ej. `DEGRADED function cannot be invoked`) el sistema entrega partial output correctamente, pero el dashboard no distingue si la causa raíz fue degradación de tool, límite de presupuesto, fallback fallido, o retry agotado.

## Goals / Non-Goals

**Goals:**
- Exponer causa raíz operativa de ejecuciones parciales/fallbacks sin depender de inspección manual de logs.
- Cubrir métricas críticas de guardrails: budget pressure, degraded tools, retry outcomes, fallback failures.
- Mantener contrato estable entre runtime traces y agregador UI para evitar drift de parseo.
- Agregar cobertura de tests para agregación y render de nuevos indicadores.

**Non-Goals:**
- Rediseñar visual completo del dashboard.
- Cambiar semántica principal de políticas de fallback/guardrails.
- Implementar storage externo nuevo de observabilidad (solo se usa traza actual + endpoint summary).

## Decisions

### 1) Taxonomía explícita de incidentes operativos
Se definirá una clasificación determinista adicional en agregador/UI para: `degraded_function`, `budget_exhausted`, `retry_succeeded`, `retry_exhausted`, `fallback_failed`, `provider_4xx`, `provider_5xx`.

**Alternativas consideradas:**
- Mantener `tool_failure/other`: rechazado por baja acción operativa.
- Parsear texto libre en frontend solamente: rechazado; debe centralizarse en agregador para consistencia.

### 2) Contrato mínimo de eventos runtime para observabilidad
Los eventos de fallback/guardrail deberán incluir campos normalizados (`reason`, `action`, `mode`, `tool` cuando aplique, `failure_source` cuando aplique), para que `computeTraceStats` no dependa de heurísticas frágiles.

**Alternativas consideradas:**
- Inferir todo desde mensajes de error de proveedor: rechazado por inestabilidad y ruido.

### 3) Métricas nuevas enfocadas en decisión operativa
Se agregan métricas resumidas consumidas por dashboard:
- fallback activations por clase
- ratio de partial finalize
- top blocked tools por presupuesto/loop/degraded
- retry success ratio
- degraded tools observed (conteo y últimas ocurrencias)

**Alternativas consideradas:**
- Agregar sólo tablas raw: rechazado por baja usabilidad.

### 4) Dashboard incremental, no disruptivo
Se añaden tarjetas y listas nuevas sobre el layout existente para minimizar riesgo visual y de regresión.

**Alternativas consideradas:**
- Nueva página separada de incidentes: rechazado por overhead y duplicación.

## Risks / Trade-offs

- **[Risk] Drift entre trazas reales y parser** → Mitigación: tests con fixtures de eventos reales + warning de paridad existente.
- **[Risk] Sobrecarga visual del dashboard** → Mitigación: priorizar 4-6 KPIs accionables y colapsar secundarios.
- **[Risk] Campos de evento faltantes en versiones viejas** → Mitigación: fallback heurístico backward-compatible y diagnóstico explícito de cobertura.
- **[Risk] Falsos positivos en clasificación provider/degraded** → Mitigación: reglas por precedencia y pruebas unitarias por categoría.

## Migration Plan

1. Extender runtime events y/o normalización para campos mínimos de observabilidad.
2. Extender `computeTraceStats` con nueva taxonomía y métricas derivadas.
3. Exponer nuevos campos en `GET /api/observability/summary`.
4. Renderizar métricas nuevas en dashboard con warnings accionables.
5. Agregar tests de parser + dashboard rendering para casos `DEGRADED`, budget exhaustion y retry.
6. Rollback: revertir cambios en agregador/dashboard manteniendo contrato previo si aparece regresión en producción.

## Open Questions

- ¿Queremos mostrar series temporales básicas (últimos N minutos) o sólo snapshot agregado por request?
- ¿Debe existir un umbral visual para alertar automáticamente cuando `partial finalize rate` supera X%?
- ¿Incluimos por ahora solo top degraded tools o también duración estimada degraded→healthy?
