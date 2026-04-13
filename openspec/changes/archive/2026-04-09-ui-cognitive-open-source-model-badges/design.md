## Context

El selector actual está acoplado a `ModelCostCategory` y `ModelBillingType` para mostrar badges y disparar confirmaciones de selección. Esa UX prioriza gobernanza de costo interna, pero el requerimiento actual del producto es orientar por apertura del modelo (open source/open weights/cerrado), especialmente en `ui-cognitive` donde el usuario espera información de licencia más que heurísticas de billing.

## Goals / Non-Goals

**Goals:**
- Introducir metadatos de apertura/licencia por modelo en `model-registry`.
- Mostrar badges de apertura en chip activo y opciones del dropdown.
- Quitar la confirmación `window.confirm(...)` basada en costo/billing.
- Mantener política de entorno para bloqueo (`block`) sin regresiones.
- Actualizar pruebas del selector para el nuevo comportamiento.

**Non-Goals:**
- No rediseñar visualmente todo el selector (se preserva el estilo actual).
- No rehacer políticas de entorno ni reglas backend de modelos.
- No introducir fetch dinámico de licencias en runtime (datos estáticos en registry).

## Decisions

1. **Agregar clasificación de apertura al registry**
   - Se añade un campo tipado (p.ej. `opennessCategory`) en `ModelEntry` para desacoplar la UI de costo.
   - Rationale: mantiene una única fuente de verdad por modelo y evita lógica hardcodeada en el componente.

2. **Cambiar badge visible de costo a apertura**
   - El badge del chip y de cada opción usará `opennessCategory` y su label/clase de estilo.
   - Rationale: satisface el requerimiento de producto con mínimo cambio estructural.

3. **Eliminar confirmación por costo en selección**
   - Se elimina el flujo `requiresConfirmation` ligado a `costCategory`/`billingType`.
   - Se conserva el guardrail `policyTag === "block"` y warning inline.
   - Rationale: evita fricción y mensajes irrelevantes para el usuario.

4. **Ajustar tests a semántica de apertura**
   - Tests deben validar badges de apertura y que seleccionar modelos no requiere `confirm` por costo.
   - Rationale: prevenir regresión al comportamiento anterior.

## Risks / Trade-offs

- **[Riesgo] Clasificación de apertura incorrecta para un modelo** → **Mitigación:** definir categorías explícitas por modelo en `model-registry` y revisar con fuentes oficiales.
- **[Riesgo] Tests existentes acoplados a labels FREE/HIGH** → **Mitigación:** actualizar asserts a nuevos labels y agregar prueba de no-confirmación.
- **[Trade-off] Se pierde visibilidad directa de costo en selector** → **Mitigación:** mantener costos para otras superficies (si aplican) sin mostrarlos en este control.
