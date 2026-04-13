## Why

El agente solo puede usar dos modelos fijos (`devstral`, `kimi_reader`) sin forma de cambiarlos en runtime. Los usuarios necesitan poder elegir entre los mejores modelos de código disponibles en NVIDIA NIM y ajustar parámetros de inferencia clave (temperatura, thinking) desde el chat, sin reiniciar el backend.

## What Changes

- Agregar 7 nuevos modelos de código en `config.yml` bajo `llms:` (qwen3-coder-480b, codestral-22b, qwen2.5-coder-32b, deepseek-v3.2, kimi-k2-thinking, nemotron-super-49b, qwq-32b)
- Cambiar el backend para pre-buildear una caché `(mode, model_key, temperature_preset)` de `_ModeRuntime` en startup en lugar de una caché plana por modo
- Leer tres nuevos campos del request (`model`, `thinking`, `temperature_preset`) para seleccionar el runtime correcto
- Agregar forwarding de esos campos a través del pipeline Next.js → nat-client → backend
- Agregar tres slash commands en ui-cognitive: `/models`, `/thinking`, `/temperature`
- Agregar componente `ModelSelectorChip` en el input bar del chat (chip clickeable + dropdown)
- Persistir preferencias de modelo en `localStorage`

## Capabilities

### New Capabilities

- `model-registry`: Catálogo de modelos NIM disponibles con parámetros por defecto y metadatos (supports_thinking, display_name, tier)
- `runtime-cache`: Pre-build de runtimes indexados por `(mode, model_key, temperature_preset)` en startup del agente
- `inference-param-forwarding`: Pipeline de forwarding de parámetros de inferencia desde el frontend hasta el runtime del agente
- `slash-commands-inference`: Slash commands `/models`, `/thinking`, `/temperature` como comandos client-side que modifican estado local persistido
- `model-selector-component`: Componente chip + dropdown en el input bar del chat para cambio rápido de modelo

### Modified Capabilities

- `split-chat-layout`: El input bar incorpora el chip de selección de modelo a la izquierda del textarea, requiere ajuste de layout

## Impact

**Backend:**
- `src/cognitive_code_agent/configs/config.yml` — 7 nuevas entradas en `llms:`, nuevas entradas en `modes:` con `switchable_models` list
- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — refactor del startup de runtimes, nueva lógica de selección por request

**Frontend (ui-cognitive):**
- `lib/nat-client.ts` — nuevos campos en `StreamChatViaHttpInput` y body del POST
- `app/api/chat/route.ts` — forwarding de `model`, `thinking`, `temperature_preset`
- `lib/command-registry.ts` — 3 nuevos comandos
- `components/chat/chat-panel.tsx` — state management + command handlers
- `components/chat/model-selector.tsx` — nuevo componente

**Dependencias sin cambio:** NAT SDK, LangGraph, LangChain NVIDIA. No hay breaking changes en la API pública del agente.

**Startup overhead:** ~15-25s adicionales por la pre-build de los runtimes extra (2 modos × 9 modelos × 3 presets = ~54 graphs). Aceptable para un servidor long-running.
