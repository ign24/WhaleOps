## 1. Scroll behavior alignment in chat panel

- [x] 1.1 Ajustar `ui-cognitive/components/chat/chat-panel.tsx` para reactivar explícitamente el modo stick-to-bottom cuando el usuario pulsa el botón de bajar al último mensaje.
- [x] 1.2 Unificar llamadas de auto-scroll durante streaming para usar comportamiento suave por defecto y fallback adecuado cuando aplique reduce motion.

## 2. Hook consistency and UX state

- [x] 2.1 Revisar `ui-cognitive/hooks/use-chat-scroll.ts` para mantener consistente el estado del botón “ir al último mensaje” tras scroll programático y manual.
- [x] 2.2 Verificar que la detección near-bottom y el umbral no desactiven indebidamente la reanudación de auto-scroll durante respuestas largas.

## 3. Regression tests and local validation

- [x] 3.1 Agregar/actualizar tests en `ui-cognitive/tests/` para cubrir reactivación del auto-scroll y comportamiento smooth en descenso.
- [x] 3.2 Ejecutar `bun run lint`, `bun run test` y `bun run build` en `ui-cognitive` y corregir cualquier regresión.
