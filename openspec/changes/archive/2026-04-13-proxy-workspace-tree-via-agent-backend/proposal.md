## Why

La tarjeta de filesystem (`workspace` + `sandbox`) hoy lee el disco local del servicio `ui-cognitive` vía `/api/workspace/tree`. En producción (EasyPanel), ese contenedor suele no montar `/tmp/analysis` ni `/app/workspace`, por lo que la UI muestra falsos negativos: "No accesible desde este entorno" aunque los datos sí existan en el contenedor `agent`.

Esto rompe la promesa de visibilidad operativa del panel de actividad y obliga a depender de mounts cruzados frágiles entre servicios.

## What Changes

- Mover la fuente de verdad del árbol de archivos al backend `agent` (donde realmente viven `sandbox/workspace`).
- Exponer endpoints backend read-only para roots y tree con validación estricta de paths permitidos.
- Convertir los endpoints de `ui-cognitive` (`/api/workspace/roots`, `/api/workspace/tree`) en proxy autenticado hacia `NAT_BACKEND_URL`.
- Mantener fallback visual claro cuando el backend no esté disponible, sin asumir que el filesystem del UI refleja el runtime real.

## Capabilities

### New Capabilities
- `agent-workspace-tree-api`: el backend NAT expone un contrato HTTP read-only para inspección de `sandbox/workspace`.

### Modified Capabilities
- `workspace-folder-card`: la card deja de depender del filesystem local del UI y pasa a consumir datos desde el backend `agent` mediante proxy.

## Impact

- Backend Python (`src/cognitive_code_agent/*`): registro de rutas FastAPI y utilidades de árbol de archivos.
- Frontend BFF (`ui-cognitive/app/api/workspace/*`): proxy hacia NAT backend.
- Tests backend + frontend para validación de paths, errores upstream y render esperado de la card.
- Documentación operativa (EasyPanel) para aclarar que la visibilidad de filesystem depende del `agent`, no de mounts en `ui`.
