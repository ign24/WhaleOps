## Context

El panel de actividad en `ui-cognitive` ya está mayormente localizado al español, pero todavía existen etiquetas en inglés dentro de tarjetas específicas (por ejemplo, resumen de workspace). Esto genera inconsistencia en una interfaz orientada a usuarios en español.

## Goals / Non-Goals

**Goals:**
- Unificar a español el copy visible de las tarjetas del panel de actividad.
- Mantener la funcionalidad actual sin cambios de comportamiento.
- Ajustar pruebas de UI afectadas por texto visible.

**Non-Goals:**
- No rediseñar estilos, layout o jerarquía visual.
- No modificar contratos de datos (`ActivityEntry`, snapshots, API routes).
- No introducir sistema de i18n global en este cambio.

## Decisions

- **Traducción puntual en componentes existentes**: se actualizarán labels hardcodeados en componentes del panel de actividad.
  - *Alternativa considerada*: introducir diccionario global de i18n.
  - *Rationale*: el alcance pedido es acotado y de bajo riesgo; un sistema i18n completo excede el cambio.
- **Mantener términos técnicos claros en español**: usar copy consistente con el resto del panel (p. ej. “Espacio de trabajo”, “Duración”, “todavía”).
  - *Alternativa considerada*: conservar términos mixtos (Workspace, prompt) por familiaridad técnica.
  - *Rationale*: el requerimiento explícito es “todas en español”.

## Risks / Trade-offs

- **[Riesgo]** Tests frágiles por strings exactos → **Mitigación**: actualizar aserciones de texto en pruebas afectadas.
- **[Trade-off]** Cambios puntuales sin capa i18n central → **Mitigación**: mantener copy localizado en los componentes del panel y documentar alcance limitado.
