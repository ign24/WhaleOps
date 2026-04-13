## Context

`ui-cognitive/components/chat/chat-panel.tsx` mezcla hoy dos nociones de "streaming":
1) stream de red (SSE aun abierto), y 2) stream visual (el contenido ya recibido que todavia se renderiza con typewriter).

El auto-scroll y las clases visuales de estado se acoplan principalmente al estado de red (`isSending`), lo que provoca una ventana de desalineacion cuando la red termina antes que el render visual. En esa ventana el ultimo mensaje puede dejar de seguir el fondo y la barra luminosa puede desaparecer antes de tiempo o mostrarse de forma parcial para actividad multi-agente.

Restricciones clave:
- No romper el flujo de cancelacion via `AbortController` (boton detener).
- No hardcodear heuristicas fragiles por agente o por nombre de herramienta.
- Respetar intencion del usuario cuando hace scroll hacia arriba.

## Goals / Non-Goals

**Goals:**
- Introducir un estado derivado y determinista de "stream visual activo" que sobreviva al fin del stream de red hasta vaciar cola de render.
- Usar ese estado para mantener auto-scroll al ultimo mensaje durante toda la escritura visual, salvo que el usuario desenganche manualmente.
- Hacer consistente la visibilidad de la barra luminosa para todos los agentes que esten en estado activo/running mientras exista render visual pendiente.
- Cubrir con tests el caso borde "red finaliza antes que render" y su impacto en scroll, barra de estado y boton detener.

**Non-Goals:**
- Redisenar el layout del chat o del panel de actividad.
- Cambiar contratos de API backend/SSE.
- Introducir nuevas librerias de animacion/scroll.

## Decisions

1. **Separar estado de red y estado visual en el cliente**
   - Decision: calcular un flag de `visualStreamingActive` desde señales del typewriter (contenido recibido vs contenido mostrado, cola pendiente, y estado de drenado).
   - Rationale: desacopla UX del tiempo de red y evita falsos "fin" cuando aun hay texto en render.
   - Alternativa considerada: prolongar artificialmente `isSending` despues de cerrar SSE. Rechazada por mezclar semantica de red con render y romper cancelacion.

2. **Auto-scroll condicionado por intencion del usuario + visual streaming**
   - Decision: mantener "stick-to-bottom" solo si el usuario no se desplazo hacia arriba; usar `visualStreamingActive` como condicion de seguimiento continuo.
   - Rationale: preserva control del usuario y evita saltos de viewport no deseados.
   - Alternativa considerada: auto-scroll forzado siempre durante render visual. Rechazada por violar intencion de lectura historica.

3. **Barra luminosa basada en actividad activa por agente (no unicamente en herramienta activa)**
   - Decision: derivar estado visual desde entradas `ActivityEntry` en `running/pending` y aplicarlo de forma consistente a cada agente activo durante render visual.
   - Rationale: elimina huecos donde solo se destaca una herramienta y no el conjunto de agentes escribiendo.
   - Alternativa considerada: mantener una sola barra global por mensaje. Rechazada por perdida de granularidad en escenarios multi-agente.

4. **Mantener boton detener con semantica de red intacta**
   - Decision: `Stop` solo aborta red; el render visual finaliza de forma local con contenido ya bufferizado.
   - Rationale: evita truncados abruptos y preserva comportamiento actual de cancelacion.
   - Alternativa considerada: limpiar cola de render al detener. Rechazada por degradar legibilidad y aumentar percepcion de perdida de respuesta.

## Risks / Trade-offs

- [Riesgo] Mayor complejidad de estado (red vs visual) puede introducir condiciones de carrera en React. → Mitigacion: modelar transiciones explicitas y cubrirlas con tests unitarios en casos de fin de red y cancelacion.
- [Riesgo] Auto-scroll puede reengancharse indebidamente tras scroll manual. → Mitigacion: mantener bandera de "user detached" hasta accion explicita de volver al fondo.
- [Riesgo] Indicadores visuales mas persistentes pueden percibirse como ruido. → Mitigacion: limitar a agentes activos y apagar en cuanto `visualStreamingActive` finaliza.
- [Trade-off] Se anade computo derivado por frame/render para detectar cola pendiente. → Mitigacion: reutilizar estado del hook de typewriter sin timers adicionales.

## Migration Plan

1. Extender hook/typewriter y consumidores para exponer y leer `visualStreamingActive`.
2. Actualizar `ChatPanel` para usar `visualStreamingActive` en auto-scroll y clases de streaming.
3. Ajustar componentes de estado de actividad para visibilidad multi-agente consistente.
4. Agregar tests de desalineacion red/render y regresion del boton detener.
5. Validar `bun run test` y `bun run lint` en `ui-cognitive` antes de aplicar.

Rollback: revertir cambios de estado visual y volver a gating por `isSending` si aparece regresion critica de UX.

## Open Questions

- Si no hay entradas de actividad por agente, la barra luminosa debe caer a un indicador global por mensaje o permanecer oculta.
- El umbral exacto de "near-bottom" para reenganchar auto-scroll se mantiene como hoy o se ajusta para respuestas muy largas.
