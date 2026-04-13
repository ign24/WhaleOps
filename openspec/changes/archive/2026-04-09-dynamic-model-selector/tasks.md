# Tasks: dynamic-model-selector

## Task 1: Verificar soporte de tool calling por modelo en NIM
**Spec:** runtime-cache
**Objective:** Confirmar qué modelos del catálogo soportan tool calling antes de configurarlos en `analyze`/`execute`.

- [x] 1.1 Llamar a la NIM API para cada modelo candidato y revisar capabilities de tool calling
- [x] 1.2 Hacer un test de `bind_tools` programático contra cada modelo NIM con un tool dummy
- [x] 1.3 Documentar qué modelos van en `switchable_models` de `analyze`/`execute` y cuáles solo en `chat`
- [x] 1.4 Actualizar la lista de `switchable_models` en `config.yml` basándose en los resultados

## Task 2: Agregar modelos al config.yml
**Spec:** model-registry
**Objective:** Registrar los 7 modelos nuevos en `config.yml` bajo `llms:` con parámetros optimizados para código.

- [x] 2.1 Agregar `qwen_coder` (qwen/qwen3-coder-480b-a35b-instruct) temperature=0.3, top_p=0.9, max_tokens=32768
- [x] 2.2 Agregar `codestral` (mistralai/codestral-22b-instruct-v0.1) temperature=0.3, max_tokens=32768
- [x] 2.3 Agregar `qwen_coder_32b` (qwen/qwen2.5-coder-32b-instruct) temperature=0.3, max_tokens=32768
- [x] 2.4 Agregar `deepseek_v3` (deepseek-ai/deepseek-v3.2) temperature=0.3, max_tokens=32768
- [x] 2.5 Agregar `kimi_thinking` (moonshotai/kimi-k2-thinking) temperature=0.3, max_tokens=32768
- [x] 2.6 Agregar `nemotron_super` (nvidia/llama-3.3-nemotron-super-49b-v1) temperature=0.3, max_tokens=32768
- [x] 2.7 Agregar `nemotron_super_thinking` (mismo model_name) con `thinking: true`
- [x] 2.8 Agregar `qwq` (qwen/qwq-32b) temperature=0.3, max_tokens=32768
- [x] 2.9 Agregar campo `switchable_models` a modos `analyze` y `execute` en `config.yml`

## Task 3: Refactorizar startup de runtimes en safe_tool_calling_agent.py
**Spec:** runtime-cache
**Objective:** Cambiar `mode_runtimes: dict[str, _ModeRuntime]` por `dict[tuple[str,str,str], _ModeRuntime]` con build paralelo.

- [x] 3.1 Escribir tests para key `(mode, model_key, temperature_preset)` y fallback (RED)
- [x] 3.2 Definir `TEMPERATURE_PRESETS = {"low": 0.1, "medium": 0.3, "high": 0.7}` en el módulo
- [x] 3.3 Agregar campo `switchable_models: list[str]` a `ModeConfig` con default `[]`
- [x] 3.4 Refactorizar `safe_tool_calling_agent_workflow` para construir la lista de combinaciones a buildear
- [x] 3.5 Implementar build paralelo con `asyncio.gather`, capturando excepciones por item sin fallar el conjunto
- [x] 3.6 Actualizar `_response_fn` para leer `model` y `temperature_preset` del request y hacer lookup con fallback
- [x] 3.7 Correr tests: `uv run pytest tests/ -x -q`

## Task 4: Forwarding de parámetros en el pipeline Next.js
**Spec:** inference-param-forwarding
**Objective:** Propagar `model` y `temperaturePreset` desde `/api/chat` hasta `/chat/stream`.

