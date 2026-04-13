## Why

El catálogo de modelos quedó desalineado entre backend (`config.yml`), frontend (`MODEL_REGISTRY`) y documentación operativa. En particular, `gemma_4_31b_it` (vision) y otros modelos switchables dejaron de aparecer en UI, rompiendo expectativas de producto y specs activos de multimodalidad.

## What Changes

- Re-sincronizar `ui-cognitive/lib/model-registry.ts` con el set de modelos switchables del runtime.
- Restaurar aliases/vendor/cost metadata para los modelos faltantes.
- Actualizar documentación técnica y operativa para reflejar el catálogo real de modelos.
- Reforzar tests de registry para detectar regresiones de paridad.

## Impact

- Frontend model selector vuelve a exponer `gemma_4_31b_it` y demás modelos switchables.
- Guardrails de costo y aliases vuelven a cubrir los modelos restaurados.
- Docs quedan alineadas con backend y operación en producción.
