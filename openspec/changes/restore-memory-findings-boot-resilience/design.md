## Context

El arranque del servicio NAT falla durante el registro de tools porque `findings_store` resuelve imports hacia `cognitive_code_agent.memory`, paquete ausente en este fork. La falla ocurre en startup (no en runtime tardío), por lo que el proceso completo cae aunque findings/memory sean capacidades opcionales. El sistema ya tiene patrones de degradación en memoria, pero no cubre de forma consistente el caso de módulo faltante en la ruta de registro de tools.

## Goals / Non-Goals

**Goals:**
- Garantizar que el servicio pueda arrancar incluso si la capa `memory` no está disponible.
- Mantener `persist_findings` y `query_findings` registradas de forma robusta, con comportamiento determinístico cuando el backend no existe.
- Preservar compatibilidad con implementaciones donde `src/cognitive_code_agent/memory` sí está presente (portado o upstream).
- Cubrir el arranque y degradación con pruebas automáticas de regresión.

**Non-Goals:**
- Rediseñar la arquitectura completa de memoria L0/L1/L2.
- Cambiar contratos funcionales no relacionados de tools fuera de findings.
- Introducir dependencias nuevas de infraestructura (Milvus/Redis) para resolver este bug de boot.

## Decisions

### 1) Adaptador de memoria con import seguro en startup
Se introduce un adaptador interno para resolver proveedores de findings/memory con `try/except ImportError` y detección explícita de disponibilidad.

- **Rationale:** evita acoplar el boot a un módulo opcional y permite fallback limpio.
- **Alternative considered:** portar inmediatamente todo `src/cognitive_code_agent/memory` desde upstream. Se descarta como única vía porque aumenta alcance y riesgo de drift; se mantiene como opción compatible, no obligatoria.

### 2) Registro de tools siempre exitoso con capacidades degradadas
`persist_findings`/`query_findings` se registran aun cuando memory no esté disponible; en estado degradado devuelven respuesta estructurada (`status=degraded`, `reason=memory_unavailable`) y no lanzan excepción fatal.

- **Rationale:** el runtime y los prompts pueden tomar decisiones sobre degradación sin tumbar el servicio.
- **Alternative considered:** no registrar tools si no hay memory. Se descarta porque rompe contratos de configuración y genera errores de tool missing en agentes existentes.

### 3) Readiness unificado para backend + módulo
La evaluación de readiness se extiende para distinguir: `ready`, `backend_unavailable`, `module_missing`, `timeout`. Esta señal se expone a logs/telemetría y a respuestas de tool.

- **Rationale:** diagnósticos más accionables y decisiones determinísticas de fallback.
- **Alternative considered:** mapear todo a un único estado `degraded`. Se descarta por pérdida de observabilidad operativa.

### 4) Config segura por defecto para startup resiliente
Se ajusta `config.yml` para que findings/memory tengan defaults que no fuercen fallo en boot (flags explícitos + timeouts acotados), manteniendo compatibilidad con entornos fully-enabled.

- **Rationale:** el comportamiento resiliente debe ser configuración-first y no depender solo de manejo de excepciones.

## Risks / Trade-offs

- [Ocultar errores reales bajo degradación] -> Mitigación: logging estructurado con código de causa (`module_missing`, `backend_unavailable`) y tests que validan cada ruta.
- [Desalineación con upstream al portar memory luego] -> Mitigación: encapsular integración en un adaptador con interfaz estable y pruebas de contrato.
- [Respuesta degradada no consumida por capas superiores] -> Mitigación: formato de respuesta estable y cobertura en tests de arranque + invocación.
- [Complejidad extra en registration path] -> Mitigación: centralizar lógica de disponibilidad en una sola utilidad reutilizable.

## Migration Plan

1. Implementar adaptador de memoria/import seguro y actualizar wiring de `findings_store`.
2. Ajustar configuración para defaults resilientes sin romper despliegues actuales.
3. Agregar tests unitarios e integración de arranque con memory presente/ausente.
4. Validar que `uv run pytest -x -m "not e2e"` cubre el caso reportado.
5. Rollback: revertir cambio de wiring/config y volver al comportamiento previo (fallo en boot) solo si aparece regresión crítica no mitigable.

## Open Questions

- ¿Se porta en este cambio una versión mínima de `src/cognitive_code_agent/memory` o se deja solo el adaptador desacoplado? (el diseño soporta ambos caminos)
- ¿Qué campos exactos del payload degradado requieren las capas consumidoras para observabilidad/UI?
