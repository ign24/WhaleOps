## 1. Backend agent: workspace API read-only

- [x] 1.1 Crear módulo backend para roots permitidos + validación de paths + serialización de árbol (`sandbox/workspace`).
- [x] 1.2 Exponer `GET /workspace/roots` y `GET /workspace/tree?path=...` en FastAPI (registro en ciclo de configure/patch existente).
- [x] 1.3 Asegurar límites de seguridad (depth, node cap, skip dirs, timeout de `git status`) y códigos HTTP consistentes (400/403/404/500).

## 2. UI-cognitive: proxy BFF hacia backend

- [x] 2.1 Refactorizar `app/api/workspace/roots/route.ts` para consumir `${NAT_BACKEND_URL}/workspace/roots`.
- [x] 2.2 Refactorizar `app/api/workspace/tree/route.ts` para consumir `${NAT_BACKEND_URL}/workspace/tree?path=...`.
- [x] 2.3 Eliminar dependencia de lectura local con `fs` en UI y mantener contrato JSON actual para `FolderCard`.

## 3. Tests y documentación

- [x] 3.1 Agregar tests backend para validación de paths y shape de respuesta del endpoint workspace.
- [x] 3.2 Agregar/actualizar tests frontend de API routes (proxy success + upstream error) y de `FolderCard` sin regresiones.
- [x] 3.3 Actualizar `ui-cognitive/README.md` y/o docs operativas de EasyPanel indicando que la visibilidad de filesystem proviene del backend `agent`.
- [x] 3.4 Ejecutar validaciones: `uv run ruff check .`, `uv run pytest -x` (backend), `bun run lint`, `bun run test`, `bun run build` (ui-cognitive).
  - `bun run lint` mantiene warnings preexistentes sin errores bloqueantes.
