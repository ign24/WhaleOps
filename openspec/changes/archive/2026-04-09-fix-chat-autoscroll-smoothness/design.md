## Context

`ui-cognitive/components/chat/chat-panel.tsx` coordina el streaming de mensajes y el comportamiento de auto-scroll usando `useChatScroll` y un flag interno (`shouldStickToBottomRef`). Hoy existen dos fricciones: (1) múltiples rutas de scroll durante streaming usan `"auto"`, lo que elimina suavidad visual en el descenso; (2) cuando el usuario interrumpe el seguimiento y luego vuelve al final con el botón de scroll, la reactivación del “magnet” de auto-scroll no siempre queda explícita, por lo que el seguimiento puede no persistir ante nuevos chunks.

La corrección debe mantenerse en frontend (`ui-cognitive`) sin tocar API/chat route ni backend NAT.

## Goals / Non-Goals

**Goals:**
- Restaurar una experiencia de auto-scroll consistente durante streaming.
- Hacer explícita la reactivación del seguimiento al fondo cuando el usuario pulsa “ir al último mensaje”.
- Garantizar scroll suave por defecto y respetar fallback cuando la preferencia del usuario sea reducir movimiento.
- Cubrir el comportamiento con pruebas para evitar regresiones.

**Non-Goals:**
- Rediseñar el layout del chat o el panel de actividad.
- Cambiar contratos SSE, parsing de eventos o lógica de envío de mensajes.
- Introducir librerías nuevas de scroll/animación.

## Decisions

1. **Centralizar política de comportamiento de scroll en el cliente de chat**
   - Decisión: usar una política explícita para seleccionar `"smooth"` vs `"auto"` según contexto (interacción normal vs preferencia de `prefers-reduced-motion`).
   - Rationale: elimina comportamientos mezclados y facilita mantener UX consistente.
   - Alternativa considerada: mantener `"auto"` en streaming para evitar micro-animaciones. Se descarta porque sacrifica percepción de continuidad y no resuelve el reporte de UX.

2. **Forzar reactivación del “stick-to-bottom” en acción explícita del usuario**
   - Decisión: al usar el botón de bajar, actualizar el estado/ref de seguimiento para que próximos chunks continúen auto-scroll.
   - Rationale: la intención del usuario es inequívoca; el sistema debe persistir esa intención.
   - Alternativa considerada: depender solo de eventos `onScroll` para recalcular. Se descarta por ser más frágil ante timing y actualizaciones rápidas.

3. **Agregar pruebas de regresión en frontend**
   - Decisión: extender tests para validar (a) reactivación tras click en botón de bajar y (b) uso de comportamiento suave por defecto.
   - Rationale: el bug es de interacción/estado y requiere cobertura específica.

## Risks / Trade-offs

- **[Riesgo]** Suavizar el scroll en streaming puede aumentar sensación de “arrastre” en respuestas largas.
  → **Mitigación:** mantener fallback `auto` en reduce-motion y permitir ajustes finos si la cadencia de chunks lo requiere.

- **[Riesgo]** Cambios en refs/estado de scroll pueden introducir flakiness en tests de UI.
  → **Mitigación:** aislar aserciones en eventos clave (click y append de mensajes) y mockear refs de forma determinista.
