## 1. Runtime Baseline And Guardrails

- [ ] 1.1 Inventariar tools/rutas importadas en `register.py` y compararlas con `config.yml` por modo.
- [ ] 1.2 Implementar validador de alineacion runtime-config con modos `warn` y `strict` por feature flag.
- [ ] 1.3 Agregar logging estructurado y contadores de mismatch (`runtime.tool_binding.mismatch_total`).
- [ ] 1.4 Crear smoke test de arranque para `warn` (no aborta) y `strict` (aborta con mismatch).

## 2. Prompt-Tool Contract

- [ ] 2.1 Definir parser simple de referencias de tools en prompts por modo.
- [ ] 2.2 Alinear `ops.md` y `chat.md` a `tool_names` efectivos por modo.
- [ ] 2.3 Implementar unit tests de contrato prompt-tool por modo.
- [ ] 2.4 Agregar contract test CI que falle ante referencias stale en prompts.

## 3. Memory Config And Test Drift

- [ ] 3.1 Formalizar precedencia de memoria (dedicated > legacy > defaults) en un unico punto de carga.
- [ ] 3.2 Ajustar tests/fixtures para reflejar la precedencia real de runtime.
- [ ] 3.3 Agregar integration test que valide igualdad entre resolucion en runtime y resolucion en tests.

## 4. Legacy Lifecycle By Phases

- [ ] 4.1 Catalogar modulos legacy/dormidos y clasificar por riesgo de consumidor externo.
- [ ] 4.2 Introducir feature flags por modulo legacy para activar/desactivar sin rollback de codigo.
- [ ] 4.3 Emitir warnings de deprecacion y telemetria de uso por componente.
- [ ] 4.4 Definir criterio de avance de fase (observe -> deprecated -> disabled_by_default -> removed).
- [ ] 4.5 Agregar smoke tests por flag para verificar restauracion rapida de componentes legacy.

## 5. Workspace API Strategy

- [ ] 5.1 Decidir y documentar politica inicial de `workspace_api` (montar o deprecar) con flag explicito.
- [ ] 5.2 Implementar registro de rutas `workspace_api` controlado por flag y proteccion de doble montaje.
- [ ] 5.3 Agregar observabilidad (`workspace_api.requests_total`, errores 4xx/5xx, advertencias de deprecacion).
- [ ] 5.4 Crear contract tests para rutas de workspace en modo habilitado/deshabilitado.

## 6. Verification, Rollback, And Success Metrics

- [ ] 6.1 Ejecutar suite unit/integration/smoke/contract y consolidar baseline de estabilidad CI.
- [ ] 6.2 Medir y comparar startup overhead antes/despues del cambio.
- [ ] 6.3 Medir tasa de errores de tool-call antes/despues y validar objetivo de reduccion.
- [ ] 6.4 Documentar playbook de rollback por flags y condiciones de rollback de release.
