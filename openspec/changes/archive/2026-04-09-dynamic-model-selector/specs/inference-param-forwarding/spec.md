## ADDED Requirements

### Requirement: Campos de inferencia en el body del POST al backend
El sistema SHALL incluir los parámetros de inferencia seleccionados en el body JSON del POST a `/chat/stream`:
- `model: string` — clave lógica del modelo (ej. `"qwen_coder"`)
- `temperature_preset: "low" | "medium" | "high"` — preset de temperatura

#### Scenario: Request con modelo y temperatura custom
- **WHEN** el usuario tiene `model="qwen_coder"` y `temperature_preset="high"` en localStorage
- **THEN** el body del POST a `/chat/stream` incluye `{ messages, stream: true, model: "qwen_coder", temperature_preset: "high" }`

#### Scenario: Request sin preferencias guardadas usa defaults
- **WHEN** localStorage no tiene `openclaw:inference-prefs`
- **THEN** el body incluye `{ messages, stream: true, model: "devstral", temperature_preset: "medium" }`

### Requirement: Forwarding completo a través del pipeline Next.js
El sistema SHALL propagar los parámetros de inferencia sin pérdida a través de la cadena:
`chat-panel → POST /api/chat → route.ts → nat-client → POST /chat/stream`

#### Scenario: route.ts forwarding sin mutación
- **WHEN** `route.ts` recibe `body.model = "qwen_coder"` y `body.temperature_preset = "high"`
- **THEN** pasa exactamente esos valores a `streamChatViaHttp` sin transformar

#### Scenario: nat-client incluye campos en el body
- **WHEN** `streamChatViaHttp` recibe `model` y `temperaturePreset`
- **THEN** el body del fetch a `${backendUrl}/chat/stream` incluye `model` y `temperature_preset` (snake_case para el backend Python)

### Requirement: Backend lee los parámetros via ChatRequest extra fields
El sistema SHALL leer `model` y `temperature_preset` del `ChatRequest` usando `getattr` con defaults seguros, dado que son extra fields (`extra="allow"`).

#### Scenario: Backend selecciona runtime correcto desde los extra fields
- **WHEN** el body tiene `{ model: "qwen_coder", temperature_preset: "high" }`
- **THEN** `safe_tool_calling_agent._response_fn` construye la key `(mode, "qwen_coder", "high")` y retorna el runtime correspondiente

#### Scenario: Campos ausentes usan defaults del modo
- **WHEN** el body no incluye `model` o `temperature_preset`
- **THEN** el backend usa `default_model_for_mode` y `"medium"` respectivamente

### Requirement: El modelo activo se refleja en el stream de respuesta
El sistema SHALL incluir el `model_name` del runtime seleccionado en el stream de respuesta (campo `model` en `ChatResponseChunk`), para que el frontend pueda confirmar qué modelo respondió.

#### Scenario: Metadata event incluye modelo activo
- **WHEN** el agente comienza a streamear tokens
- **THEN** el event de metadata SSE incluye `{ model: "qwen/qwen3-coder-480b-a35b-instruct", provider: "nat" }`
