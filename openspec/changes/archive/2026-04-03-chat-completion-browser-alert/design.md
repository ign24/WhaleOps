## Context

La UI `ui-cognitive` consume respuestas del agente por SSE dentro de `components/chat/chat-panel.tsx`. Actualmente, al finalizar una ejecución, el estado interno vuelve a `isSending=false`, pero no existe una señal dedicada de “terminó” para usuarios que están en otra pestaña o ventana.

Restricciones relevantes:
- Cambios mínimos y locales (sin tocar backend, auth ni rutas sensibles).
- Mantener fallback seguro si browser APIs no están disponibles.
- No introducir dependencias nuevas para toast/notificaciones.

## Goals / Non-Goals

**Goals:**
- Emitir una señal visible local al finalizar una respuesta del agente.
- Enviar notificación del sistema cuando la pestaña no está visible y exista permiso.
- Añadir un indicador temporal en título de pestaña para recuperar atención.
- Preservar comportamiento actual del stream y manejo de errores.

**Non-Goals:**
- Rediseño del chat o del layout.
- Cambios en payload SSE o contrato del backend.
- Persistir notificaciones en servidor o historial.

## Decisions

### Decision 1: Detectar finalización en el bloque `finally` del flujo de envío
- **Choice:** disparar señal de fin cuando `sendMessageToAgent` termina y no fue cancelación explícita.
- **Why:** el `finally` ya centraliza cierre de stream (`setIsSending(false)`), por lo que reduce riesgo de estados inconsistentes.
- **Alternatives considered:**
  - Detectar por token `[DONE]` en stream: descartado, más frágil frente a variaciones de transporte.

### Decision 2: Toast inline liviano en `ChatPanel`
- **Choice:** renderizar un toast minimalista en la esquina superior con autohide (sin librerías externas).
- **Why:** cumple el objetivo visual “tipo Vercel” con impacto mínimo y sin dependencia adicional.
- **Alternatives considered:**
  - Integrar librería de toasts: descartado por alcance y costo de mantenimiento.

### Decision 3: Notificación de navegador + alerta en título como fallback de atención
- **Choice:** usar `Notification` API si hay permiso y la pestaña está oculta; además prefijar temporalmente `document.title` con un marcador textual de atención.
- **Why:** combinación robusta entre señal nativa del SO y pista visible al volver al navegador.
- **Alternatives considered:**
  - Modificar favicon dinámicamente: descartado para mantener cambios mínimos.

## Risks / Trade-offs

- **[Notificaciones bloqueadas por el usuario]** → Mitigación: degradar a toast local y título sin romper flujo.
- **[Ruido por notificaciones frecuentes]** → Mitigación: disparar solo una señal por ejecución completada.
- **[Diferencias entre navegadores en Notification API]** → Mitigación: guardas estrictas `typeof Notification !== "undefined"` y `document.visibilityState`.

## Migration Plan

1. Incorporar estado local para toast y utilidades de alerta de finalización en `chat-panel.tsx`.
2. Conectar trigger al cierre de `sendMessageToAgent`.
3. Agregar pruebas unitarias para presencia del toast y no-regresión del envío.
4. Ejecutar lint/tests de `ui-cognitive`.

Rollback: revertir cambios en `chat-panel.tsx` y tests; no requiere migración de datos.

## Open Questions

- ¿Conviene ofrecer un toggle de usuario para silenciar notificaciones en una iteración futura?
