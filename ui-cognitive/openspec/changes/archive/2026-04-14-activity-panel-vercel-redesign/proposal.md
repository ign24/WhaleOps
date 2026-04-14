## Why

El panel de actividad del agente muestra información técnica densa (tool calls, argumentos, resultados, workspace) con un diseño plano que dificulta la lectura rápida. Los usuarios necesitan escanear el estado del agente en tiempo real, pero la jerarquía visual actual no diferencia entre lo importante y lo secundario. La comparación con productos como Vercel, Linear o Railway muestra que los mismos datos pueden comunicarse con mucha más claridad usando badges con peso real, conectores de timeline, y tablas densas.

## What Changes

- **`timeline-entry`**: Agregar línea conectora vertical entre entries (estilo log de CI/CD), status badge pill reemplaza el punto coloreado, timestamp + duración en columna derecha alineada
- **`tool-call-card`**: Context chips como pills con border real, tabs rediseñados con fondo activo, args en tabla de dos columnas (key | value) con tipografía monospace, return code como badge con color semántico (verde/rojo/gris), resultado JSON con fondo diferenciado
- **`agent-step-card`**: Card con borde izquierdo de color (accent bar) por tipo, header colapsable más compacto
- **`session-workspace`**: Secciones con header pill-style (icono + label + count badge), status dots reemplazados por badges, paths en monospace con copy-on-click implícito
- **`session-info`**: Stats como chips inline en una sola línea, live indicator con animación más refinada
- **`session-summary`**: Grid compacto estilo tabla de métricas con separadores verticales
- **`model-vendor-badge`**: Badge con fondo tinted según vendor tier

Ningún cambio de funcionalidad, lógica, props, ni comportamiento — solo clases Tailwind y estructura JSX interna.

## Capabilities

### New Capabilities

- `activity-visual-system`: Sistema visual unificado para el panel de actividad — tipografía, badges, conectores, colores semánticos aplicados consistentemente en todos los sub-componentes

### Modified Capabilities

<!-- ninguna: no hay specs existentes -->

## Impact

**Archivos afectados (solo UI, sin lógica):**
- `components/activity/timeline-entry.tsx`
- `components/activity/tool-call-card.tsx`
- `components/activity/agent-step-card.tsx`
- `components/activity/session-workspace.tsx`
- `components/activity/session-info.tsx`
- `components/activity/session-summary.tsx`
- `components/activity/model-vendor-badge.tsx`

**Sin dependencias externas nuevas** — todo con Tailwind CSS v4 existente y CSS variables del design system actual.
**Sin cambios a types, API routes, hooks, ni lib.**
