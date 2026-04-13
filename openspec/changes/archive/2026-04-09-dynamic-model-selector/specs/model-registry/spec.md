## ADDED Requirements

### Requirement: Catálogo de modelos disponibles en config.yml
El sistema SHALL definir todos los modelos LLM disponibles en `config.yml` bajo la clave `llms:`, cada uno con sus parámetros de inferencia optimizados para tareas de código.

El catálogo SHALL incluir los siguientes modelos con la clave lógica indicada:
- `devstral` → `mistralai/devstral-2-123b-instruct-2512` (existente)
- `kimi_reader` → `moonshotai/kimi-k2-instruct-0905` (existente, usado en chat mode)
- `qwen_coder` → `qwen/qwen3-coder-480b-a35b-instruct`
- `codestral` → `mistralai/codestral-22b-instruct-v0.1`
- `qwen_coder_32b` → `qwen/qwen2.5-coder-32b-instruct`
- `deepseek_v3` → `deepseek-ai/deepseek-v3.2`
- `kimi_thinking` → `moonshotai/kimi-k2-thinking`
- `nemotron_super` → `nvidia/llama-3.3-nemotron-super-49b-v1`
- `nemotron_super_thinking` → `nvidia/llama-3.3-nemotron-super-49b-v1` con `thinking: true`
- `qwq` → `qwen/qwq-32b`

#### Scenario: Modelo de código registrado con parámetros correctos
- **WHEN** el backend inicia y carga `config.yml`
- **THEN** cada modelo bajo `llms:` tiene `_type: nim`, `model_name` válido, `api_key: $NVIDIA_API_KEY`, y `max_tokens` >= 16384

#### Scenario: Modelo Nemotron con thinking habilitado
- **WHEN** se usa la clave `nemotron_super_thinking` en config.yml
- **THEN** la entrada incluye `thinking: true` y referencia el mismo `model_name` que `nemotron_super`

### Requirement: Metadatos de modelo accesibles en el frontend
El sistema SHALL exponer un endpoint o constante en el frontend que liste los modelos disponibles con sus metadatos de display:
- `key`: clave lógica (ej. `"devstral"`)
- `displayName`: nombre amigable (ej. `"Devstral 123B"`)
- `tier`: `"S"` | `"A"` | `"B"` indicando potencia relativa
- `supportsThinking`: `boolean` — true solo para `nemotron_super_thinking`
- `isThinkingVariant`: `boolean` — true solo para `nemotron_super_thinking`
- `defaultForMode`: lista de modos para los que es el default (`["analyze", "execute"]` para devstral)

#### Scenario: Lista de modelos disponible en el frontend
- **WHEN** el componente `ModelSelectorChip` se monta
- **THEN** muestra exactamente los modelos definidos en `MODEL_REGISTRY` excluyendo las variantes `_thinking` (que son internas al sistema thinking toggle)

#### Scenario: Modelo con thinking variant identificado
- **WHEN** el usuario activa `/thinking` y el modelo activo es `nemotron_super`
- **THEN** el frontend sustituye `model: "nemotron_super"` por `model: "nemotron_super_thinking"` en el request

### Requirement: Parámetros por temperatura preset
El sistema SHALL mapear cada preset de temperatura a un valor float fijo:
- `"low"` → `0.1` (determinista, ideal para code generation exacto)
- `"medium"` → `0.3` (default actual de devstral, balanced)
- `"high"` → `0.7` (más creativo, brainstorming)

#### Scenario: Preset medium es el default
- **WHEN** el usuario no ha modificado `/temperature`
- **THEN** el sistema usa `temperature_preset: "medium"` en todos los requests

#### Scenario: Preset low produce outputs más deterministas
- **WHEN** el usuario selecciona `/temperature low`
- **THEN** el runtime del agente usa `temperature: 0.1` para el LLM del modo activo
