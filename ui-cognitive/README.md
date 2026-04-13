# Cognitive Bot UI

Interfaz web colaborativa para NAT (NVIDIA Agent Toolkit), construida con Next.js 16.

Permite trabajar sesiones compartidas, ver historial, monitorear subagentes en tiempo real y administrar usuarios locales con autenticacion por credenciales.

## Que incluye

- Chat con streaming tipo SSE hacia NAT
- Workspace compartido (todas las sesiones visibles para el equipo)
- Panel de actividad de subagentes con estado, timeline y resumen de sesion
- Tarjeta de filesystem (sandbox/workspace) obtenida via backend NAT (source of truth del runtime)
- Dashboard de observabilidad (`/observability`) con metricas desde `TRACES_PATH`
- Comandos locales en chat (`/help`, `/tools`, `/status`, `/stop`, `/reset`)
- Comandos passthrough al agente (`/analyze`, `/quick-review`, `/refactor`, `/execute`)
- Panel admin para alta/activacion/desactivacion de usuarios
- Modo claro/oscuro y UI neumorfica

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- NextAuth v5 (Credentials, JWT)
- Tailwind CSS v4
- NAT backend via HTTP SSE
- Bun para desarrollo local
- Docker Compose para despliegue en VPS

## Catalogo de modelos (alineado con backend)

El selector de modelos usa `ui-cognitive/lib/model-registry.ts` y debe mantenerse alineado con los modelos switchables definidos en `src/cognitive_code_agent/configs/config.yml`.

Modelos visibles en frontend:

- `devstral`
- `qwen_coder`
- `deepseek_v3`
- `glm_4_7`
- `step_3_5_flash`
- `kimi_reader`
- `kimi_thinking`
- `nemotron_super`
- `gemma_4_31b_it` (vision)

Notas:

- `nemotron_super_thinking` se maneja como variante interna del toggle thinking sobre `nemotron_super`.
- El backend tambien define modelos no expuestos en el picker por default (`codestral`, `qwen_coder_32b`, `qwq`) para uso operativo/configurable.

## Requisitos

- Bun instalado
- NAT backend accesible (por defecto `http://127.0.0.1:8000`)

## Inicio rapido (local)

```bash
cp .env.example .env
# completa NAT_BACKEND_URL y AUTH_SECRET
bun install
bun dev
```

Abrir `http://localhost:3000`.

Credenciales locales por defecto: revisar `data/users.json` (email) y definir password local fuera del repo.

## Variables de entorno

Tomar como base `.env.example`:

| Variable | Requerida | Descripcion |
| --- | --- | --- |
| `NAT_BACKEND_URL` | Si | URL del backend NAT |
| `NAT_CHAT_TIMEOUT_MS` | No | Timeout maximo del chat |
| `TRACES_PATH` | No | Ruta al JSONL de trazas NAT para dashboard de observabilidad |
| `OBS_COST_INPUT_PER_1K` | No | Costo USD estimado por 1K tokens de input |
| `OBS_COST_OUTPUT_PER_1K` | No | Costo USD estimado por 1K tokens de output |
| `AUTH_SECRET` | Si | Secreto de Auth.js |
| `AUTH_URL` | Si | URL publica/base de auth |
| `NEXTAUTH_SECRET` | No | Alias retrocompatible de `AUTH_SECRET` |

## Scripts

```bash
bun dev      # entorno local
bun run lint # eslint
bun run test # vitest
bun run test:coverage # cobertura (v8)
bun run test:e2e # playwright
bun run test:all # coverage + e2e
bun run build
```

### E2E local

Los tests E2E requieren un usuario local valido.

```bash
E2E_EMAIL=e2e-admin@cgn.local E2E_PASSWORD=e2e-password-123 node scripts/seed-e2e-user.mjs
E2E_EMAIL=e2e-admin@cgn.local E2E_PASSWORD=e2e-password-123 bun run test:e2e
```

Si no seteas `E2E_EMAIL`/`E2E_PASSWORD`, los tests de Playwright se marcan como `skip`.

## Estructura principal

- `app/`: rutas App Router y endpoints API (`/api/chat`, `/api/sessions`, `/api/users`, `/api/health`, `/api/tools`, `/api/observability/summary`)
- `components/`: UI de chat, layout y admin
- `lib/`: cliente NAT, normalizadores y utilidades
- `data/users.json`: usuarios locales (source of truth para auth)
- `docs/`: especificaciones y documentacion operativa

## Arquitectura de alto nivel

```text
Browser
  -> Next.js app (auth + UI + API routes)
  -> NAT backend (127.0.0.1:8000)
```

- Las API routes validan sesion antes de proxear al backend NAT
- `/api/workspace/roots` y `/api/workspace/tree` proxyean al backend NAT para evitar depender del filesystem local del contenedor UI

## Nota operativa (produccion)

- **Workspace/Sandbox card**: los datos vienen del servicio `agent` (NAT backend). Si la UI esta autenticada pero no puede alcanzar `NAT_BACKEND_URL`, la card mostrara error upstream.
- **Dashboard de trazas**: el resumen de trazas se calcula en UI sobre `TRACES_PATH`. En EasyPanel, valida que ese path este montado en el servicio `ui` en modo lectura; si no, veras volumen de requests en 0 aunque el backend procese ejecuciones.

## Comandos de chat

### Comandos locales (resueltos en frontend)

- `/help`
- `/tools`
- `/status`
- `/reset`
- `/stop`

### Comandos passthrough al agente

- `/analyze <repo|url|contexto>`
  - se transforma en prompt `full analysis ...`
  - pensado para auditoria completa (code review, security, QA y docs)
- `/quick-review <repo|url|contexto>`
  - se transforma en prompt `quick review ...`
  - pensado para revision rapida con menor costo/latencia
- `/refactor <instruccion>`
  - se envia al backend NAT manteniendo el prefijo `/refactor`
  - pensado para modificaciones de codigo asistidas
- `/execute <instruccion>`
  - se envia al backend NAT manteniendo el prefijo `/execute`
  - pensado para operaciones de ejecucion/git en modo controlado

Estos comandos no se ejecutan localmente: son passthrough al backend NAT.

## Deploy en VPS (Docker)

Prerequisitos:

- NAT backend en el mismo VPS (idealmente `127.0.0.1:8000`)
- `.env` configurado con URL y secretos

```bash
docker compose up -d --build
```

El servicio expone internamente el puerto `3000` dentro de la red Docker (`expose`) y monta `./data` para persistir usuarios.
Para el dashboard, el compose tambien monta `../traces` en `/app/traces` (solo lectura).

## Calidad y verificacion

Antes de mergear cambios:

```bash
bun run lint
bun run test
bun run test:coverage
bun run build
```

Para validar journeys de usuario (login/chat/admin):

```bash
bun run test:e2e
```

## Documentacion relacionada

- `AGENTS.md`: guia para desarrolladores y LLMs que trabajen en este repo
