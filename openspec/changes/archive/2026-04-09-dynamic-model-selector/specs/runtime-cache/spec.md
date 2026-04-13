## ADDED Requirements

### Requirement: Pre-build de runtimes indexados por (mode, model, temperature_preset)
El sistema SHALL construir en startup una caché de `_ModeRuntime` objects indexada por la tupla `(mode: str, model_key: str, temperature_preset: str)`.

La caché SHALL cubrir:
- Modos `analyze` y `execute`: todos los modelos del catálogo × 3 temperature presets
- Modo `chat`: solo modelo `kimi_reader` con preset `medium` (sin variantes de temperatura)
- Los modelos que no soporten tool calling SHALL ser omitidos de `analyze`/`execute` con un warning en logs

#### Scenario: Runtime encontrado para combinación válida
- **WHEN** llega un request con `model="qwen_coder"` y `temperature_preset="high"` en modo `analyze`
- **THEN** el sistema retorna el `_ModeRuntime` pre-buildeado para `("analyze", "qwen_coder", "high")` sin construir nada nuevo

#### Scenario: Fallback cuando la combinación no existe
- **WHEN** llega un request con un `model_key` que no está en la caché para ese modo
- **THEN** el sistema usa el runtime default `(mode, default_model_for_mode, "medium")` y loguea un warning

#### Scenario: Modelo sin tool calling support omitido de analyze/execute
- **WHEN** el startup detecta que un modelo falla en `bind_tools` durante la construcción del runtime
- **THEN** el modelo es omitido de la caché para ese modo, se loguea un error descriptivo, y el servidor NO falla en el arranque

### Requirement: Build paralelo de runtimes en startup
El sistema SHALL construir los runtimes en paralelo usando `asyncio.gather` para minimizar el tiempo de startup adicional.

#### Scenario: Build paralelo completa sin errores
- **WHEN** el backend arranca con 9 modelos configurados
- **THEN** todos los runtimes buildables se construyen en menos de 30 segundos adicionales al tiempo de startup base

#### Scenario: Fallo de un modelo no bloquea el resto
- **WHEN** la construcción de un runtime falla (ej. modelo no disponible en NIM)
- **THEN** los demás runtimes continúan buildando y el servidor arranca con los modelos disponibles

### Requirement: Configuración de modelos switcheables por modo
El sistema SHALL permitir que cada modo en `config.yml` declare explícitamente qué modelos son seleccionables via el campo `switchable_models: list[str]`.

Si un modo no tiene `switchable_models`, solo se construye su `llm_name` default con los 3 presets de temperatura.

#### Scenario: Modo con switchable_models configurado
- **WHEN** `analyze.switchable_models: [devstral, qwen_coder, codestral, deepseek_v3, nemotron_super, nemotron_super_thinking, qwq]`
- **THEN** se construyen runtimes para cada modelo × 3 temperature presets

#### Scenario: Modo chat sin switchable_models
- **WHEN** `chat` mode no tiene `switchable_models`
- **THEN** solo se construye el runtime `("chat", "kimi_reader", "medium")`
