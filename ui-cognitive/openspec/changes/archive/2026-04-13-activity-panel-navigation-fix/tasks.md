## 1. Fix animación espuria del panel

- [x] 1.1 En `chat-session-layout.tsx`, agregar `initial={false}` al `<AnimatePresence>` del bloque desktop (el que envuelve `motion.div key="activity-desktop-shell"`)

## 2. Pre-poblar workspaceLog desde historial

- [x] 2.1 En `chat-panel.tsx`, agregar prop `onHistoryLoaded?: (entries: ActivityEntry[]) => void` al tipo `ChatPanelProps`
- [x] 2.2 En `chat-panel.tsx`, dentro del bloque `finally` de `loadHistory` (después de `setMessages(parseHistory(payload))`), agregar llamada a `onHistoryLoaded` con el flatMap de `normalizeHistoryActivityEntries` sobre los mensajes parseados
- [x] 2.3 En `chat-session-layout.tsx`, agregar handler `handleHistoryLoaded` que llama `setWorkspaceLog(entries)`
- [x] 2.4 En `chat-session-layout.tsx`, pasar `onHistoryLoaded={handleHistoryLoaded}` a `<ChatPanel>`
