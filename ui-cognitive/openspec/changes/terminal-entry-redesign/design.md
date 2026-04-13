## Context

`TimelineEntry` renderiza cada acción del agente como un `<li>` con `border`. Para entries de tipo tool, expande un `ToolCallCard` que tiene su propio `border` + `bg-[var(--surface)]`, creando doble card. Para entries de terminal (`shell_execute`, `run_shell_command`), el resultado es especialmente ruidoso: el comando ya se muestra en el subtitle como `$ git status`, y al expandir aparece una segunda card con tabs "Parámetros" / "Resultado" — tres niveles de información redundante.

Los datos disponibles para un entry terminal:
- `entry.commandSummary` → el comando corto (ej: `git status`)
- `entry.returnCodeSummary` → `"rc=0 (success)"` o `"rc=1"`
- `entry.toolArgs` → `{ command: "...", working_directory?: "..." }`
- `entry.toolResult` → stdout/stderr, a veces JSON `{ content: "...", status: "ok" }`
- `entry.sandboxPath` → path del workspace

## Goals / Non-Goals

**Goals:**
- Una sola capa de card para entries terminal — sin card anidada
- Comando siempre visible en `text-[var(--primary)]` con `$` prefix
- Exit badge semántico inline en el header (verde rc=0, rojo rc≠0)
- Output expandible directo en el `<li>` — sin `ToolCallCard` wrapper
- Output del comando como `<pre>` con scroll, fondo diferenciado

**Non-Goals:**
- Cambios de props, tipos, o lógica de datos
- Cambios en entries no-terminal (file, search, agent, repo)
- Nuevas dependencias
- Animaciones o syntax highlighting del output

## Decisions

### D1: Nuevo componente `TerminalBlock` vs inline JSX en `TimelineEntry`

**Opciones:**
- A) JSX inline dentro de `TimelineEntry` con condición `if category === "terminal"`
- B) Archivo separado `components/activity/terminal-block.tsx` (elegida)

**Rationale:** B mantiene `TimelineEntry` legible. `TerminalBlock` tiene responsabilidad única y es testeable en aislamiento. El overhead de un archivo extra es mínimo.

### D2: Cómo extraer el output limpio del resultado

El `toolResult` puede ser:
1. JSON string `{"content": "...", "status": "ok"}` → extraer `content`
2. String plano (stdout directo)
3. String vacío o null

**Decisión:** Reutilizar la lógica de `tryParseJson` de `tool-call-card.tsx` — exportarla o duplicar la extracción mínima en `TerminalBlock`. Si hay `content` en el JSON, usar ese. Sino, usar el string directo.

### D3: Entry terminal no pasa por `ToolCallCard`

Para categoría `terminal`, `TimelineEntry` renderiza `<TerminalBlock>` en lugar de `<ToolCallCard>`. El `<li>` ya tiene border — `TerminalBlock` no agrega border propio, usa fondo diferenciado para el output.

### D4: Exit badge — reutilizar `rcIsSuccess` de `tool-call-card.tsx`

La función `rcIsSuccess(rc: string)` ya existe y detecta `rc=0`. Exportarla para reutilizarla en `TerminalBlock`.

## Risks / Trade-offs

**[Risk] Entries con `commandSummary` pero sin `toolResult`** → Mitigation: `TerminalBlock` renderiza solo el header cuando no hay output. `hasExpandableContent` ya maneja esto — si no hay output, no hay chevron.

**[Risk] `toolResult` JSON con estructura inesperada** → Mitigation: fallback a string directo. Nunca rompe.

**[Risk] Output muy largo sin scroll** → Mitigation: `max-h-48 overflow-y-auto` en el `<pre>`.

## Migration Plan

1. Exportar `rcIsSuccess` de `tool-call-card.tsx`
2. Crear `components/activity/terminal-block.tsx`
3. En `TimelineEntry`: condición `category === "terminal"` → render `TerminalBlock`, else → render `ToolCallCard` como antes
4. Tests unitarios para `TerminalBlock`
5. `bun run test` — sin regresiones
