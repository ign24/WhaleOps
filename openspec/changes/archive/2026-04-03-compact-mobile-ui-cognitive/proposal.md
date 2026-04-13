## Why

La experiencia móvil en `ui-cognitive` tiene demasiado espacio vertical y controles sobredimensionados, lo que reduce el contenido visible en pantalla y aumenta el scroll innecesario. Este cambio prioriza densidad y legibilidad mobile-first sin alterar flujos funcionales.

## What Changes

- Reducir espacios verticales vacíos en el layout/chat móvil para mostrar más contenido útil por viewport.
- Compactar el header en móvil (alturas, paddings y jerarquía visual) manteniendo la misma información.
- Compactar la barra/botón de conversaciones y el drawer móvil para minimizar ocupación visual sin cambiar navegación.
- Ajustar cards y tipografía con reglas mobile-first para mejorar legibilidad y consistencia en pantallas pequeñas.
- Excluir explícitamente cambios funcionales, de datos, routing, estados, API o comportamiento de negocio.

## Capabilities

### New Capabilities
- `mobile-chat-density`: Define densidad visual mobile-first para chat/layout, header, controles de conversaciones y cards/tipografía en `ui-cognitive` sin cambios funcionales.

### Modified Capabilities
- (none)

## Impact

- Afecta únicamente UI en `ui-cognitive` (estilos y composición visual en breakpoints móviles).
- Sin impacto en backend, API, contratos de datos, telemetría o persistencia.
- Riesgo principal: regresiones visuales en breakpoints intermedios si no se valida responsividad.
