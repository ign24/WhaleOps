## Context

`ui-cognitive` ya tiene una base visual consistente (neumorphic tokens, tooltip reusable, estado persistido para algunos toggles), pero la personalización de layout está limitada y las affordances de interacción son irregulares entre sidebar, lista de sesiones y controles de panel. El objetivo es mejorar UX sin tocar superficies sensibles (auth, rutas API, seguridad, backend NAT).

Restricciones relevantes:
- Mantener arquitectura App Router y contratos actuales de componentes.
- Evitar cambios invasivos en layout raíz y rutas protegidas.
- Preservar responsive behavior existente en desktop/mobile.

## Goals / Non-Goals

**Goals:**
- Permitir que el usuario edite aspectos del layout de trabajo (densidad/ancho/visibilidad) de forma explícita y persistente localmente.
- Unificar política de hover/focus/tooltip en componentes de layout para mejorar descubribilidad.
- Añadir cobertura de tests de comportamiento UX clave (persistencia, accesibilidad básica, interacciones sin regresión).

**Non-Goals:**
- Rediseño visual completo del producto.
- Cambios en autenticación, autorización o contratos de API.
- Introducir dependencias pesadas de drag-and-drop o editores de layout complejos.

## Decisions

1. **Personalización incremental sobre controles existentes**
   - Se extienden componentes actuales (`SidebarShell`, `Sidebar`, layout de chat) en lugar de crear un nuevo framework de layout.
   - **Alternativa considerada:** sistema de grid libre con drag-resize completo.
   - **Por qué no:** mayor riesgo de regresión y complejidad para este alcance.

2. **Persistencia local con claves versionadas**
   - Los ajustes de layout se guardan en `localStorage` con namespace estable (p. ej. `cgn.layout.*`) y fallback seguro cuando no existe valor o hay valor inválido.
   - **Alternativa considerada:** persistencia server-side por usuario.
   - **Por qué no:** requiere tocar auth/API y está fuera de alcance.

3. **Política de affordances aditiva y verificable**
   - Se formalizan reglas de hover/focus/tooltip para zonas editables e interactivas, priorizando teclado y contraste.
   - **Alternativa considerada:** cambios estéticos ad-hoc por componente.
   - **Por qué no:** genera inconsistencias y deuda de UX.

4. **Testing centrado en contratos UX**
   - Se prueban contratos (persistencia, visibilidad de tooltips en elementos críticos, estados hover/focus esperables) en lugar de snapshots frágiles.
   - **Alternativa considerada:** solo validación manual.
   - **Por qué no:** riesgo alto de regresión silenciosa.

## Risks / Trade-offs

- **[Risk] Persistencia local inconsistente entre releases** → Mitigación: claves versionadas y normalización de valores al leer.
- **[Risk] Tooltips/hover excesivos generan ruido visual** → Mitigación: aplicar solo en acciones críticas y con delays adecuados.
- **[Risk] Cambios de layout afecten lectura en mobile** → Mitigación: mantener límites responsivos actuales y tests para viewport pequeño.
- **[Risk] Complejidad incremental en componentes de layout** → Mitigación: cambios pequeños, aislados y sin refactor amplio.
