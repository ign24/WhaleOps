## Context

ui-cognitive gestiona sesiones como archivos JSON en `data/sessions/`. Actualmente la estructura de sesión no tiene metadatos de autoría — solo `id`, `messages`, `createdAt`, `updatedAt`. El sidebar lista todas las sesiones sin indicar quién las creó. Los endpoints de sesión solo verifican autenticación (cualquier usuario logueado puede operar sobre cualquier sesión).

La app es un workspace de equipo: múltiples usuarios comparten el mismo agente y ven las mismas sesiones. El problema no es falta de privacidad sino falta de contexto (¿de quién es esta sesión?) y falta de guardrail de borrado.

## Goals / Non-Goals

**Goals:**
- Registrar `createdBy` al crear una sesión nueva (userId + displayName del usuario autenticado)
- Backfill silencioso: sesiones sin `createdBy` se tratan como del sistema (no bloquean lectura/uso)
- DELETE de sesión: solo creator o admin puede borrar; resto recibe 403
- Sidebar muestra iniciales del creador en cada sesión con tooltip de nombre completo

**Non-Goals:**
- Sesiones privadas / ocultas por usuario (el workspace sigue siendo 100% compartido)
- Permisos de escritura por sesión (cualquiera puede agregar mensajes a cualquier sesión)
- Transferencia de ownership entre usuarios
- Historial de ediciones / audit log completo

## Decisions

### D1: Almacenar `createdBy` en el JSON de sesión, no en una tabla separada

**Alternativas consideradas:**
- A) Base de datos (Postgres/SQLite) con tabla `session_owners`
- B) Archivo `data/session-owners.json` separado
- C) Inline en el JSON de sesión (elegida)

**Rationale:** El storage ya es filesystem JSON por sesión. Agregar una tabla o archivo separado introduce complejidad de sincronización sin beneficio real para el alcance actual (equipo pequeño, &lt;1000 sesiones). Inline es la opción de menor fricción y más coherente con la arquitectura existente.

### D2: `createdBy` como objeto `{ id: string; name: string }` no solo userId

**Rationale:** El `name` se usa directamente en UI sin hacer un segundo fetch a `/api/users`. Si el usuario cambia su nombre en el futuro, la sesión histórica mantiene el nombre original (correcto para auditoría). Evita el lookup en tiempo de render.

### D3: Backfill lazy (en lectura) en lugar de script de migración

**Alternativas consideradas:**
- A) Script de migración que toca todos los JSONs en `data/sessions/`
- B) Backfill lazy: si `createdBy` no existe, retornar `{ id: "system", name: "Sistema" }` (elegida)

**Rationale:** La opción B es segura y no requiere downtime ni riesgo de corrupción de 250+ archivos. Las sesiones antiguas muestran "Sistema" como creador, lo cual es correcto semánticamente.

### D4: Verificación de permisos de DELETE en la API route, no en middleware

**Rationale:** La lógica requiere leer el JSON de la sesión para obtener `createdBy.id` y compararlo con el userId del caller. Esto no puede hacerse en middleware sin leer el archivo (costoso). La route handler ya tiene acceso al session store.

### D5: Iniciales en sidebar, tooltip con nombre completo

**Rationale:** El sidebar es denso. Un avatar de 2 letras ocupa mínimo espacio y da contexto visual rápido. El nombre completo aparece en tooltip para no saturar la UI.

## Risks / Trade-offs

**[Risk] Colisión de nombres en `createdBy.name`** → Mitigation: se usa `id` para comparación de ownership; `name` es solo display. No hay ambigüedad funcional.

**[Risk] Usuario eliminado sigue apareciendo como creador** → Mitigation: mostramos el nombre guardado en el JSON (funciona como snapshot histórico). Aceptable para el alcance actual.

**[Risk] Sesión `main` tiene semántica especial** → Mitigation: `main` se comporta igual que cualquier otra sesión. Si no tiene `createdBy`, es "Sistema". Puede borrarse solo por admin (ya que `createdBy.id === "system"` nunca iguala al userId de ningún usuario real).

## Migration Plan

1. Deploy: el código nuevo empieza a escribir `createdBy` en sesiones nuevas
2. Sesiones existentes sin `createdBy` reciben fallback en runtime: `{ id: "system", name: "Sistema" }`
3. No hay rollback necesario — el campo es aditivo; código anterior lo ignora si se hace rollback

## Open Questions

- ¿La sesión `main` debería ser protegida explícitamente (no borrable por nadie, solo admin)? → Por ahora se trata igual que el resto.
