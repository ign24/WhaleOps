# chat-autoscroll-behavior Specification

## Purpose
TBD - created by archiving change fix-chat-autoscroll-smoothness. Update Purpose after archive.
## Requirements
### Requirement: Auto-scroll SHALL reactivate on explicit return-to-bottom action
El panel de chat SHALL reactivar el seguimiento automático al último mensaje cuando el usuario active explícitamente la acción de “ir al último mensaje”.

#### Scenario: User clicks scroll-to-bottom while streaming
- **WHEN** el usuario está fuera del fondo del chat y pulsa el botón para ir al último mensaje durante un stream activo
- **THEN** el panel se desplaza al final
- **AND** el estado de auto-scroll queda reactivado para los siguientes chunks del mismo stream

### Requirement: Downward auto-scroll SHALL be smooth by default
El panel de chat SHALL usar desplazamiento suave por defecto para movimientos automáticos hacia el último mensaje, salvo cuando existan restricciones explícitas de movimiento reducido.

#### Scenario: Streaming appends new content with normal motion settings
- **WHEN** llegan nuevos chunks de respuesta y el chat está en modo de seguimiento al fondo
- **THEN** el desplazamiento hacia el último mensaje usa comportamiento `smooth`

#### Scenario: Reduced motion preference disables smooth behavior
- **WHEN** el usuario tiene habilitada la preferencia de sistema para reducir movimiento
- **THEN** el panel utiliza comportamiento `auto`/sin animación para el desplazamiento automático

