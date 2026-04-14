## ADDED Requirements

### Requirement: Strategic KPIs for ops dashboard
La pagina `/ops` SHALL mostrar un bloque de senales estrategicas con los KPIs: `running/total`, `degradados`, `jobs activos`, `latencia promedio` y `errores`, calculados desde fuentes existentes (`/api/ops/status`, `/api/jobs/cron`, `/api/observability/summary`) sin crear ruido visual adicional.

#### Scenario: all sources available
- **WHEN** las tres fuentes responden correctamente
- **THEN** el dashboard renderiza los cinco KPIs con valores numericos y timestamp de generacion

#### Scenario: partial source degradation
- **WHEN** una fuente falla pero las otras responden
- **THEN** el dashboard mantiene KPIs disponibles, marca la fuente fallida como degradada y evita bloquear toda la vista

### Requirement: Exception-only alerts policy
El dashboard SHALL mostrar alertas unicamente para excepciones operativas accionables (contenedores degradados, umbral de latencia superado, errores por encima de umbral, fallo de fuente critica). El dashboard SHALL omitir alertas informativas de estado normal.

#### Scenario: no exception no alert
- **WHEN** todos los KPIs estan dentro de umbrales normales
- **THEN** no se muestra ningun banner/alerta de warning o error

#### Scenario: degraded containers alert
- **WHEN** existe al menos un contenedor con estado degradado
- **THEN** se muestra una alerta de excepcion con conteo y nombres de contenedores afectados

### Requirement: Optional container drill-down
El dashboard SHALL ofrecer drill-down opcional por contenedor para logs/inspect bajo demanda del usuario, sin cargar esos datos en el render inicial.

#### Scenario: drill-down on demand
- **WHEN** el usuario abre detalle de un contenedor
- **THEN** el dashboard solicita logs/inspect solo para ese contenedor y muestra resultado o estado degradado si no disponible

#### Scenario: initial render without drill-down load
- **WHEN** el usuario entra a `/ops`
- **THEN** no se ejecutan consultas de logs/inspect hasta que el usuario interactua con drill-down

### Requirement: KPI and alert logic covered by tests
La logica de agregacion de KPIs y politicas de alertas SHALL tener cobertura de pruebas unitarias bajo enfoque TDD (RED -> GREEN -> REFACTOR), incluyendo casos normales y degradados.

#### Scenario: deterministic KPI computation
- **WHEN** se inyectan fixtures con combinaciones de containers/jobs/observability
- **THEN** la funcion de agregacion produce siempre los mismos KPIs y alertas esperadas
