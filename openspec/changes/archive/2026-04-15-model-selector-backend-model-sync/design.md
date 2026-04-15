## Context

`ui-cognitive` permite elegir modelo por request y envía esa clave al backend (`/chat/stream`). El backend resuelve runtimes por `(mode, model, temperature)` y solo puede ejecutar modelos definidos en `config.yml` (sección `llms`) y habilitados por modo (`switchable_models`). Hoy existe desalineación entre el registro de UI y la configuración efectiva de backend, causando fallback y confusión operativa.

Además, el badge de apertura/licencia en UI debe representar clasificación efectiva para operación (no solo marketing del proveedor).

## Goals / Non-Goals

**Goals:**
- Definir un catálogo canónico de 4 modelos y hacerlo consistente entre selector UI y backend.
- Garantizar que toda selección válida en UI sea resoluble por backend sin fallback por runtime inexistente.
- Corregir metadatos de apertura/licencia para el catálogo activo.
- Aplicar TDD (RED → GREEN → REFACTOR) en cambios de registry/config/policy.

**Non-Goals:**
- Reescribir pipeline de chat o transporte SSE.
- Introducir nuevos endpoints de catálogo dinámico backend.
- Cambiar lógica de herramientas OPS o guardrails Tier 0.

## Decisions

### D1. Catálogo canónico compartido por clave interna
Se usarán claves internas estables en UI/backend:
- `qwen_3_5_122b_a10b`
- `qwen_3_5_397b_a17b`
- `nemotron_3_super_120b_a12b`
- `mistral_small_4_119b_2603`

**Rationale:** evita dependencia de nombres de proveedor para routing interno y simplifica aliases.

### D2. Backend declara y habilita explícitamente el catálogo
`config.yml` agregará entradas `llms.*` para los 4 modelos y `workflow.modes.ops/chat.switchable_models` con ese mismo set (o subconjunto explícito si se define política por modo).

**Alternativas consideradas:**
- Resolver modelo solo en frontend: rechazada (backend sigue necesitando llm keys válidas).
- Mantener un único modelo backend y mapear varios aliases: rechazada (falso sentido de selección).

### D3. Openness/licencia clasificada como metadata operativa
En UI, la clasificación se ajusta a la naturaleza de licencia efectiva en NIM (custom/open-model vs OSI) para evitar etiquetar erróneamente como `open-source`.

**Alternativas consideradas:**
- Mantener etiquetas previas por proveedor: rechazada por riesgo de compliance.

### D4. TDD por capas
Primero tests de registry/cost-governance y config contract; luego implementación mínima para verde; finalmente refactor de aliases/copy.

## Risks / Trade-offs

- [Regresión en sesiones con modelos viejos] → Mitigación: mantener aliases legacy en `resolveModelKey` hacia claves nuevas.
- [Cambios de licencia del proveedor] → Mitigación: centralizar clasificación en `model-registry` y tests explícitos.
- [Catálogo hardcoded en dos repositorios (UI/backend)] → Mitigación: tests de paridad y requirement de consistencia.

## Migration Plan

1. RED: escribir/ajustar tests frontend (`model-registry`, `model-selector`, `cost-governance`) y backend (`test_config_prompts`) para nuevo catálogo.
2. GREEN: actualizar `config.yml`, `model-registry.ts`, `cost-governance.ts` y textos de selector.
3. REFACTOR: limpiar aliases legacy mínimos y actualizar documentación de catálogo.
4. Validar `bun test` (tests tocados) y `uv run pytest` (tests de config).
5. Rollback: restaurar catálogo anterior en config y registry (cambio acotado a archivos de configuración/metadatos).

## Open Questions

- Si en `chat` debe permitirse el mismo set completo o un subconjunto barato por costo.
- Si se requiere exponer en UI una señal explícita de “no-OSI” además del badge de apertura.
