## Why

Las sesiones en ui-cognitive son un workspace compartido de equipo pero no están modeladas como tal: cualquier usuario autenticado puede borrar sesiones de cualquier otro sin restricción, y no hay forma de saber quién creó qué. El modelo de propiedad implícito genera ambigüedad operativa y riesgo de pérdida accidental de trabajo ajeno.

## What Changes

- Agregar campo `createdBy` (userId + displayName) a la estructura de sesión, poblado al crear una sesión nueva
- Migrar sesiones existentes: backfill con `createdBy: { id: "unknown", name: "Sistema" }` si el campo no existe
- Proteger el endpoint `DELETE /api/sessions/[sessionKey]`: solo el creador de la sesión o un admin puede borrar
- Mostrar el creador en el sidebar al lado de cada sesión (ej. avatar inicial o tooltip "Creado por Nacho")
- Sesiones siguen siendo **read/write para todos** los usuarios autenticados (el workspace compartido se mantiene)

## Capabilities

### New Capabilities

- `session-ownership`: Registro de creador por sesión (campo `createdBy`), migración de datos existentes, y reglas de autorización para borrado
- `session-creator-display`: UI en el sidebar que muestra quién creó cada sesión

### Modified Capabilities

<!-- ninguna: no hay specs existentes en openspec/specs/ -->

## Impact

**API routes afectadas:**
- `app/api/sessions/route.ts` — POST debe inyectar `createdBy` al crear sesión
- `app/api/sessions/[sessionKey]/route.ts` — DELETE debe verificar que el caller es creator o admin

**Lib afectada:**
- `lib/sessions.ts` — función que persiste sesiones recibe y almacena `createdBy`

**Tipos afectados:**
- `types/chat.ts` — `StoredSession` agrega campo `createdBy: { id: string; name: string }`

**UI afectada:**
- `components/layout/sidebar.tsx` — mostrar iniciales/nombre del creador en cada sesión
- `app/api/sessions/route.ts` (GET) — incluir `createdBy` en la respuesta de lista

**Sin dependencias externas nuevas** — usa NextAuth session para obtener userId/name del caller.
