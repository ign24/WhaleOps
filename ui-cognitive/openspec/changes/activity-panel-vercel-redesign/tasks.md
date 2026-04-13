## 1. model-vendor-badge — tinted background

- [x] 1.1 Escribir test RED: badge renderiza con clase de fondo tinted (bg-[color-mix...])
- [x] 1.2 Reemplazar border-only por `bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]` + `border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]` en el wrapper del badge
- [x] 1.3 Verificar test GREEN + `bun run test`

## 2. session-info — stats inline con separadores verticales

- [x] 2.1 Escribir test RED: stats de tools, duración y modelo están en el mismo contenedor inline
- [x] 2.2 Reemplazar grid de dos columnas por flex row con `divide-x divide-[var(--border)]` y `px-3` entre items
- [x] 2.3 Verificar test GREEN + `bun run test`

## 3. session-summary — métrica compacta con separadores

- [x] 3.1 Escribir test RED: total, duración, completados y errores en fila con separadores
- [x] 3.2 Reemplazar grid por flex row inline con separadores verticales y texto `text-[11px]`
- [x] 3.3 Verificar test GREEN + `bun run test`

## 4. agent-step-card — accent bar lateral

- [x] 4.1 Escribir test RED: card tiene borde izquierdo de color (border-l-2)
- [x] 4.2 Agregar `border-l-2 border-[var(--primary)]` al contenedor root del card, ajustar padding izquierdo
- [x] 4.3 Verificar test GREEN + `bun run test`

## 5. timeline-entry — status pill badge

- [x] 5.1 Escribir test RED: entry con status "running" muestra texto "En curso"
- [x] 5.2 Escribir test RED: entry con status "completed" muestra texto "Listo"
- [x] 5.3 Escribir test RED: entry con status "failed" muestra texto "Error"
- [x] 5.4 Escribir test RED: entry con status "pending" muestra texto "Pendiente"
- [x] 5.5 Crear helper `statusBadge(status)` que retorna `{ label, colorClasses }` dentro de timeline-entry.tsx
- [x] 5.6 Reemplazar el indicador de color actual (punto/icono coloreado) por el pill badge `<span>` con label + clases semánticas
- [x] 5.7 Verificar todos los tests GREEN + `bun run test`

> Nota: Badge eliminado a petición del usuario (solo conectores y colores en icono).

## 6. timeline-entry — línea conectora vertical

- [x] 6.1 Escribir test RED: el contenedor del icono tiene un elemento hijo con clase de línea vertical (e.g. `activity-connector`)
- [x] 6.2 Agregar div absoluto `absolute left-1/2 top-6 bottom-0 w-px bg-[var(--border)] -translate-x-1/2` dentro del contenedor del icono; aplicar `relative` al contenedor
- [x] 6.3 Ocultar la línea en el último entry con CSS (`:last-child` o prop `isLast`)
- [x] 6.4 Verificar test GREEN + `bun run test`

## 7. tool-call-card — context chips pill con border real

- [x] 7.1 Escribir test RED: chip de return code con exit 0 tiene clase de color success
- [x] 7.2 Escribir test RED: chip de return code con exit ≠ 0 tiene clase de color error
- [x] 7.3 Reemplazar clases de chips actuales por `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium`
- [x] 7.4 Aplicar clases semánticas a return code chip: exit 0 → `border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--success)]`, else → `border-[var(--error)]/30 bg-[var(--error)]/8 text-[var(--error)]`
- [x] 7.5 Verificar tests GREEN + `bun run test`

## 8. tool-call-card — args en tabla two-column

- [x] 8.1 Escribir test RED: cada argumento renderiza dentro de un elemento `<dl>`
- [x] 8.2 Reemplazar el renderizado de args por `<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">` con `<dt>` para la clave y `<dd>` para el valor
- [x] 8.3 Aplicar `font-mono text-[10px]` a las claves y `font-mono text-[11px]` a los valores de tipo path/command
- [x] 8.4 Verificar test GREEN + `bun run test`

## 9. session-workspace — section headers con count badge

- [x] 9.1 Escribir test RED: header de sección con items muestra el count como badge
- [x] 9.2 Agregar `<span className="ml-1.5 rounded-full bg-[color-mix(...)] px-1.5 py-0.5 text-[10px]">{count}</span>` al lado de cada label de sección
- [x] 9.3 Aplicar opacidad reducida a secciones vacías (`opacity-50`)
- [x] 9.4 Verificar test GREEN + `bun run test`

## 10. Verificación final

- [x] 10.1 Correr suite completa: `bun run test` sin regresiones
- [ ] 10.2 Verificar visualmente en dev server que el panel se ve como esperado
