## 1. Preparar exports

- [x] 1.1 Exportar `rcIsSuccess` desde `tool-call-card.tsx` (actualmente privada)
- [x] 1.2 Exportar `tryParseJson` desde `tool-call-card.tsx` o replicar extracción mínima en `TerminalBlock`

## 2. TerminalBlock — tests RED

- [x] 2.1 Escribir test RED: comando visible con `$` prefix y clase `text-[var(--primary)]`
- [x] 2.2 Escribir test RED: exit badge verde cuando `returnCodeSummary` contiene `rc=0`
- [x] 2.3 Escribir test RED: exit badge rojo cuando `returnCodeSummary` es non-zero
- [x] 2.4 Escribir test RED: no badge cuando no hay `returnCodeSummary`
- [x] 2.5 Escribir test RED: output en `<pre>` visible cuando expandido
- [x] 2.6 Escribir test RED: JSON result con `content` field muestra solo el content

## 3. TerminalBlock — implementación

- [x] 3.1 Crear `components/activity/terminal-block.tsx` con props: `command`, `output`, `returnCodeSummary`, `expanded`, `onToggle`
- [x] 3.2 Header: `$ {command}` en `font-mono text-[var(--primary)]` + exit badge inline + timestamp slot
- [x] 3.3 Exit badge: `rounded-full border px-1.5 py-0.5 text-[10px]` con colores semánticos de `rcIsSuccess`
- [x] 3.4 Body: `<pre>` con `chat-scrollbar max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-muted` — sin border propio
- [x] 3.5 Extraer output limpio: si `toolResult` es JSON con `content`, usar ese; sino string directo
- [x] 3.6 Verificar tests GREEN

## 4. TimelineEntry — integración

- [x] 4.1 Escribir test RED: entry de categoría `terminal` renderiza sin `.rounded-md.border` anidado (no nested card border)
- [x] 4.2 En `TimelineEntry`: importar `TerminalBlock` y detectar `category === "terminal"`
- [x] 4.3 Para terminal: renderizar `<TerminalBlock>` en lugar de `<ToolCallCard>` — sin wrapper con border propio
- [x] 4.4 Pasar `command` (de `toolArgs.command` o `commandSummary`), `output` (de `toolResult`), `returnCodeSummary`, `expanded`, `onToggle`
- [x] 4.5 Ajustar `hasExpandableContent` para terminal: expandible solo si hay `toolResult` con contenido
- [x] 4.6 Verificar tests GREEN

## 5. Verificación final

- [x] 5.1 Correr suite completa: `bun run test` sin regresiones
- [ ] 5.2 Verificar visualmente en dev server: entry terminal es una sola card, comando en primary, badge inline
