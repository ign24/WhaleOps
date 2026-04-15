# Cognitive Ops UI

Interfaz web para el ops-agent, construida con Next.js 16. Permite monitorear contenedores Docker en tiempo real, consultar notas operativas, administrar cron jobs y chatear con el agente via SSE.

## Que incluye

- Chat con streaming tipo SSE hacia NAT
- Dashboard de operaciones (`/ops`): estado de contenedores, notas SQLite y cron jobs sin pasar por el LLM
- Panel de actividad del agente con estado, timeline y resumen de sesion
- Dashboard de observabilidad (`/observability`) con metricas desde `TRACES_PATH`
- Comandos locales en chat (`/help`, `/tools`, `/status`, `/stop`, `/reset`)
- Panel admin para alta/activacion/desactivacion de usuarios
- Modo claro/oscuro con esquema de colores WhaleOps

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- NextAuth v5 (Credentials, JWT)
- Tailwind CSS v4
- NAT backend via HTTP SSE
- Bun para desarrollo local

## Catalogo de modelos (alineado con backend)

El selector de modelos usa `ui-cognitive/lib/model-registry.ts` y se mantiene alineado con
`src/cognitive_code_agent/configs/config.yml` (`workflow.modes.*.switchable_models`).

Catalogo canónico activo:

- `qwen_3_5_122b_a10b` → `qwen/qwen3.5-122b-a10b`
- `qwen_3_5_397b_a17b` → `qwen/qwen3.5-397b-a17b`
- `nemotron_3_super_120b_a12b` → `nvidia/nemotron-3-super-120b-a12b`
- `mistral_small_4_119b_2603` → `mistralai/mistral-small-4-119b-2603`

Notas:

- El backend resuelve runtimes por clave interna, no por display name.
- Para sesiones históricas, `resolveModelKey()` mantiene aliases legacy hacia estas claves canónicas.

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

Credenciales locales por defecto: revisar `data/users.json` y definir password fuera del repo.

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

```bash
E2E_EMAIL=e2e-admin@cgn.local E2E_PASSWORD=e2e-password-123 node scripts/seed-e2e-user.mjs
E2E_EMAIL=e2e-admin@cgn.local E2E_PASSWORD=e2e-password-123 bun run test:e2e
```

Si no seteas `E2E_EMAIL`/`E2E_PASSWORD`, los tests de Playwright se marcan como `skip`.

## Estructura principal

- `app/`: rutas App Router y endpoints API
  - `/api/chat` — proxy SSE al backend NAT
  - `/api/sessions` — listado de sesiones
  - `/api/users` — admin de usuarios
  - `/api/health`, `/api/tools` — estado del sistema
  - `/api/observability/summary` — resumen de trazas
  - `/api/ops/status` — proxy autenticado a `${NAT_BACKEND_URL}/api/ops/status`
  - `/api/ops/notes` — proxy autenticado a `${NAT_BACKEND_URL}/api/ops/notes`
  - `/api/ops/containers/[container]/inspect` — detalle bajo demanda
  - `/api/ops/containers/[container]/logs` — logs recientes bajo demanda
- `components/`: UI de chat, layout, actividad y admin
- `lib/`: cliente NAT, normalizadores y utilidades
- `data/users.json`: usuarios locales (source of truth para auth)

## Arquitectura de alto nivel

```text
Browser
  -> Next.js app (auth + UI + API routes)
  -> NAT backend (127.0.0.1:8000)
```

Las API routes validan sesion antes de proxear al backend NAT.

## Dashboard de operaciones (/ops)

La pagina `/ops` muestra estado Docker en tiempo real sin pasar por el agente LLM:

- **Contenedores**: polling cada 30s a `/api/ops/status` — nombre, imagen, estado, uptime
- **Notas**: polling cada 60s a `/api/ops/notes` — instrucciones, patrones, summaries
- **Cron jobs**: polling cada 30s a `/api/jobs` — jobs activos con expresion cron

Los datos se obtienen directo del backend FastAPI y no consumen tokens del LLM.

## Comandos de chat

### Comandos locales (resueltos en frontend)

- `/help` — lista de comandos disponibles
- `/tools` — herramientas activas del agente
- `/status` — estado del backend NAT
- `/reset` — nueva sesion
- `/stop` — interrumpe la generacion actual

## Nota operativa (produccion)

- **Dashboard de trazas**: el resumen se calcula en UI sobre `TRACES_PATH`. En EasyPanel, validar que ese path este montado en el servicio `ui` en modo lectura.
- **Dashboard /ops**: los datos vienen del backend NAT. Si la UI no puede alcanzar `NAT_BACKEND_URL`, las cards mostraran error con boton de retry.

## Deploy en VPS (Docker)

Prerequisitos:

- NAT backend en el mismo VPS (idealmente `127.0.0.1:8000`)
- `.env` configurado con URL y secretos

```bash
docker compose up -d --build
```

El servicio expone internamente el puerto `3000` dentro de la red Docker y monta `./data` para persistir usuarios.

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
- `ARCHITECTURE.md`: arquitectura del backend NAT
