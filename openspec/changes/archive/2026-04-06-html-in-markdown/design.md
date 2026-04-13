## Context

`react-markdown` v10 usa un pipeline de procesamiento basado en `unified` (remark → rehype → react). Por defecto, el plugin `remark-parse` convierte HTML raw en nodos de tipo `raw` en el árbol hast, pero `react-markdown` los descarta si no hay un plugin que los procese. Resultado: `<strong>bold</strong>` en un mensaje del agente aparece como texto literal.

El frontend ya tiene `remark-gfm` (tablas, listas de tareas, strikethrough). La adición de plugins rehype es aditiva y no rompe nada existente.

## Goals / Non-Goals

**Goals:**
- Renderizar HTML raw embebido en markdown sin afectar el markdown existente.
- Sanitizar el HTML para prevenir XSS antes de entregarlo al DOM.
- Cambio limitado a un solo archivo (`message-markdown.tsx`) + instalación de deps.

**Non-Goals:**
- Soporte para componentes React dentro del HTML (MDX).
- Renderizado de `<script>` o event handlers — bloqueados por sanitización.
- Cambios en el servidor o en el pipeline de streaming.

## Decisions

### D1: `rehype-raw` + `rehype-sanitize` (no DOMPurify)

`rehype-raw` trabaja sobre el AST de hast — parsea los nodos `raw` y los integra al árbol. `rehype-sanitize` filtra el AST antes de que llegue a React, eliminando elementos y atributos peligrosos.

Alternativa descartada: `DOMPurify` en el string antes de pasarlo a `ReactMarkdown`. Problema: opera sobre el string completo y puede romper el markdown (e.g., interfiere con bloques de código que contienen `<` y `>`).

### D2: Schema de sanitización: `defaultSchema` de `rehype-sanitize`

El schema por defecto permite HTML semántico common (`<div>`, `<span>`, `<table>`, `<strong>`, etc.) y bloquea `<script>`, `<iframe>`, atributos `on*`, `href` con `javascript:`, etc.

No se define un schema custom por ahora — el default cubre el caso de uso del agente.

## Risks / Trade-offs

- **Riesgo**: Un agente malintencionado o comprometido podría inyectar HTML. → Mitigación: `rehype-sanitize` con defaultSchema.
- **Trade-off**: `rehype-raw` agrega ~5KB al bundle. Aceptable dado el gain funcional.
- **Edge case**: HTML malformado en la respuesta del agente puede producir output inesperado. → `rehype-raw` es tolerante a faults (usa el parser de hast, no eval).
