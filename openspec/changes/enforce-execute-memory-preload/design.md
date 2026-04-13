## Context

Actualmente `execute` declara en prompt que debe consultar `query_findings` antes de modificar código, pero ese paso no está reforzado por runtime. En la práctica, el cumplimiento depende del modelo y del contexto del turno, lo que introduce variabilidad. El sistema ya tiene memoria automática y `query_findings`, pero falta una política determinística de preflight para `execute`.

## Goals / Non-Goals

**Goals:**
- Garantizar que `execute` intente cargar contexto histórico antes de acciones de escritura.
- Limitar latencia con timeout y budget acotados.
- Degradar con seguridad: si memoria/findings no están disponibles, continuar sin bloquear ejecución.
- Dejar trazabilidad explícita (hit/miss/degraded/skipped) para auditoría operativa.

**Non-Goals:**
- No forzar preflight obligatorio en `chat` ni `analyze`.
- No rediseñar `query_findings` ni el esquema de Milvus.
- No cambiar el contrato de respuesta de herramientas de escritura existentes.

## Decisions

1. **Preflight determinístico solo para `execute`**
   - Se agrega un paso runtime antes del primer tool-call de escritura en modo `execute`.
   - Rationale: `execute` tiene mayor riesgo operativo y más valor de contexto histórico.
   - Alternativa descartada: enforcement global en todos los modos (aumenta latencia sin beneficio claro en chat).

2. **`query_findings` con timeout corto y fail-open**
   - El preflight usa timeout acotado (ej. 1-3s) y límite de resultados pequeño.
   - Ante timeout/error/circuit-open: estado `degraded` y continuidad del flujo.
   - Rationale: disponibilidad del agente > dependencia de memoria.

3. **Contexto preflight en estado estructurado**
   - El resultado se guarda en estado del grafo/agente con campos mínimos: `status`, `query`, `count`, `summary`.
   - Rationale: permite usar el contexto en prompt/decisión sin parseos frágiles.
   - Alternativa descartada: solo inyección textual en prompt (menos verificable en tests).

4. **Observabilidad explícita del preflight**
   - Emisión de logs/traces con resultado y motivo (`hit`, `miss`, `degraded`, `skipped`).
   - Rationale: facilita debugging de "por qué ejecutó sin memoria".

## Risks / Trade-offs

- **[Riesgo]** Incremento de latencia en `execute` → **Mitigación:** timeout bajo, budget fijo y una sola invocación por request.
- **[Riesgo]** Contexto irrelevante o ruidoso → **Mitigación:** query acotada y resumen compacto en estado.
- **[Riesgo]** Dependencia de disponibilidad Milvus/Redis → **Mitigación:** fail-open + circuit breaker existente + logging de degradación.
- **[Trade-off]** Más complejidad en runtime → **Mitigación:** aislar en helper de preflight con tests unitarios dedicados.

## Migration Plan

1. Implementar helper de preflight y wiring en `execute`.
2. Agregar tests unitarios de orden de ejecución y fallback.
3. Agregar test de integración de secuencia `preload -> tool execution`.
4. Activar telemetría de resultado de preflight.
5. Deploy incremental; rollback simple por feature flag/config toggle de enforcement.

## Open Questions

- ¿El query del preflight debe priorizar `repo_id` explícito extraído del input o usar búsqueda semántica amplia por defecto?
- ¿Conviene habilitar un toggle por config (`execute.enforce_memory_preload`) para rollout gradual?
- ¿El resultado preflight debe mostrarse al usuario en la respuesta final o quedar solo en telemetría interna?
