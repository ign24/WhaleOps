## Why

Al navegar entre chats en desktop, el panel de actividad ejecuta su animación de apertura en cada navegación (aunque ya estaba abierto) y aparece vacío aunque la sesión tenga historial de actividad. Ambos bugs degradan la experiencia: el panel "parpadea" y pierde contexto valioso que ya está persistido en el backend.

## What Changes

- Suprimir la animación espuria del panel de actividad en navegación entre sesiones
- Pre-poblar `workspaceLog` desde los `intermediateSteps` del historial al cargar una sesión existente
- Agregar prop `onHistoryLoaded` a `ChatPanel` para comunicar el historial de actividad al layout

## Capabilities

### New Capabilities

- `activity-panel-history-init`: Inicialización del workspace log desde el historial de la sesión al montar, usando los `intermediateSteps` persistidos en cada mensaje.

### Modified Capabilities

(ninguna — no cambian requisitos de specs existentes)

## Impact

- `components/chat/chat-session-layout.tsx`: agregar `initial={false}` a `AnimatePresence` desktop; agregar handler `handleHistoryLoaded`; pasar `onHistoryLoaded` a `ChatPanel`
- `components/chat/chat-panel.tsx`: agregar prop `onHistoryLoaded`; llamarlo después de `loadHistory()` con los intermediate steps agregados de todos los mensajes
