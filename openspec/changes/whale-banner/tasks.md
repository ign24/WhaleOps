## 1. Lectura y contexto previo

- [x] 1.1 Leer `dot-grid-background.tsx` para verificar props disponibles (className, posicionamiento absoluto)
- [x] 1.2 Leer el bloque hero actual en `chat-help-card.tsx` (líneas ~213-267) para entender exactamente qué elementos se mueven al banner

## 2. WhaleSvg — mascota SVG inline

- [x] 2.1 Diseñar el SVG path del cuerpo de la ballena (viewBox 0 0 150 90, bezier curves redondeadas)
- [x] 2.2 Agregar ojo con highlight (dos círculos: uno fill var(--text-primary), uno pequeño fill var(--surface))
- [x] 2.3 Agregar cola como `<motion.path>` separado para animación independiente
- [x] 2.4 Agregar blowhole como path pequeño en el lomo
- [x] 2.5 Aplicar colores con CSS vars: body fill `color-mix(in srgb, var(--primary) 18%, transparent)`, stroke `var(--primary)`
- [x] 2.6 Implementar idle animations con `motion`: float Y ±4px (3s loop), tail wag ±8deg (1.2s loop), blink scaleY (cada ~4s)

## 3. BubbleSet — burbujas flotantes

- [x] 3.1 Implementar 3 círculos `<motion.circle>` con stagger 0.55s, loop infinito opacity 0→0.45→0 + translateY -22px
- [x] 3.2 Posicionar burbujas cerca del blowhole con coordenadas relativas al viewBox

## 4. WhaleBanner — contenedor hero

- [x] 4.1 Crear el contenedor con `relative overflow-hidden rounded-[11px]` y minHeight `10.5rem`
- [x] 4.2 CSS dot grid con radial-gradient (DotGridBackground es canvas fixed global — no embebible; solución: CSS puro, mismo efecto)
- [x] 4.3 Agregar radial gradient spotlight como `div` absoluto con `background: radial-gradient(ellipse 55% 90% at 72% 55%, ...)`
- [x] 4.4 Implementar border con gradient: `padding: 1px` en wrapper outer con linear-gradient, inner `bg-[var(--surface)]`
- [x] 4.5 Layout interno: flex row, lado izquierdo (badge + título + tagline), lado derecho (WhaleSvg + BubbleSet)
- [x] 4.6 Mover badge de estado, h1 y descripción desde `chat-help-card.tsx` al interior del banner; stats permanecen fuera
- [x] 4.7 Implementar motion entry de la ballena: `initial: {x: 80, opacity: 0}` → `animate: {x: 0, opacity: 1}` con spring stiffness 80 damping 15
- [x] 4.8 Implementar motion exit de la ballena: `exit: {rotate: 25, y: 60, opacity: 0}` duration 0.3 ease-in

## 5. Integración en chat-help-card.tsx

- [x] 5.1 Importar `WhaleBanner` en `chat-help-card.tsx`
- [x] 5.2 Reemplazar el bloque `<motion.div className="landing-hero__hero">` por `<WhaleBanner>` + stats row
- [x] 5.3 Pasar las props necesarias: status, latencyMs
- [x] 5.4 Verificar que `WhaleBanner` queda dentro del `AnimatePresence` del componente padre (`chat-panel.tsx:1902`)

## 6. Verificación visual y build

- [ ] 6.1 Verificar que el banner se ve correctamente en tema dark (colores, glow, dot-grid)
- [ ] 6.2 Verificar que el banner se ve correctamente en tema light
- [ ] 6.3 Verificar animación de entrada al navegar al welcome card
- [ ] 6.4 Verificar animación de salida al enviar el primer mensaje
- [x] 6.5 Ejecutar `bun run build` y confirmar que compila sin errores de TypeScript
