## ADDED Requirements

### Requirement: Página /ops accesible desde el sidebar
El sistema SHALL exponer una ruta `/ops` en Next.js bajo `app/(app)/ops/page.tsx`. El sidebar SHALL incluir un link a `/ops` visible para todos los usuarios autenticados.

#### Scenario: Navegación al dashboard desde sidebar
- **WHEN** el usuario hace click en el link de ops en el sidebar
- **THEN** el sistema navega a `/ops` y renderiza el dashboard sin recargar la página

#### Scenario: Link activo cuando la ruta es /ops
- **WHEN** la URL actual es `/ops`
- **THEN** el link en el sidebar aparece en estado activo (highlighted)

### Requirement: Sección de containers con polling automático
La página `/ops` SHALL mostrar una tabla de containers Docker con los campos: nombre, imagen, status, uptime y puertos expuestos. Los datos SHALL actualizarse automáticamente cada 30 segundos usando SWR con `refreshInterval`. La URL del endpoint SHALL ser relativa (`/api/ops/status`) sin hostname hardcodeado.

#### Scenario: Tabla de containers cargada exitosamente
- **WHEN** el componente monta y el endpoint `/api/ops/status` responde con datos
- **THEN** se renderiza una fila por container con nombre, imagen, status badge, uptime y puertos

#### Scenario: Badge de status diferenciado por estado
- **WHEN** un container tiene status "running"
- **THEN** el badge es verde; si es "exited" es gris; si es "restarting" es amarillo

#### Scenario: Error de conexión Docker
- **WHEN** `/api/ops/status` retorna 503
- **THEN** la sección muestra un mensaje de error con el texto del servidor y un botón de retry manual

#### Scenario: Loading state inicial
- **WHEN** los datos aún no han llegado (primer fetch)
- **THEN** la tabla muestra un skeleton loader

### Requirement: Sección de cron jobs activos
La página `/ops` SHALL mostrar los cron jobs activos obtenidos del endpoint existente `/api/jobs/cron`. Los datos SHALL actualizarse cada 60 segundos. La sección SHALL reusar los tipos `CronJobItem` ya definidos en el frontend.

#### Scenario: Lista de jobs activos
- **WHEN** hay jobs con status "active"
- **THEN** se muestra nombre, expresión cron y próxima ejecución para cada uno

#### Scenario: Sin jobs activos
- **WHEN** el endpoint retorna lista vacía
- **THEN** la sección muestra "Sin tareas programadas"

### Requirement: Sección de notas recientes
La página `/ops` SHALL mostrar las últimas 10 notas del endpoint `/api/ops/notes`. La sección SHALL agrupar visualmente por tipo (`anomaly`, `pattern`, `instruction`, `daily_summary`). La URL SHALL ser relativa sin hostname.

#### Scenario: Notas agrupadas por tipo
- **WHEN** hay notas de distintos tipos
- **THEN** cada nota muestra un chip con su tipo y el contenido truncado a 2 líneas

#### Scenario: Sin notas registradas
- **WHEN** el endpoint retorna lista vacía
- **THEN** la sección muestra "Sin notas registradas"

#### Scenario: Nota de tipo anomaly destacada
- **WHEN** una nota tiene tipo "anomaly"
- **THEN** se renderiza con borde o fondo diferenciado respecto a otros tipos

### Requirement: Header de estado general
La página SHALL mostrar un header con el conteo de containers: "N running / M total". El header SHALL actualizarse con cada poll de containers.

#### Scenario: Conteo correcto al cargar
- **WHEN** los datos de containers están disponibles
- **THEN** el header muestra el número exacto de containers en estado "running" sobre el total
