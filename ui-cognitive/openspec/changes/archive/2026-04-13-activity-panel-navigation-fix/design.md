## Context

`ChatSessionLayout` se remonta completamente en cada navegación entre chats (Next.js crea una nueva instancia por ruta). Esto tiene dos consecuencias:

1. `AnimatePresence` remonta fresco → el hijo `motion.div key="activity-desktop-shell"` ejecuta su transición `initial → animate` (width 0→380) aunque el panel ya estaba abierto.
2. `activityLog` y `workspaceLog` son React state que empiezan vacíos → el workspace del panel aparece sin datos aunque el backend tiene los `intermediateSteps` de cada mensaje.

`isActivityOpen` sobrevive la navegación vía localStorage (correcto). Los datos de actividad están en `messages[].intermediateSteps`, serializados cuando finaliza cada stream (`activityLogRef.current` → `setMessages` con `intermediateSteps`). `normalizeHistoryActivityEntries()` en `chat-panel.tsx` ya sabe parsearlos.

## Goals / Non-Goals

**Goals:**
- Eliminar la animación de entrada del panel en navegación entre sesiones
- Pre-poblar `workspaceLog` desde `intermediateSteps` del historial al montar
- Preservar la animación explícita de apertura del panel

**Non-Goals:**
- Persistir `activityLog` (feed del exchange actual) — debe seguir siendo efímero
- Cargar actividad histórica en la `ActivityTimeline` en live mode
- Cambiar la arquitectura de persistencia del backend

## Decisions

### D1: `initial={false}` en `AnimatePresence` desktop

`AnimatePresence initial={false}` suprime la animación de entrada de los hijos que ya están presentes en el primer render de la instancia de AnimatePresence. Hijos añadidos después (cuando el usuario abre explícitamente el panel) sí animan.

**Alternativa descartada**: no usar AnimatePresence / usar `motion.div` con `layout`. Rompería las animaciones de cierre (exit), que sí son correctas.

### D2: Callback `onHistoryLoaded` en `ChatPanel`

Después de que `loadHistory()` resuelve y llama `setMessages(parseHistory(payload))`, se agrega:

```ts
const allSteps = parsed.flatMap(m => normalizeHistoryActivityEntries(m.intermediateSteps));
if (allSteps.length > 0) onHistoryLoaded(allSteps);
```

En `ChatSessionLayout`, `handleHistoryLoaded` llama `setWorkspaceLog(entries)` directamente, sin pasar por `handleActivityEvent` (que tocaría `activityLog`).

**Alternativa descartada**: reusar `onActivityEvent` con un payload especial. Rompería la semántica del callback y complica el handler.

### D3: `workspaceLog` se inicializa completo, no se merge

En el mount inicial `workspaceLog = []`, así que `setWorkspaceLog(entries)` es equivalente a `mergeWorkspaceEntries([], entries)`. No hay riesgo de duplicados. Cuando después llega streaming, `handleActivityEvent` ya usa `mergeWorkspaceEntries` para acumular encima.

## Risks / Trade-offs

- **Riesgo**: `normalizeHistoryActivityEntries` puede devolver arrays vacíos si los steps no tienen el formato esperado → Mitigación: el guard `if (allSteps.length > 0)` evita llamadas innecesarias; el workspace simplemente queda vacío, mismo comportamiento que hoy.
- **Trade-off**: El `ActivityTimeline` en live mode sigue mostrando "Sin actividad todavía" al cargar una sesión histórica. Es correcto conceptualmente (timeline = exchange actual), pero podría sorprender. Se acepta por ahora.
