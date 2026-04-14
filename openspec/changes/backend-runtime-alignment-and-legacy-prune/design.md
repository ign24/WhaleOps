## Context

El estado actual mezcla registro dinamico de tools/rutas en `register.py`, configuracion declarativa en `config.yml` y prompts con supuestos que no siempre coinciden con el runtime efectivo. Tambien existen modulos legacy importados al arranque que no siempre son necesarios para los modos activos. Este cambio busca converger a un contrato unico y auditable sin ruptura de compatibilidad externa.

## Goals / Non-Goals

**Goals:**
- Definir una fuente de verdad para: tools registradas, tools por modo y prompts por modo.
- Reducir imports y side-effects de startup no necesarios para modos activos.
- Implementar deprecacion segura con flags y observacion antes de remocion definitiva.
- Resolver drift tests/config para que CI detecte desalineaciones reales de runtime.
- Establecer una estrategia explicita para `workspace_api` con rollback sencillo.

**Non-Goals:**
- Cambiar semantica funcional principal de chat/streaming fuera del alcance de alineacion.
- Eliminar en la primera iteracion componentes con posible consumidor externo.
- Introducir dependencias nuevas de alto impacto operacional.

## Decisions

1) Contrato de runtime verificable
- Decision: introducir validaciones de consistencia al arranque (registro vs config vs modos).
- Rationale: evita drift silencioso y errores de tool-call en produccion.
- Alternative considered: validacion solo en CI; descartado por no cubrir drift en despliegues manuales.

2) Alineacion prompts-tools por modo
- Decision: cada prompt de modo debe documentar y usar solo tools realmente disponibles en ese modo.
- Rationale: reduce decisiones erraticas del LLM y llamadas a tools inexistentes.
- Alternative considered: mantener prompts "superset"; descartado por incrementar errores y ambiguedad.

3) Legacy por fases con feature flags
- Decision: aplicar ciclo Observe -> Deprecate -> Disable by default -> Remove.
- Rationale: protege consumidores externos y permite rollback rapido.
- Alternative considered: remocion directa; descartado por riesgo de ruptura de contrato.

4) `workspace_api` con decision explicita
- Decision: implementar flag `WORKSPACE_API_ENABLED` (default conservador), telemetria de uso y anuncio de deprecacion si no se monta.
- Rationale: hoy existe drift entre existencia del modulo y rutas efectivamente montadas.
- Alternative considered: montarlo siempre; descartado hasta validar superficie de seguridad y consumidores reales.

## Migration Plan

Fase 0 - Baseline y observabilidad
- Instrumentar metricas: tiempo de startup, errores de binding de tools, llamadas a rutas legacy.
- Capturar baseline en CI y entorno de desarrollo.

Fase 1 - Alineacion sin ruptura
- Añadir validaciones de consistencia en startup y tests de contrato.
- Ajustar prompts para reflejar toolsets reales por modo.
- Corregir tests/config drift (memoria y precedencia de config efectiva).

Fase 2 - Deprecacion controlada
- Marcar modulos legacy como deprecated con logs estructurados y contador de uso.
- Introducir flags por componente legacy para apagar por entorno.
- Publicar ventana de observacion y criterio de corte.

Fase 3 - Endurecimiento
- Desactivar por defecto componentes legacy con uso cero/sustitucion confirmada.
- Ejecutar smoke/contract tests contra rutas y tools publicas.

Fase 4 - Remocion definitiva
- Remover solo componentes que cumplan criterio de deprecacion (uso cero sostenido + pruebas verdes).
- Documentar cambios en arquitectura/config y plan de rollback final.

## Compatibility Strategy

- Mantener contratos externos durante Fases 1-2.
- Cualquier endpoint/tool potencialmente externo entra primero en modo "deprecated" con señalizacion, no en remocion.
- Exponer flags para restaurar comportamiento previo sin redeploy de codigo.

## Observability

- Metricas minimas:
  - `startup.bootstrap.ms`
  - `runtime.tool_call.errors_total` (por tipo de error)
  - `runtime.tool_binding.mismatch_total`
  - `runtime.legacy_component.usage_total` (por modulo)
  - `workspace_api.requests_total` y `workspace_api.4xx_5xx_total`
- Logs estructurados para deprecacion y mismatch de runtime.

## Rollback

- Rollback rapido por flags:
  - Reactivar imports legacy deshabilitados.
  - Restaurar montaje de `workspace_api` segun flag.
  - Desactivar enforcement estricto de contrato manteniendo solo warning.
- Rollback de codigo por release anterior si:
  - Aumentan errores de tool-call > umbral acordado.
  - Se detecta ruptura de contrato en tests de smoke/contract o consumidores externos.

## Risks / Trade-offs

- [Riesgo] Validaciones estrictas pueden bloquear startup en ambientes incompletos -> Mitigacion: modo warning-only por flag durante fase inicial.
- [Riesgo] Falsos positivos en deteccion de "legacy no usado" -> Mitigacion: ventana de observacion + segmentacion por entorno.
- [Riesgo] Mayor complejidad temporal por flags -> Mitigacion: politica de expiracion y fecha objetivo de remocion.
- [Trade-off] Menos flexibilidad ad-hoc en prompts -> Beneficio: menor tasa de tool-calls invalidos.

## Open Questions

- Existe consumidor externo activo de `workspace_api` fuera del frontend principal?
- Que umbral exacto define "estabilidad CI" para aprobar paso de fase?
- Cuales modulos legacy se consideran candidatos prioritarios en esta iteracion?
