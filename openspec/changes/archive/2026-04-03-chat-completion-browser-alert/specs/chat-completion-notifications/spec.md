## ADDED Requirements

### Requirement: Chat notifica finalización de ejecución del agente
El sistema SHALL mostrar una señal de finalización cuando una ejecución del agente termina en el chat. La señal SHALL ser no intrusiva, de bajo acoplamiento y sin requerir cambios en backend.

#### Scenario: Toast local al finalizar respuesta
- **WHEN** una solicitud de chat termina su ciclo de stream y el agente deja de procesar
- **THEN** la interfaz muestra un toast temporal indicando que la respuesta está lista

#### Scenario: Aviso mientras la pestaña no está activa
- **WHEN** una solicitud termina y la pestaña del chat está oculta
- **THEN** el sistema intenta emitir una notificación del navegador si existe permiso
- **AND** el título de la pestaña se marca temporalmente con indicador de atención

#### Scenario: Fallback seguro sin soporte de notificaciones
- **WHEN** el navegador no soporta Notification API o el permiso fue denegado
- **THEN** la ejecución termina sin errores adicionales
- **AND** al menos la señal local en UI permanece disponible
