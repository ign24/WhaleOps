# AGENTS Guide

This file is the operational guide for humans and LLMs contributing to `cognitive-bot`.

## 1) Project goal

`cognitive-bot` is a collaborative web UI for NAT (NVIDIA Agent Toolkit).

The system provides:

- Real-time chat to NAT
- Team-shared workspace (visible and reusable sessions)
- Sub-agent activity visibility
- Local user administration

The app acts as a BFF (Backend for Frontend): browser -> Next.js -> NAT.

## 2) Stack and key dependencies

- Next.js 16 App Router + React 19 + TypeScript
- Auth.js / NextAuth v5 (Credentials + JWT)
- Tailwind CSS v4
- NAT integration via HTTP SSE (`/chat/stream`)
- Local users stored in `data/users.json`

## 3) Architecture flow

1. User signs in at `/login`.
2. Auth.js issues a session JWT.
3. UI calls internal `/api/*` routes.
4. Server-side routes validate auth.
5. Next.js proxies to NAT without exposing internal topology to the browser.

## 4) Repository map

- `app/`
  - `app/(app)/chat/[sessionKey]/page.tsx`: main chat page
  - `app/api/chat/route.ts`: streaming endpoint
  - `app/api/observability/summary/route.ts`: observability aggregation endpoint
  - `app/api/sessions/route.ts`: list/create sessions
  - `app/api/sessions/[sessionKey]/route.ts`: patch/delete session metadata
  - `app/api/sessions/[sessionKey]/feedback/route.ts`: message/session feedback
  - `app/api/sessions/[sessionKey]/history/route.ts`: history
  - `app/api/users/*`: admin user operations
  - `app/api/health/route.ts`: NAT health
  - `app/api/tools/route.ts`: NAT tools list
- `components/chat/`: chat panel, markdown, autocomplete, command handling
- `components/activity/`: activity panel, timeline, tool calls, session summaries
- `components/observability/`: dashboard widgets for traces and costs
- `components/layout/`: sidebar, header, theme toggle
- `components/admin/`: user admin panel
- `lib/nat-client.ts`: HTTP SSE streaming logic
- `lib/users.ts`: JSON-file user CRUD
- `data/users.json`: persisted local users

## 5) Contracts and design decisions

- The UI must not call NAT directly from the client.
- Most API routes require an authenticated session.
- The chat supports local client commands (`/help`, `/tools`, `/status`, `/stop`, `/reset`).
- The chat supports passthrough commands (`/analyze`, `/quick-review`, `/refactor`, `/execute`) sent to NAT.
- `/analyze` and `/quick-review` are rewritten prompts; `/refactor` and `/execute` are forwarded as-is.

## 6) Local development

```bash
cp .env.example .env
bun install
bun dev
```

Required environment variables:

- `NAT_BACKEND_URL`
- `AUTH_SECRET`
- `AUTH_URL`

Initial local user data: `data/users.json`.

## 7) Contribution rules (humans + LLMs)

- Keep strict TypeScript and explicit API types.
- Reuse `lib/` utilities before creating new helpers.
- Never hardcode secrets in code, docs, or scripts.
- When touching auth, enforce role checks (`admin`) where needed.
- Keep API errors consistent (`error`, `status`, `code` when relevant).
- For streaming changes, handle cancellation (`AbortController`) and partial failures.
- Preserve existing visual language unless a redesign is explicitly requested.

## 8) Minimum pre-PR checklist

```bash
bun run lint
bun run test
bun run test:coverage
bun run build
```

When the change affects auth, chat streaming, sessions, admin flows, or test infrastructure, also run:

```bash
bun run test:e2e
```

Also verify:

- Login and access to `/chat/[sessionKey]`
- New session creation from sidebar
- Backend status via `/api/health`
- Basic user CRUD if admin features changed

CI notes:

- This repository currently defines backend CI workflows only.
- Run `bun run lint`, `bun run test:coverage`, `bun run build`, and optionally `bun run test:e2e` locally before PR.

## 9) Production deployment notes (EasyPanel)

- `ui` runs as an EasyPanel App Service.
- `nat` runs as an EasyPanel App Service.
- Internal NAT URL from `ui` is `http://cgn-agent_nat:8000`.

## 10) Operational guardrails

- Prefer EasyPanel UI operations over manual Swarm surgery.
- Do not restart or modify Traefik manually unless explicitly planned.
- Do not commit credentials or `.env` values.
- Keep bind mounts and file mounts explicit and documented.

## 11) Source of truth

- Local user store: `data/users.json`
- Base setup: `README.md`

If a decision is undocumented, prioritize simplicity, security, and compatibility with the current NAT flow.
