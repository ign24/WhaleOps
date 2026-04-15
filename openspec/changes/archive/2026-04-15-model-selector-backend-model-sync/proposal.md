## Why

El selector de modelos en `ui-cognitive` no está alineado con el catálogo realmente disponible en backend y hoy mezcla metadatos/licencias inconsistentes. Esto degrada la selección operativa (el usuario elige modelos no configurados) y genera riesgo de compliance al etiquetar apertura/licencia de forma inexacta.

## What Changes

- Reducir y normalizar el catálogo activo a 4 modelos operables para OPS: `qwen3.5-122b`, `qwen3.5-397b`, `nemotron-3-super-120b`, `mistral-small-4-119b`.
- Conectar UI y backend con claves canónicas compartidas para que el modelo elegido en selector sea resoluble en runtime sin fallback silencioso por clave inexistente.
- Actualizar `src/cognitive_code_agent/configs/config.yml` para declarar estos modelos en `llms` y habilitarlos en `workflow.modes.*.switchable_models`.
- Corregir clasificación de apertura/licencia en el registro frontend para evitar marcar como `open-source` entradas que no califican como OSI en el contexto de despliegue NIM.
- Ajustar costos/fallbacks y alias de proveedor para el nuevo catálogo.

## Capabilities

### New Capabilities
- `backend-switchable-model-catalog`: catálogo backend explícito y seleccionable por modo con 4 modelos canónicos.

### Modified Capabilities
- `model-catalog-consistency`: cambiar requisitos de paridad UI/backend al nuevo catálogo de 4 modelos canónicos.
- `model-openness-badges`: ajustar requisitos para que badge y metadatos reflejen clasificación de apertura/licencia efectiva del catálogo activo.

## Impact

- **Frontend (`ui-cognitive`)**: `lib/model-registry.ts`, `lib/cost-governance.ts`, `components/chat/model-selector.tsx` y tests asociados de registry/selector/costos.
- **Backend (`src/cognitive_code_agent`)**: `configs/config.yml` (LLMs + `switchable_models`).
- **Contrato runtime**: la clave enviada por `/api/chat` debe mapear a un LLM existente en backend para evitar fallback por runtime inexistente.
- **QA/TDD**: nuevos/actualizados tests unitarios en frontend y backend para validar catálogo, alias, policy y configuración.
