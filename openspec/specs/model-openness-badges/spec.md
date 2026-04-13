# model-openness-badges Specification

## Purpose
TBD - created by archiving change ui-cognitive-open-source-model-badges. Update Purpose after archive.
## Requirements
### Requirement: Model selector SHALL display openness classification badges
El selector de modelos SHALL renderizar una clasificación de apertura/licencia por modelo (por ejemplo `Open Source`, `Open Weights`, `Closed`) tanto en el chip activo como en cada opción del dropdown.

#### Scenario: Active model chip shows openness label
- **WHEN** el usuario visualiza el chip del modelo activo en el composer
- **THEN** el badge del chip muestra la etiqueta de apertura del modelo activo

#### Scenario: Dropdown options show openness labels
- **WHEN** el usuario abre el selector de modelos
- **THEN** cada opción de modelo muestra su badge de apertura correspondiente

### Requirement: Model selector SHALL not prompt cost/billing confirmation
La selección de modelo SHALL NOT disparar confirmaciones basadas en costo o billing (incluyendo mensajes del tipo `cost=...` y `billing=...`).

#### Scenario: Selecting model does not trigger cost confirmation
- **WHEN** el usuario selecciona un modelo previamente marcado como `high` o `unknown` en costo
- **THEN** la selección continúa sin abrir `window.confirm` por costo/billing

#### Scenario: Environment block policy remains enforced
- **WHEN** el usuario intenta seleccionar un modelo bloqueado por política de entorno (`policyTag=block`)
- **THEN** la opción permanece no seleccionable y la UI muestra el warning de bloqueo

