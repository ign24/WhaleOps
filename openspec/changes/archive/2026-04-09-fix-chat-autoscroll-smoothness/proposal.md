## Why

En `ui-cognitive` el auto-scroll del chat puede quedar desactivado después de interacciones manuales y, durante streaming, el desplazamiento hacia abajo ocurre en modo instantáneo (`auto`) en lugar de suave. Esto degrada la continuidad visual y obliga al usuario a corregir manualmente la posición del chat.

## What Changes

- Ajustar la lógica de auto-scroll en `ChatPanel` para que se reactive de forma explícita cuando el usuario solicita volver al final de la conversación.
- Unificar la política de scroll durante streaming para soportar desplazamiento suave en condiciones normales y fallback a desplazamiento instantáneo cuando corresponda (p. ej. reduce motion).
- Asegurar que el estado visual del botón “ir al último mensaje” se mantenga consistente con la posición real del contenedor.
- Agregar/actualizar pruebas unitarias del comportamiento de scroll para prevenir regresiones.

## Capabilities

### New Capabilities
- `chat-autoscroll-behavior`: Define reglas de activación, reactivación y suavidad del auto-scroll en el panel de chat durante streaming e interacción manual.

### Modified Capabilities
- (none)

## Impact

- Código afectado (frontend): `ui-cognitive/components/chat/chat-panel.tsx`, `ui-cognitive/hooks/use-chat-scroll.ts`.
- Tests frontend: `ui-cognitive/tests/chat-panel.test.tsx` y/o tests específicos del hook de scroll.
- Sin impacto en API/backend NAT, autenticación ni contrato de rutas.
