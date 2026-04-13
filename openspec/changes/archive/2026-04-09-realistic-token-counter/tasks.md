# Tasks: realistic-token-counter

## 1. Contrato de uso de tokens en backend/BFF

- [x] 1.1 Extender el payload de uso final para incluir bandera de precisión (`is_estimated`) junto con `prompt_tokens`, `completion_tokens`, `total_tokens`.
- [x] 1.2 Emitir un evento SSE dedicado (`event: usage`) en `ui-cognitive/app/api/chat/route.ts` antes de `[DONE]` cuando exista uso final.
- [x] 1.3 Mantener compatibilidad del stream actual de contenido (`data: choices[].delta.content`) y de eventos `metadata/activity/error`.

## 2. Parser y tipos en ui-cognitive

- [x] 2.1 Agregar tipos de token usage en `ui-cognitive/types/chat.ts` (conteos + precisión).
- [x] 2.2 Implementar parser de `event: usage` en `ui-cognitive/lib/sse-parser.ts`.
- [x] 2.3 Incorporar soporte de usage en el flujo de lectura de stream de `chat-panel.tsx` sin romper parsing de tokens, actividad o errores.

## 3. UX de contador realista

- [x] 3.1 Mostrar contador estimado durante escritura del usuario (marcado visual explícito de estimación).
- [x] 3.2 Mostrar contador provisional para salida/total durante streaming cuando aún no llegó usage final.
- [x] 3.3 Reconciliar estimado→real al recibir usage final y reflejarlo en la UI del chat.
- [x] 3.4 Extender `SessionMetaBar` para mostrar tokens de sesión y estado de precisión cuando haya datos.

## 4. Fallback y consistencia de precisión

- [x] 4.1 Asegurar que cuando el backend use fallback de conteo, el contrato marque explícitamente `is_estimated=true`.
- [x] 4.2 Verificar que nunca se renderice un valor estimado como si fuera real (sin prefijo/etiqueta de precisión).

## 5. Tests y validación

- [x] 5.1 Agregar/actualizar tests de `api-chat-route` para validar emisión de `event: usage` y `isEstimated`.
- [x] 5.2 Agregar tests de parser SSE para `event: usage` (casos válidos, faltantes, inválidos).
- [x] 5.3 Agregar tests de UI/chat para reconciliación estimado→real y fallback estimado.
- [x] 5.4 Ejecutar validación local en `ui-cognitive`: `bun run lint`, `bun run test`, `bun run build`.
