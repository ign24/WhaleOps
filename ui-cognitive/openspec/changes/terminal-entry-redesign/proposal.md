## Why

Los entries de terminal en el panel de actividad muestran dos capas de card superpuestas (el `<li>` con border + `ToolCallCard` con border propio), y el comando y su output se presentan en tabs genéricos sin identidad visual de consola. El resultado es visualmente ruidoso y difícil de escanear en tiempo real.

## What Changes

- **`timeline-entry.tsx`**: Para entries de categoría `terminal`, el output del comando se renderiza directo dentro del mismo `<li>` al expandir — sin `ToolCallCard` anidado. El `<li>` pasa a ser la única card visible.
- **Nuevo componente `TerminalBlock`**: Subcomponente interno que renderiza el comando en `text-[var(--primary)]` siempre visible, exit badge inline en el header, y el output como `<pre>` con scroll al expandir — todo en una sola capa.
- **`ToolCallCard`**: Se elimina el `border` propio del wrapper para entries de terminal (o se delega el renderizado terminal a `TerminalBlock` sin ToolCallCard).
- Sin cambios de props, tipos, lógica de datos, ni API routes.

## Capabilities

### New Capabilities

- `terminal-entry-visual`: Renderizado visual unificado para entries de tipo terminal — comando visible con primary color, exit badge semántico inline, output expandible sin card anidada.

### Modified Capabilities

<!-- ninguna: specs activas vacías -->

## Impact

**Archivos afectados (solo UI):**
- `components/activity/timeline-entry.tsx` — detectar categoría terminal y renderizar `TerminalBlock` en lugar de `ToolCallCard`
- `components/activity/tool-call-card.tsx` — sin cambios o cambio mínimo de clase en wrapper
- Nuevo subcomponente inline dentro de `timeline-entry.tsx` o archivo separado `components/activity/terminal-block.tsx`

**Sin dependencias nuevas. Sin cambios de tipos ni API.**
