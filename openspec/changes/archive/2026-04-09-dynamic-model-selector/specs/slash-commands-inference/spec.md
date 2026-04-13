## ADDED Requirements

### Requirement: Slash command /models abre el selector de modelo
El sistema SHALL reconocer `/models` en el input del chat como un comando client-side que abre el dropdown de selección de modelo sin enviar nada al agente.

#### Scenario: /models interceptado antes de enviarse al agente
- **WHEN** el usuario escribe `/models` y presiona Enter
- **THEN** el sistema abre el modelo dropdown y NO envía ningún mensaje al agente

#### Scenario: /models en autocomplete
- **WHEN** el usuario escribe `/` en el input
- **THEN** `/models` aparece en la lista de autocomplete con descripción "Cambiar modelo de inferencia"

### Requirement: Slash command /thinking togglea el modo thinking
El sistema SHALL reconocer `/thinking` como comando client-side que alterna el estado de thinking ON/OFF, persiste en localStorage, y actualiza el chip de modelo en el input bar.

El toggle SHALL solo tener efecto visual cuando el modelo activo es `nemotron_super` — para otros modelos, muestra un mensaje de que thinking no está disponible.

#### Scenario: /thinking activa thinking en modelo Nemotron
- **WHEN** el usuario tiene `model: "nemotron_super"` activo y ejecuta `/thinking`
- **THEN** el estado cambia a `thinking: true`, el chip muestra un indicador visual, y el próximo request usa `model: "nemotron_super_thinking"`

#### Scenario: /thinking desactiva thinking (toggle)
- **WHEN** `thinking` está en `true` y el usuario ejecuta `/thinking`
- **THEN** el estado vuelve a `thinking: false` y los requests usan `model: "nemotron_super"`

#### Scenario: /thinking en modelo no-Nemotron muestra aviso
- **WHEN** el modelo activo NO es `nemotron_super` y el usuario ejecuta `/thinking`
- **THEN** aparece un mensaje inline en el chat: "Thinking solo está disponible en Nemotron Super. Cambiá el modelo con /models."

### Requirement: Slash command /temperature cambia el preset de temperatura
El sistema SHALL reconocer `/temperature low`, `/temperature medium`, y `/temperature high` como comandos client-side que cambian el preset de temperatura activo.

#### Scenario: /temperature low activa preset determinista
- **WHEN** el usuario ejecuta `/temperature low`
- **THEN** `temperaturePreset` se actualiza a `"low"`, el chip muestra un indicador, y los próximos requests incluyen `temperature_preset: "low"`

#### Scenario: /temperature sin argumento muestra opciones
- **WHEN** el usuario ejecuta `/temperature` sin argumento
- **THEN** el autocomplete muestra las tres opciones: `low (0.1)`, `medium (0.3)`, `high (0.7)` como sugerencias inline

#### Scenario: Preset persiste entre conversaciones
- **WHEN** el usuario cambia a `temperature_preset: "high"` y navega a una nueva conversación
- **THEN** el nuevo chat también usa `temperature_preset: "high"` (leído de localStorage)

### Requirement: Estado de inferencia visible en el input bar
El sistema SHALL mostrar el estado actual de los parámetros de inferencia en el chip del input bar, actualizado en tiempo real al ejecutar slash commands.

#### Scenario: Chip refleja modelo y temperatura activos
- **WHEN** el estado es `{ model: "qwen_coder", temperaturePreset: "high", thinking: false }`
- **THEN** el chip muestra "Qwen Coder 480B · High" (o representación compacta equivalente)

#### Scenario: Chip refleja thinking activo
- **WHEN** `thinking: true` está activo
- **THEN** el chip incluye un indicador visual de thinking (ej. ícono de rayo o texto "· Thinking")
