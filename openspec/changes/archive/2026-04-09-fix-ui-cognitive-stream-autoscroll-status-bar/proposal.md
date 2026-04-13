## Why

En `ui-cognitive` el auto-scroll del chat se corta cuando termina el stream de red aunque el render visual siga escribiendo (typewriter), lo que deja el ultimo mensaje fuera de foco durante la parte final de la respuesta. Ademas, la barra luminosa de estado no mantiene una visibilidad consistente para todos los agentes activos durante la escritura, generando señales ambiguas sobre que parte sigue en progreso.

## What Changes

- Sincronizar el auto-scroll con el estado de render visual del mensaje (no solo con el fin del stream de red) para mantener el seguimiento hasta que el contenido visible termine de escribirse.
- Mantener el respeto por la intencion del usuario: si hace scroll hacia arriba, desactivar el seguimiento automatico hasta que vuelva explicitamente al final.
- Hacer consistente la visibilidad de la barra luminosa de estado para todos los agentes en escritura durante la fase activa del render visual.
- Preservar el boton de detener para cortar el stream de red sin romper la finalizacion visual del contenido ya recibido.
- Agregar pruebas que cubran el desfase entre "fin de red" y "fin de render visual" para evitar regresiones de scroll y de estado de actividad.

## Capabilities

### New Capabilities
- `chat-visual-stream-sync`: Define el contrato entre streaming de red y streaming visual para auto-scroll, estado de escritura y finalizacion en UI.
- `multi-agent-streaming-status-bar`: Define reglas de visibilidad y persistencia de la barra luminosa para agentes activos mientras el render visual sigue en progreso.

### Modified Capabilities
- `typewriter-simulation`: Extiende requisitos para exponer senales de "render visual en progreso/finalizado" usadas por componentes de chat y actividad.
- `message-stream-animations`: Ajusta criterios para activar/desactivar estados visuales de streaming basados en fin de render visual (no solo bandera de red).

## Impact

- Frontend afectado: `ui-cognitive/components/chat/chat-panel.tsx`, `ui-cognitive/components/chat/inline-activity-summary.tsx`, `ui-cognitive/hooks/` relacionados con typewriter y scroll, y estilos en `ui-cognitive/app/globals.css`.
- Tests frontend: `ui-cognitive/tests/chat-panel.test.tsx` y nuevos/actualizados tests de sincronizacion stream red vs render visual.
- Sin cambios de API externa; cambio concentrado en estado cliente, animaciones y contratos internos de rendering.
