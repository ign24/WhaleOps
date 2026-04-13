## Why

La UI actual ya es funcional, pero su layout tiene poca capacidad de personalización por parte del usuario y varias acciones interactivas no comunican claramente su intención. Esto reduce descubribilidad (qué se puede hacer) y control percibido (cómo adaptar el espacio de trabajo), especialmente en sesiones largas.

## What Changes

- Hacer el layout principal más editable para el usuario sin tocar rutas ni lógica sensible (auth, API, seguridad): controles de personalización visual y persistencia local.
- Extender la interacción del layout con affordances UX de bajo riesgo: hover states consistentes, tooltips más útiles y mejor feedback en acciones de sidebar/chat layout.
- Definir un contrato de UX para no romper la política existente: mejoras aditivas, accesibles y reversibles, sin rediseño completo.
- Agregar cobertura de tests de UI para asegurar que la edición de layout y los nuevos estados interactivos no degraden flujos actuales.

## Capabilities

### New Capabilities
- `workspace-layout-customization`: controles de personalización del layout (p. ej. densidad/ancho/estado) con persistencia en `localStorage` y fallback seguro.
- `layout-affordance-ux-policy`: política verificable para hover/tooltips/focus states en zonas de layout y navegación, alineada con accesibilidad y consistencia visual.

### Modified Capabilities
- `split-chat-layout`: ampliar requisitos para soportar edición de layout por usuario y continuidad de estado entre recargas sin romper el comportamiento responsive actual.

## Impact

- Frontend UI (`ui-cognitive`) en componentes de layout/chat shell y utilidades de estado local.
- Estilos globales/componente para hover, focus y tooltips (sin alterar contratos de backend ni auth).
- Tests frontend de interacción y persistencia de layout.
- No impacta APIs externas, rutas de auth, ni configuración sensible.