- [x] 4.1 Escribir tests para `streamChatViaHttp` verificando que incluye `model` y `temperature_preset` en el body (RED)
- [x] 4.2 Actualizar `StreamChatViaHttpInput` en `nat-client.ts` con `model?: string` y `temperaturePreset?: string`
- [x] 4.3 Incluir `model` y `temperature_preset` (snake_case) en el body JSON del fetch al backend
- [x] 4.4 Actualizar `route.ts`: extraer y pasar `body.model` y `body.temperaturePreset` a `streamChatViaHttp`
- [x] 4.5 Correr tests frontend: `cd ui-cognitive && bun run test`

## Task 5: State management y slash commands en chat-panel.tsx
**Spec:** slash-commands-inference, inference-param-forwarding
**Objective:** Estado de inferencia en localStorage y handlers para `/models`, `/thinking`, `/temperature`.

- [x] 5.1 Definir tipo `InferencePrefs` en `types/chat.ts`
- [x] 5.2 Crear hook `useInferencePrefs()` con localStorage y defaults
- [x] 5.3 Consumir `useInferencePrefs()` en `chat-panel.tsx` e incluir campos en el POST body
- [x] 5.4 Handler `/models`: interceptar antes de enviar al agente, abrir dropdown
- [x] 5.5 Handler `/thinking`: toggle con aviso si el modelo no es Nemotron
- [x] 5.6 Handler `/temperature [low|medium|high]`: actualizar preset con autocomplete si no hay argumento
- [x] 5.7 Agregar `/models`, `/thinking`, `/temperature` a `command-registry.ts`

## Task 6: MODEL_REGISTRY en el frontend
**Spec:** model-registry, model-selector-component
**Objective:** Catálogo de modelos con metadatos de display en constante reutilizable.

- [x] 6.1 Crear `lib/model-registry.ts` con tipo `ModelEntry` y array `MODEL_REGISTRY`
- [x] 6.2 Poblar con los 9 modelos visibles (excluir `nemotron_super_thinking` de la lista display)
- [x] 6.3 Exportar helper `getThinkingVariant(key: string): string | null`

## Task 7: Componente ModelSelectorChip
**Spec:** model-selector-component, split-chat-layout
**Objective:** Chip + dropdown en el input bar para selección de modelo, temperatura y thinking.

- [x] 7.1 Crear `components/chat/model-selector.tsx` con el componente `ModelSelectorChip`
- [x] 7.2 Chip: nombre corto del modelo activo + indicador de temperatura + ícono thinking si aplica
- [x] 7.3 Dropdown: modelos agrupados por tier, modelo activo marcado, cierre al click fuera
- [x] 7.4 Sección temperatura en el dropdown: botones Low/Medium/High con el activo marcado
- [x] 7.5 Toggle thinking: visible y activable solo cuando el modelo activo es `nemotron_super`
- [x] 7.6 Integrar con `useInferencePrefs()` para lectura/escritura de estado
- [x] 7.7 Agregar `ModelSelectorChip` al input bar en `chat-panel.tsx` a la izquierda del textarea
- [x] 7.8 Layout responsive: mobile = solo ícono, desktop = ícono + texto

## Task 8: Verificación end-to-end
**Spec:** inference-param-forwarding, slash-commands-inference
**Objective:** Confirmar que el modelo seleccionado llega al backend y se usa.

- [x] 8.1 Verificar logs de startup: runtimes buildeados, modelos incluidos/excluidos
- [x] 8.2 Enviar request con `model: "qwen_coder"` y verificar en logs que usa ese runtime
- [x] 8.3 Verificar metadata SSE event con model name correcto
- [x] 8.4 Probar `/models` en el chat: dropdown, selección, chip actualizado
- [x] 8.5 Probar `/thinking` con Nemotron: indicador visible, request usa `nemotron_super_thinking`
- [x] 8.6 Probar `/thinking` con modelo no-Nemotron: mensaje de aviso
- [x] 8.7 Probar `/temperature high`: log muestra runtime `("analyze", modelo, "high")`
- [x] 8.8 Probar fallback: modelo inexistente usa default + warning en log
