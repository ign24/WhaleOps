## Capability: workspace-folder-card

La tarjeta de filesystem SHALL reflejar el estado de `sandbox/workspace` del runtime del agente, no del contenedor de UI.

---

### Requirement: folder-card-data-source-is-agent-runtime

`FolderCard` SHALL obtener roots y árbol de archivos a través de endpoints BFF que proxyean al backend NAT (`agent`) como source of truth.

#### Scenario: roots visibles desde backend agent

WHEN el usuario autenticado abre una sesión de chat
AND `ui-cognitive` puede alcanzar `${NAT_BACKEND_URL}/workspace/roots`
THEN `/api/workspace/roots` responde roots provenientes del backend agent
AND la tarjeta muestra secciones para `sandbox` y `workspace` según esos roots

#### Scenario: tree leído desde backend agent

WHEN la tarjeta solicita `/api/workspace/tree?path=/app/workspace`
AND el backend agent responde con `WorkspaceTreeResponse`
THEN la tarjeta renderiza el árbol y métricas (`totalFiles`, `totalDirs`, `truncated`) usando esa respuesta

---

### Requirement: folder-card-failure-maps-upstream-errors

Errores de backend SHALL propagarse de forma controlada para evitar falsos mensajes de inaccesibilidad local.

#### Scenario: backend no disponible

WHEN `ui-cognitive` no puede conectarse a `${NAT_BACKEND_URL}`
THEN `/api/workspace/roots` y `/api/workspace/tree` responden error 502 con payload consistente
AND la tarjeta muestra estado de error sin asumir ausencia de mounts locales
