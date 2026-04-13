## MODIFIED Requirements

### Requirement: Input bar incorpora chip de modelo a la izquierda del textarea
El input bar del chat SHALL incorporar el `ModelSelectorChip` como elemento permanente a la izquierda del área de texto, sin desplazar ni reducir el área de texto de forma significativa (máximo 10% reducción de ancho en desktop).

El chip SHALL estar posicionado inline con el textarea, alineado verticalmente al centro del input bar, y no afectar el comportamiento del textarea (focus, submit, resize).

#### Scenario: Input bar con chip visible en desktop
- **WHEN** el chat está en modo desktop (viewport >= 768px)
- **THEN** el input bar muestra [ModelSelectorChip] [textarea] [botones de acción] en una fila horizontal

#### Scenario: Input bar en mobile oculta detalles del chip
- **WHEN** el viewport es < 768px
- **THEN** el chip muestra solo el ícono del modelo sin texto, preservando espacio para el textarea

#### Scenario: Focus en textarea no afectado por el chip
- **WHEN** el usuario hace click en el textarea
- **THEN** el focus va al textarea y el chip no recibe focus inadvertidamente
