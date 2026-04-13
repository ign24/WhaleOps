## Context

Estado actual:

- `ui-cognitive/app/api/workspace/tree/route.ts` usa `fs` local en el contenedor de UI.
- `ui-cognitive/app/api/workspace/roots/route.ts` responde roots estáticos locales.
- `FolderCard` consume esos endpoints y muestra error por root cuando recibe 4xx/5xx.

Problema: en EasyPanel, `ui` y `agent` son servicios aislados. El filesystem relevante vive en `agent`, no en `ui`.

## Goals / Non-Goals

**Goals**
- Garantizar que la card de filesystem refleje el runtime real del agente.
- Evitar necesidad de mounts de `/tmp/analysis` y `/app/workspace` en el servicio `ui`.
- Mantener superficie read-only y path guardrails equivalentes a los actuales.

**Non-Goals**
- No agregar edición/escritura de archivos desde la UI.
- No cambiar la UX principal de la card (polling, refresh, secciones).
- No reemplazar el modelo de auth actual de `ui-cognitive`.

## Decisions

1. **Backend `agent` como source of truth para filesystem**
   - Se agregan endpoints HTTP en FastAPI del backend:
     - `GET /workspace/roots`
     - `GET /workspace/tree?path=...`
   - Reutilizan la misma política de roots permitidos (`/tmp/analysis`, `/app/workspace`, configurable por env).

2. **`ui-cognitive` mantiene auth y actúa como BFF proxy**
   - Las rutas `ui-cognitive/app/api/workspace/*` validan sesión como hoy.
   - Luego proxyean al backend (`NAT_BACKEND_URL`) y normalizan errores upstream.
   - Ventaja: no se expone backend directo al browser y se conserva contrato frontend estable.

3. **Compatibilidad de contrato de respuesta**
   - El JSON de `WorkspaceTreeResponse` se mantiene para no romper `FolderCard`/`TreeNode`.
   - Se preservan límites de profundidad/nodos y comportamiento de truncado.

## Risks / Trade-offs

- **[Risk] Endpoint backend sin auth propia**
  - Mitigación: exposición interna de red (EasyPanel private network) + auth en BFF.
  - Seguimiento opcional: token interno `UI_BACKEND_SHARED_TOKEN` en fase posterior.

- **[Risk] Error de conectividad backend impacta card**
  - Mitigación: mensajes de error explícitos por root, refresh manual y polling conservado.

- **[Risk] Duplicación de lógica de árbol entre TS y Python durante migración**
  - Mitigación: remover dependencia de `fs` local en UI cuando proxy quede activo y centralizar validación en backend.
