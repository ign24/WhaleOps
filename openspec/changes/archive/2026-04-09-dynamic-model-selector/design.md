## Context

El agente usa `safe_tool_calling_agent.py` que construye `_ModeRuntime` objects en startup: uno por modo (`analyze`, `chat`, `execute`). Cada runtime contiene un LangGraph compilado con el LLM baked-in. Una vez compilado, el graph no puede cambiar su LLM sin ser reconstruido.

El frontend envía `{ sessionKey, messages }` al backend. No existe hoy ningún mecanismo de selección de modelo en runtime.

Confirmado mediante inspección del SDK:
- `NIMModelConfig` tiene `extra="allow"` — cualquier campo extra pasa directo a la NIM API
- `ChatRequest.model` existe en NAT SDK (`str | None`) pero el backend lo ignora
- LangChain `.bind(temperature=X)` genera `RunnableBinding` con override, pero requiere reconstruir el graph para ser efectivo

## Goals / Non-Goals

**Goals:**
- Soporte para 9 modelos de código en NVIDIA NIM (2 existentes + 7 nuevos)
- Selección de modelo por request sin reiniciar el backend
- 3 presets de temperatura: `low` (0.1), `medium` (0.3), `high` (0.7)
- Toggle `thinking` para modelos Nemotron (inyecta `/think`/`/no_think` en system prompt)
- Slash commands client-side: `/models`, `/thinking`, `/temperature`
- Chip de modelo en el input bar del chat
- Persistencia de preferencias en `localStorage`

**Non-Goals:**
- Temperatura arbitraria (valores libres como 0.42) — solo presets predefinidos
- Selección de modelo diferente por modo en la misma sesión
- Override de `top_p`, `top_k`, `seed` desde el UI
- Hot-reload de configuración de modelos sin restart
- Soporte thinking en modelos no-Nemotron

## Decisions

### D1: Pre-build de runtimes en startup vs. lazy init

**Decisión:** Pre-build en startup de todos los runtimes necesarios.

**Alternativas consideradas:**
- *Lazy init (build on first use)*: Menor overhead de startup, pero el primer request a un modelo nuevo tiene latencia de ~400ms extra. Inaceptable para UX de chat streaming.
- *Rebuild per-request*: Descartado — reconstruir un LangGraph por request es demasiado costoso (~200-400ms).
- *Pre-build en startup (elegido)*: Startup overhead ~20-30s para ~54 runtimes, pero luego cero latencia extra por selección de modelo.

**Clave de indexación:** `(mode, model_key, temperature_preset)`
- `mode`: `"analyze"` | `"execute"` | `"chat"`
- `model_key`: nombre lógico del LLM en config.yml (`"devstral"`, `"qwen_coder"`, etc.)
- `temperature_preset`: `"low"` | `"medium"` | `"high"` (chat mode usa siempre `"medium"`)

**Regla de fallback:** Si `(mode, model_key, temp)` no existe → `(mode, default_model, "medium")`.

### D2: Thinking — variante de config vs. toggle runtime

**Decisión:** Thinking como variante de config por modelo en `config.yml`. NO es una dimensión extra en la clave de caché.

**Razonamiento:** `ThinkingMixin` inyecta el system prompt `/think`/`/no_think` a nivel de LLM config, no en el request. Requiere un LLM construido diferente. Para simplificar la dimensión de la caché (ya tenemos 54 runtimes), thinking se maneja como:
- El modelo `nemotron_super` tiene dos entradas en config: `nemotron_super` y `nemotron_super_thinking`
- El frontend envía `model: "nemotron_super_thinking"` cuando thinking está ON
- Otros modelos no tienen variante thinking — el toggle de UI se desactiva para ellos

### D3: Forwarding de parámetros — body vs. headers

**Decisión:** Campos extra en el body JSON del POST.

**Alternativas:**
- *Custom headers (`X-Model-Override`, etc.)*: Requiere cambios en CORS config y es menos idiomático para una API REST.
- *Body JSON (elegido)*: `ChatRequest` tiene `extra="allow"` — los campos extra pasan directamente. El body ya es JSON, agregar campos es trivial.

**Campos nuevos en el body del POST `/chat/stream`:**
```json
{
  "messages": [...],
  "stream": true,
  "model": "qwen_coder",
  "temperature_preset": "high"
}
```

`thinking` se resuelve en el frontend como selección de modelo (`nemotron_super` vs `nemotron_super_thinking`) — no es un campo separado en el body.

### D4: Persistencia — localStorage vs. cookie vs. session state

**Decisión:** `localStorage` con clave `openclaw:inference-prefs`.

**Razonamiento:** Las preferencias de modelo son globales al usuario, no por conversación. `localStorage` es la opción más simple, no requiere backend, y persiste entre sesiones. Si en el futuro se quiere per-conversation, se puede migrar a conversation state.

### D5: UX del selector — chip permanente vs. slash command puro

**Decisión:** Chip permanente en el input bar + slash commands como atajos.

**Razonamiento:** El chip es siempre visible, muestra el estado actual, y permite cambiar en un click. Los slash commands (`/models`, `/thinking`, `/temperature`) son atajos para usuarios keyboard-first. Ambos modifican el mismo estado.

## Risks / Trade-offs

**[Startup time]** → 54 runtimes × ~400ms promedio = ~22s de overhead en startup. Mitigación: build en paralelo con `asyncio.gather`. Target: <15s extra total.

**[Memory footprint]** → 54 LangGraph graphs en memoria. Cada uno incluye tool schemas. Estimado: ~200MB extra. Mitigación: Monitorear en producción; si es problema, hacer lazy init solo para los 3 modelos Tier A menos usados.

**[Combinatorial explosion]** → Si se agregan más modos o presets en el futuro, la caché crece O(modes × models × presets). Mitigación: La dimensión temperature tiene techo en 3 presets; los modos son estables.

**[Nemotron thinking coupling]** → El toggle thinking en el frontend siempre selecciona `nemotron_super_thinking`. Si el usuario cambió a otro modelo, el toggle no hace nada. Mitigación: UI desactiva el toggle cuando el modelo activo no es Nemotron.

## Migration Plan

1. Agregar modelos nuevos a `config.yml` — backward compatible, no rompe nada
2. Deployar backend con la nueva caché — startup más largo pero mismo comportamiento para requests sin `model` override (fallback a defaults)
3. Deployar frontend con el chip y slash commands — usa el nuevo `model` field si está disponible, ignora si no

Rollback: revertir `config.yml` a versión anterior. Los runtimes extra simplemente no se buildean.

## Open Questions

- ¿Qué modelos de la lista soportan tool calling en NIM? Confirmar antes de incluir en la caché (los que no soporten tools fallarán en `bind_tools`). Investigar en task de implementación.
- ¿El startup paralelo de LangGraph graphs es thread-safe en NAT? Revisar si `_build_mode_runtime` puede llamarse con `asyncio.gather` o requiere serialización.
