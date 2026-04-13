## ADDED Requirements

### Requirement: Panel de actividad no anima apertura en navegación

El panel de actividad desktop NO SHALL ejecutar animación de entrada al navegar entre sesiones cuando el panel ya estaba abierto.

#### Scenario: Navegar a otro chat con panel abierto

- **WHEN** el usuario navega de `/chat/A` a `/chat/B` con el panel de actividad abierto
- **THEN** el panel aparece visible instantáneamente sin animación de apertura

#### Scenario: Abrir panel explícitamente sí anima

- **WHEN** el usuario hace clic en "Mostrar panel de actividad" con el panel cerrado
- **THEN** el panel anima su apertura (width 0 → 380px)

### Requirement: Workspace log pre-poblado desde historial

Al cargar una sesión existente que tiene mensajes con actividad registrada, el `SessionWorkspace` SHALL mostrar los datos acumulados de esa sesión sin requerir que el usuario envíe un nuevo mensaje.

#### Scenario: Sesión con historial de actividad

- **WHEN** el usuario navega a una sesión que tiene mensajes con `intermediateSteps`
- **THEN** el `SessionWorkspace` muestra archivos leídos, modificados y comandos ejecutados de esa sesión

#### Scenario: Sesión sin actividad registrada

- **WHEN** el usuario navega a una sesión sin `intermediateSteps` en ningún mensaje
- **THEN** el `SessionWorkspace` permanece oculto (comportamiento existente)

#### Scenario: Streaming nuevo acumula sobre historial

- **WHEN** el usuario envía un nuevo mensaje en una sesión con historial de actividad
- **THEN** las nuevas entradas de actividad se acumulan encima de las históricas en el workspace

### Requirement: activityLog permanece efímero

El `activityLog` (feed del timeline en vivo) SHALL seguir iniciando vacío al cargar cualquier sesión, independientemente del historial.

#### Scenario: Timeline muestra estado inicial vacío

- **WHEN** el usuario navega a una sesión existente sin streaming activo
- **THEN** el `ActivityTimeline` muestra "Sin actividad todavía"
