## Capability: timeline-entry-tooltip

Acceso al texto completo de labels que se truncan visualmente en el timeline de actividad.

---

### Requirement: truncated-label-tooltip

El elemento visual que muestra el label de una entry SHALL exponer el texto completo como tooltip nativo (atributo `title`) cuando el texto puede truncarse.

#### Scenario: nombre de modelo largo accessible en hover

WHEN el label renderizado de una entry de tipo `agent` es `"Mistralai/devstral 2 123b instr..."`
AND el texto se trunca por overflow
THEN el elemento tiene `title="Mistralai/devstral 2 123b instruct"` con el texto sin truncar
AND el tooltip aparece al hacer hover

#### Scenario: herramienta con nombre corto no afectada

WHEN el label de una entry es `"Terminal"`
THEN el atributo `title` puede omitirse o ser igual al label
AND el comportamiento visual no cambia

---

### Requirement: subtitle-tooltip

El subtitle de una entry SHALL exponer su texto completo via `title` cuando se trunca, aplicando la misma regla que el label.

#### Scenario: path largo accessible

WHEN el subtitle de una entry es `/workspace/very/long/path/to/some/file.py`
AND se trunca visualmente
THEN el elemento tiene `title` con la ruta completa
