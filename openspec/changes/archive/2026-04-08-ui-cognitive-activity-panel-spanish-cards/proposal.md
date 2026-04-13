## Why

En `ui-cognitive` aún quedan etiquetas en inglés dentro de las tarjetas del panel de actividad, lo que rompe la consistencia del producto en español. Este ajuste mejora claridad para usuarios hispanohablantes y unifica la experiencia visual.

## What Changes

- Traducir al español el texto visible de tarjetas y encabezados dentro del panel de actividad.
- Mantener sin cambios la estructura, comportamiento y datos de las tarjetas (solo copy/UI labels).
- Actualizar pruebas afectadas por textos visibles para reflejar el copy en español.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `activity-panel`: el contenido textual visible de las tarjetas del panel debe mostrarse en español de forma consistente.

## Impact

- Componentes `ui-cognitive/components/activity/*` con etiquetas visibles de UI.
- Tests de `ui-cognitive/tests/*` que validan textos del panel de actividad.
- Sin impacto en APIs, contratos de datos ni dependencias externas.
