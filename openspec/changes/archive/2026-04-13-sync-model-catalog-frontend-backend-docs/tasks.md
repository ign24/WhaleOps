## 1. Frontend model registry sync

- [x] 1.1 Restaurar modelos switchables faltantes en `ui-cognitive/lib/model-registry.ts`.
- [x] 1.2 Restaurar aliases/provider mapping/vendor metadata para modelos faltantes.
- [x] 1.3 Restaurar metadata de costo para modelos faltantes en `ui-cognitive/lib/cost-governance.ts`.

## 2. Tests de paridad

- [x] 2.1 Actualizar `ui-cognitive/tests/model-registry.test.ts` para cubrir presencia de `gemma_4_31b_it` y modelos switchables clave.
- [x] 2.2 Ejecutar suite de tests/lint/build de `ui-cognitive`.
  - `bun run lint` sin errores (warnings preexistentes)
  - `bun run test tests/model-registry.test.ts tests/model-selector.test.tsx tests/api-chat-route.test.ts tests/cost-governance.test.ts` OK
  - `bun run build` OK

## 3. Documentación operativa

- [x] 3.1 Actualizar `README.md` (root) con catálogo completo de modelos backend.
- [x] 3.2 Actualizar `ui-cognitive/README.md` con listado de modelos visibles y nota de variante thinking.
