## Why

Cuando el agente termina una respuesta larga, el usuario muchas veces ya está en otra pestaña o aplicación y no se entera inmediatamente. Falta una señal clara, discreta y local en el navegador para recuperar atención sin tocar backend ni flujos sensibles.

## What Changes

- Agregar una notificación visual tipo toast (estilo minimalista) al finalizar una ejecución del agente.
- Emitir una notificación del navegador (Web Notifications API) cuando la pestaña no está visible y el usuario otorgó permiso.
- Activar un indicador de atención en la pestaña (cambio temporal de `document.title`) para simular “manito levantada” sin introducir dependencias nuevas ni cambios sensibles.
- Limitar la implementación a `ui-cognitive` (cliente chat) y mantener fallback silencioso cuando el navegador no soporta permisos o notificaciones.

## Capabilities

### New Capabilities
- `chat-completion-notifications`: Señaliza fin de ejecución del agente con toast local, notificación del navegador y badge/alerta temporal en la pestaña.

### Modified Capabilities
- Ninguna.

## Impact

- Frontend `ui-cognitive`: `components/chat/chat-panel.tsx` y tests de `ui-cognitive/tests/chat-panel.test.tsx`.
- Sin cambios en API, auth, persistencia, ni contrato NAT SSE.
- Sin nuevas dependencias externas; solo APIs nativas del navegador.
