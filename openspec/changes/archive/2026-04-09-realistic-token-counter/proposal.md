## Why

Hoy el sistema mezcla conteo real y estimado de tokens de forma poco transparente: el backend puede emitir uso real al final, pero también cae a una estimación por palabras cuando falta metadata, y la UI no distingue claramente entre valores exactos y aproximados. Esto vuelve difícil confiar en costos y límites de contexto durante una conversación.

## What Changes

- Definir un contrato de conteo de tokens “realista” para chat: estimado durante escritura/streaming, real al final cuando exista `usage` del backend.
- Extender el flujo SSE/BFF para exponer métricas de uso de tokens (`prompt_tokens`, `completion_tokens`, `total_tokens`) hacia `ui-cognitive` en un evento explícito.
- Agregar visualización de contador en la UI con estado de precisión (`estimado` vs `real`) para evitar presentar aproximaciones como exactas.
- Estandarizar comportamiento de fallback cuando el backend no reciba metadata real del modelo (mantener estimación, pero marcada como estimada).

## Capabilities

### New Capabilities
- `realistic-token-counter`: Contrato y UX de conteo de tokens con reconciliación estimado→real en el chat.

### Modified Capabilities
- `session-meta-bar`: Extender el metabar para poder reflejar métricas de tokens de la sesión cuando estén disponibles, manteniendo compatibilidad con el resumen actual.

## Impact

**Backend (Python):**
- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` (emisión y fallback de `usage`)

**BFF/UI (Next.js + TS):**
- `ui-cognitive/app/api/chat/route.ts` (SSE hacia cliente)
- `ui-cognitive/lib/nat-client.ts` y `ui-cognitive/lib/sse-parser.ts` (parseo/forward de eventos)
- `ui-cognitive/components/chat/chat-panel.tsx` (render y estado del contador)
- `ui-cognitive/components/chat/session-meta-bar.tsx` + tipos en `ui-cognitive/types/chat.ts`

**Tests:**
- `ui-cognitive/tests/api-chat-route.test.ts` y tests de parser/chat para validar evento de usage y etiquetado real/estimado.

Sin cambios breaking en API pública externa; el cambio se concentra en contrato interno de streaming y presentación de métricas.
