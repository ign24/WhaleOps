## Why

En modo `execute`, hoy la regla de "consultar memoria/findings primero" vive en prompt, pero no está reforzada de forma determinística en runtime. Eso genera variabilidad: algunas ejecuciones arrancan sin contexto histórico aunque exista, y otras sí lo cargan.

## What Changes

- Agregar un preflight determinístico en `execute` que intente `query_findings` antes de ejecutar herramientas de modificación.
- Definir política de fallback: timeout corto, degradación segura si Milvus/Redis no responden, y continuidad sin bloqueo.
- Inyectar el resultado del preflight en el estado de ejecución para que el agente lo use como contexto explícito.
- Registrar telemetría/trace de preflight (hit/miss/degraded/skipped) para auditar comportamiento.
- Mantener `chat`/`analyze` sin preflight obligatorio para no aumentar latencia innecesaria.

## Capabilities

### New Capabilities
- `execute-memory-preload`: preflight de memoria/findings obligatorio y acotado en modo `execute` antes de tomar acciones de escritura.

### Modified Capabilities
- `findings-store`: se amplía el contrato de uso para soportar preconsulta determinística en `execute` con degradación controlada.

## Impact

- Código afectado: runtime del agente seguro por modo (`src/cognitive_code_agent/agents/**`), wiring de modo/ruteo si aplica, y configuración de presupuestos/timeout.
- Herramientas afectadas: `query_findings` (invocación preflight), memoria episódica como contexto complementario.
- Observabilidad: nuevos eventos de trace/log para el preflight.
- Tests: unitarios de política de preflight y de degradación; integración para verificar orden "preload -> ejecución" en modo `execute`.
