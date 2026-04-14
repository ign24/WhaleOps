## Context

El welcome card de WhaleOps (`chat-help-card.tsx`) muestra un hero básico con badge de estado, título h1, descripción y stats en vivo. No hay identidad visual del producto más allá del texto. El proyecto se llama WhaleOps y no tiene ningún elemento gráfico que lo refleje.

Stack relevante:
- `motion` v12 (ya en bundle, ya usado en el mismo componente con `variants` y `AnimatePresence`)
- `dot-grid-background.tsx` componente existente con el patrón de puntos del estilo Vercel
- Tailwind v4 con CSS vars de tema (`--primary`, `--surface`, `--border`, `--text-primary`, `--text-secondary`)
- Next.js 16, React 19

## Goals / Non-Goals

**Goals:**
- Crear un banner hero estilo Vercel (dark surface + dot-grid + radial glow spotlight + border gradient sutil)
- Mascota SVG inline con personalidad: ojo con highlight, cola animable independientemente
- Animación de entrada: la ballena nada desde la derecha hacia el centro del banner
- Animación de salida: la ballena se sumerge (nose-down + translateY) cuando el card hace exit
- Idle loop: float vertical, tail wag, burbujas escalonadas, blink ocasional
- Cero dependencias nuevas, cero impacto en bundle size adicional
- El banner integra el título, badge de estado y stats (no los elimina, los reubica visualmente)

**Non-Goals:**
- Animación en respuesta al estado del agente (offline/online) — futura iteración
- Whale en header o en otras vistas
- Versión animada del logo SVG en `/public`
- Soporte para reduced-motion (puede agregarse después)

## Decisions

### D1: SVG inline vs imagen generada por IA

**Decisión**: SVG inline con paths definidos en código.

**Alternativas consideradas**:
- PNG/WEBP generado por IA: zero JS pero zero interactividad, requiere dos versiones para light/dark, HTTP request adicional, no se puede animar con motion.
- Lottie: muy expresivo pero ~30KB de dependencia adicional y curva de edición externa.

**Rationale**: SVG inline es 0 HTTP requests, usa CSS vars del tema directamente, se anima con motion (ya en bundle), es modificable en código sin herramientas externas, y gzippeado son ~200-400 bytes.

### D2: Estructura de componentes

**Decisión**: Un único archivo `whale-banner.tsx` con tres componentes internos no exportados + un export principal.

```
whale-banner.tsx
  WhaleSvg         ← SVG mascota completa (body, eye, tail, blowhole)
  BubbleSet        ← 3 burbujas con loops escalonados
  WhaleBanner      ← export default: dot-grid + radial glow + texto + whale
```

**Rationale**: Mantener todo en un archivo evita over-engineering. Los sub-componentes no tienen utilidad fuera del banner.

### D3: Placement del dot-grid y radial glow

**Decisión**: El radial gradient va como `background` inline CSS en el contenedor del banner, sobre el dot-grid. El dot-grid (`DotGridBackground`) va como capa absoluta detrás.

```
┌─ WhaleBanner div (relative, overflow-hidden) ─────┐
│  <DotGridBackground> (absolute, inset-0, z-0)     │
│  <div radial-glow> (absolute, inset-0, z-1)       │  ← CSS puro
│  <content> (relative, z-10)                       │
│    título + badge + stats (izquierda)             │
│    WhaleSvg + BubbleSet (derecha)                 │
└───────────────────────────────────────────────────┘
```

**Alternativa descartada**: usar el glow como `box-shadow` — no permite controlar la posición del spotlight.

### D4: Motion variants para entry/exit

**Decisión**: La ballena tiene sus propios variants independientes del `container` variant del card.

- Entry: `x: 80 → 0, opacity: 0 → 1` con `type: "spring", stiffness: 80, damping: 15`
- Exit: `rotate: 0 → 25, y: 0 → 50, opacity: 1 → 0` con `duration: 0.3, ease: "easeIn"`
- Idle: `useAnimationControls` o `animate` prop con `repeat: Infinity` para float/tail/blink

**Rationale**: Spring en la entrada da sensación de peso/inercia (animal nadando). Ease-in en salida es abrupto, como un dive.

### D5: Colores de la mascota

**Decisión**: Usar CSS vars del tema para que la mascota sea compatible con light/dark automáticamente.

```
body fill:   color-mix(in srgb, var(--primary) 20%, transparent)
body stroke: var(--primary)
eye:         var(--text-primary)
highlight:   var(--surface)  ← pequeño círculo blanco en el ojo
bubbles:     var(--primary), opacity 0.35-0.5
```

**Alternativa descartada**: colores hardcoded azul/teal — rompería el dark/light theme dinámico.

## Risks / Trade-offs

- **SVG path complexity** → El whale SVG debe ser lo suficientemente simple para ser legible como código. Si se complica, usar un path simplificado de ~3-4 curvas bezier. Mitigación: diseñar con viewBox 100x60, formas redondeadas simples.
- **DotGridBackground acoplamiento** → Si el componente tiene props específicas o no acepta className para posicionamiento absoluto, puede requerir un wrapper div adicional. Mitigación: leer el componente antes de implementar.
- **motion AnimatePresence en exit** → El exit animation de la ballena funciona solo si el componente está dentro de `AnimatePresence`. El card ya usa `AnimatePresence` en su contenedor padre — verificar que el wrapper de `WhaleBanner` también quede dentro.

## Open Questions

- ¿El `DotGridBackground` acepta `className` para posicionamiento absoluto o necesita wrapper? → Resolver al leer el componente antes de implementar.
- ¿El banner ocupa altura fija o `aspect-ratio`? → Preferir altura fija (`h-36` o `h-40`) para evitar layout shift al cargar las métricas live.
