## Context

El panel de actividad es el componente más denso de información en la app — muestra en tiempo real cada acción del agente (tool calls, pasos, workspace). Los 7 componentes visuales comparten el mismo design system (CSS variables de --surface, --border, --primary, --success, --error, --warning) pero no tienen un lenguaje visual cohesivo.

La referencia de diseño es Vercel Dashboard (deployment logs, function traces) y Linear (activity feed): denso, monocromático con acentos semánticos, tipografía apretada, estado comunicado sin verbose.

## Goals / Non-Goals

**Goals:**
- Timeline entries con línea conectora vertical (estilo CI log)
- Status como pill badge con texto ("Running", "Done", "Failed") en vez de punto coloreado
- Tool args en tabla de dos columnas key|value
- Context chips con border pill real
- Return code badge semántico (verde exit 0, rojo exit ≠ 0)
- Session stats en una línea con separadores verticales
- Model vendor badge con fondo tinted
- Consistencia tipográfica: `text-[11px]` monospace para paths/código, `text-xs` para labels

**Non-Goals:**
- Cambios de props, tipos, lógica, o comportamiento
- Nuevas dependencias
- Animaciones complejas o librerías de motion
- Cambios al design system global (globals.css)
- Modificar tests de snapshot (no hay)

## Decisions

### D1: Línea conectora en timeline vía pseudo-elemento CSS o div absoluto

**Opciones:**
- A) `before:` pseudo-elemento en cada `<li>` — requiere `relative` en li y `before:absolute before:left-[X]`
- B) Div absoluto con `top-0 bottom-0` dentro del contenedor de icono (elegida)

**Rationale:** B es más explícita, más fácil de ajustar, y Tailwind v4 la maneja sin purge issues.

### D2: Status badge como texto + color de fondo vs solo borde

**Opciones:**
- A) Badge con `bg-[color]/10 text-[color] border border-[color]/20` + texto corto ("Ok", "...")
- B) Solo cambiar el punto por un pill con texto (elegida)

**Rationale:** B agrega información sin saturar. "Running" / "Done" / "Failed" son más legibles que puntos de color en un log denso.

### D3: Tool args — tabla vs lista de chips

**Opciones:**
- A) Lista de chips con `key: value` inline
- B) Tabla `<dl>` con `dt` + `dd` en dos columnas (elegida)

**Rationale:** Los args tienen claves largas (file_path, max_results, command) — una tabla de dos columnas mantiene la clave siempre a la izquierda y el valor siempre alineado, mucho más scannable.

### D4: Cada componente se toca de forma independiente (sin shared component nuevo)

**Rationale:** Extraer un componente `StatusBadge` compartido agrega indirección. Los 7 componentes son lo suficientemente distintos que las clases Tailwind inline son más directas. Si emerge una abstracción obvia durante la implementación, se puede hacer, pero no es el objetivo.

## Risks / Trade-offs

**[Risk] Tests de renderizado existentes pueden fallar si buscan texto exacto o clases CSS** → Mitigation: los tests actuales buscan comportamiento (clicks, texto visible) no clases — riesgo bajo. Verificar con `bun run test` después de cada componente.

**[Risk] La línea conectora puede quedar mal alineada con el icono si el icono cambia de tamaño** → Mitigation: fijar el contenedor del icono a `w-6 h-6` y la línea al centro del mismo.

**[Risk] El badge de status alarga las filas en timelines con muchos entries** → Mitigation: badge muy compacto (`px-1.5 py-0.5 text-[10px]`), sin que crezca el height de la fila.

## Migration Plan

1. Modificar un componente a la vez en orden de dependencia (inner → outer)
2. Correr `bun run test` después de cada componente
3. No hay migración de datos ni rollback necesario — son solo clases Tailwind

## Open Questions

- ¿El badge de status debe mostrar texto en español ("Activo", "Listo", "Error") o inglés corto ("Run", "Done", "Err")? → Decisión: español corto alineado con el resto de la UI.
