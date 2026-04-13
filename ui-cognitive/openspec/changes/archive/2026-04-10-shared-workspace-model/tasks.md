## 1. Types & Data Model

- [x] 1.1 Agregar `createdBy: { id: string; name: string }` a `StoredSession` en `types/chat.ts`
- [x] 1.2 Agregar helper `resolveCreatedBy(session: StoredSession)` en `lib/sessions.ts` que retorna `createdBy ?? { id: "system", name: "Sistema" }` (backfill lazy)

## 2. API — Crear sesión con createdBy

- [x] 2.1 Escribir test RED: POST /api/sessions crea sesión con `createdBy` del usuario autenticado
- [x] 2.2 Modificar `POST /api/sessions/route.ts` para extraer `userId` y `name` de la sesión NextAuth e inyectarlos como `createdBy` al crear la sesión
- [x] 2.3 Verificar test GREEN

## 3. API — Listar sesiones con createdBy

- [x] 3.1 Escribir test RED: GET /api/sessions incluye `createdBy` en cada sesión (con fallback para sesiones legacy)
- [x] 3.2 Modificar `GET /api/sessions/route.ts` para mapear sesiones aplicando `resolveCreatedBy` antes de serializar la respuesta
- [x] 3.3 Verificar test GREEN

## 4. API — DELETE con autorización creator-or-admin

- [x] 4.1 Escribir test RED: DELETE /api/sessions/[sessionKey] retorna 403 si el caller no es creator ni admin
- [x] 4.2 Escribir test RED: DELETE retorna 200 si el caller es el creator
- [x] 4.3 Escribir test RED: DELETE retorna 200 si el caller es admin (aunque no sea creator)
- [x] 4.4 Escribir test RED: DELETE retorna 403 para sesión legacy (createdBy.id === "system") cuando caller no es admin
- [x] 4.5 Modificar `DELETE /api/sessions/[sessionKey]/route.ts`: leer sesión, aplicar `resolveCreatedBy`, comparar `session.createdBy.id` con `userId` del caller; si no coincide y no es admin → 403
- [x] 4.6 Verificar todos los tests GREEN

## 5. UI — Creator badge en sidebar

- [x] 5.1 Actualizar tipo de sesión en el frontend (hook `useSessions`) para incluir `createdBy`
- [x] 5.2 Agregar función `getInitials(name: string): string` en sidebar o util: toma las primeras 2 iniciales en mayúscula
- [x] 5.3 Agregar badge circular con iniciales en cada sesión del sidebar (visible siempre en estado expandido)
- [x] 5.4 Usar el componente `Tooltip` existente (`components/ui/tooltip.tsx`) para mostrar "Creado por <name>" al hover sobre el badge
- [x] 5.5 Manejar caso especial: si `createdBy.id === "system"`, mostrar "?" como indicador neutral
- [x] 5.6 Verificar que click en el badge no navega ni dispara acciones

## 6. Tests de integración y verificación visual

- [x] 6.1 Escribir test del sidebar: renderiza badge de creador con iniciales correctas
- [x] 6.2 Escribir test del sidebar: sesión con createdBy.id === "system" muestra "?"
- [x] 6.3 Correr suite completa: `bun run test` sin regresiones
- [ ] 6.4 Verificar visualmente en dev: crear sesión, recargar sidebar, confirmar badge aparece
- [ ] 6.5 Verificar en dev: usuario B no puede borrar sesión creada por usuario A (espera 403)
- [ ] 6.6 Verificar en dev: admin puede borrar cualquier sesión
