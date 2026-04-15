## 1. TDD frontend model catalog (RED)

- [x] 1.1 Actualizar `ui-cognitive/tests/model-registry.test.ts` para esperar el catálogo canónico de 4 modelos y nuevos alias.
- [x] 1.2 Actualizar `ui-cognitive/tests/model-selector.test.tsx` para opciones/vendors del nuevo catálogo y badges de apertura esperados.
- [x] 1.3 Actualizar `ui-cognitive/tests/cost-governance.test.ts` para fallback/modelos del nuevo catálogo.

## 2. TDD backend config contract (RED)

- [x] 2.1 Actualizar `tests/unit/test_config_prompts.py` para validar `llms` canónicos y `workflow.*.switchable_models`.

## 3. Implementación mínima (GREEN)

- [x] 3.1 Actualizar `ui-cognitive/lib/model-registry.ts` con 4 modelos canónicos, aliases legacy, vendor metadata y clasificación de apertura.
- [x] 3.2 Actualizar `ui-cognitive/lib/cost-governance.ts` (pricing/fallback) para claves canónicas.
- [x] 3.3 Ajustar `ui-cognitive/components/chat/model-selector.tsx` (labels/agrupación) para el nuevo catálogo.
- [x] 3.4 Actualizar `src/cognitive_code_agent/configs/config.yml` con `llms` canónicos y `switchable_models` en modos activos.

## 4. Refactor y validación

- [x] 4.1 Refactorizar duplicaciones menores en alias/copy sin cambiar comportamiento.
- [x] 4.2 Ejecutar tests focalizados: `bun run test -- model-registry model-selector cost-governance` y `uv run pytest tests/unit/test_config_prompts.py`.
- [x] 4.3 Actualizar documentación de catálogo efectivo en `ui-cognitive/README.md` y/o `README.md`.
