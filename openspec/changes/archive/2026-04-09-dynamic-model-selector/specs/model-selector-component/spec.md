## ADDED Requirements

### Requirement: ModelSelectorChip permanente en el input bar
El sistema SHALL renderizar un chip clickeable a la izquierda del textarea en el input bar del chat que muestra el modelo activo y se actualiza reactivamente al cambiar preferencias.

#### Scenario: Chip visible en estado inicial
- **WHEN** el chat se carga sin preferencias guardadas
- **THEN** el chip muestra "Devstral" (modelo default) con indicador de temperatura "Medium"

#### Scenario: Chip actualizado tras cambio de modelo
- **WHEN** el usuario selecciona "Qwen Coder 480B" en el dropdown
- **THEN** el chip actualiza inmediatamente su label sin recargar la página

#### Scenario: Chip con thinking activo muestra indicador
- **WHEN** `thinking: true` está activo con modelo Nemotron
- **THEN** el chip muestra un ícono adicional (rayo o similar) junto al nombre del modelo

### Requirement: Dropdown de selección de modelo
El sistema SHALL mostrar un dropdown al hacer click en el chip con la lista de modelos disponibles agrupados por tier, con el modelo activo marcado.

El dropdown SHALL:
- Listar modelos Tier S primero, luego A, luego B
- Mostrar nombre amigable + descripción corta de cada modelo
- Marcar el modelo activo con un indicador visual (punto, check, etc.)
- Cerrar al seleccionar un modelo o hacer click fuera

#### Scenario: Dropdown muestra modelos agrupados
- **WHEN** el usuario hace click en el chip
- **THEN** el dropdown muestra 9 modelos agrupados, con el activo marcado

#### Scenario: Selección de modelo persiste en localStorage
- **WHEN** el usuario selecciona "DeepSeek V3" en el dropdown
- **THEN** `localStorage.getItem("openclaw:inference-prefs")` contiene `model: "deepseek_v3"` y el dropdown se cierra

#### Scenario: Dropdown accesible por teclado
- **WHEN** el dropdown está abierto
- **THEN** el usuario puede navegar con flechas y seleccionar con Enter

### Requirement: Indicadores de temperatura accesibles desde el chip
El sistema SHALL incluir dentro del dropdown (o como sección secundaria del chip) los controles de temperatura preset y thinking toggle.

#### Scenario: Sección de temperatura en el dropdown
- **WHEN** el dropdown está abierto
- **THEN** hay una sección "Temperatura" con tres opciones: Low / Medium / High con la activa marcada

#### Scenario: Toggle de thinking en el dropdown (solo Nemotron)
- **WHEN** el dropdown está abierto y el modelo activo es `nemotron_super`
- **THEN** hay un toggle "Thinking" visible y activable

#### Scenario: Toggle de thinking oculto para otros modelos
- **WHEN** el dropdown está abierto y el modelo activo NO es `nemotron_super`
- **THEN** el toggle de thinking no aparece o está deshabilitado con tooltip explicativo
