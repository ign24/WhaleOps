## Why

WhaleOps carece de identidad visual propia — la welcome card actual es funcional pero genérica, sin ningún elemento que refuerce el nombre del producto. Un banner hero estilo Vercel landing page con mascota animada establece la identidad visual del agente y mejora la primera impresión sin costo adicional de dependencias ni performance.

## What Changes

- **Nuevo componente** `whale-banner.tsx`: banner hero completo con mascota SVG animada, dot-grid background (componente existente), radial gradient spotlight CSS y título integrado.
- **Modificación** en `chat-help-card.tsx`: el bloque hero actual (badge + h1 + descripción + stats) se reemplaza por `<WhaleBanner>` que encapsula esos mismos elementos con el nuevo tratamiento visual.
- La mascota es un SVG inline con personalidad (ojo con highlight, cola separada) y animaciones: entry swim-in, idle float/tail-wag/bubbles/blink, exit dive-away.
- Estilo Vercel: dark surface + dot-grid overlay + radial glow detrás del elemento central + border con gradient sutil.

## Capabilities

### New Capabilities

- `whale-banner`: Banner hero visual para el welcome card de WhaleOps — mascota SVG animada con motion, radial gradient spotlight, dot-grid background, animaciones de entrada y salida.

### Modified Capabilities

<!-- ninguna — los requisitos funcionales del hero (badge, título, stats) no cambian, solo su presentación visual -->

## Impact

- **Archivos nuevos**: `ui-cognitive/components/chat/whale-banner.tsx`
- **Archivos modificados**: `ui-cognitive/components/chat/chat-help-card.tsx` (bloque hero)
- **Dependencias**: ninguna nueva — usa `motion` (ya en bundle), CSS vars del tema, componente `dot-grid-background.tsx` existente
- **Performance**: cero regresión — SVG inline (0 HTTP requests), transforms CSS GPU-accelerated, motion ya en bundle
- **Tests**: no requiere — componente visual puro sin lógica de negocio
