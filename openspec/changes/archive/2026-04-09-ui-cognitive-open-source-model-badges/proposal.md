## Why

El selector de modelos en `ui-cognitive` muestra etiquetas de costo (`FREE/LOW/HIGH`) y confirmaciones de riesgo con texto técnico (`cost=UNKNOWN, billing=unknown`) que no reflejan la necesidad actual. Se requiere priorizar una clasificación por apertura/licencia (open source vs no open source) para que la decisión de modelo sea clara y útil para el usuario.

## What Changes

- Reemplazar badges de costo en el selector de modelo por badges de apertura/licencia.
- Eliminar confirmaciones de selección basadas en `costCategory`/`billingType`.
- Mantener bloqueo por política de entorno (`block`) y su mensaje correspondiente.
- Añadir/ajustar tests del selector para validar la nueva semántica de badges y la ausencia de `window.confirm` por costo.

## Capabilities

### New Capabilities
- `model-openness-badges`: El selector de modelos SHALL mostrar clasificación de apertura (por ejemplo Open Source, Open Weights, Closed/Source-available) en lugar de etiquetas de costo.

### Modified Capabilities
- Ninguna.

## Impact

- Afecta `ui-cognitive/components/chat/model-selector.tsx` para rendering y flujo de selección.
- Afecta `ui-cognitive/lib/model-registry.ts` para incorporar metadatos de apertura/licencia por modelo.
- Afecta `ui-cognitive/tests/model-selector.test.tsx` y potencialmente tests de registry relacionados.
