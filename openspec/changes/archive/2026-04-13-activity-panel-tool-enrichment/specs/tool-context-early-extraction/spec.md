## Capability: tool-context-early-extraction

Extracción y visualización de información contextual de herramientas (comando, ruta) desde el momento en que la herramienta inicia su ejecución, no solo cuando termina.

---

### Requirement: command-summary-at-tool-start

Una entry de tipo `terminal` SHALL mostrar el comando en su subtitle desde el momento en que la entry es creada (estado `running`), sin esperar a `tool_end`.

#### Scenario: comando visible durante ejecución

WHEN se recibe un evento `tool_start` para una herramienta terminal con `toolArgs.command = "git status"`
THEN la entry creada en el timeline tiene `commandSummary = "git status"`
AND el subtitle de la entry muestra `"$ git status"` mientras el status es `running`

#### Scenario: comando actualizado al completarse

WHEN la entry tiene `commandSummary` desde `tool_start`
AND llega `tool_end` con un `commandSummary` diferente
THEN el merge actualiza el `commandSummary` con el valor del `tool_end`

---

### Requirement: file-path-at-tool-start

Una entry de tipo `file` SHALL mostrar la ruta del archivo en su subtitle desde el momento en que la entry es creada, si el path está disponible en `toolArgs`.

#### Scenario: ruta visible durante lectura/escritura

WHEN se recibe `tool_start` para una herramienta de archivo con `toolArgs.path = "/workspace/src/agent.py"`
THEN la entry tiene `sandboxPath = "/workspace/src/agent.py"`
AND el subtitle muestra la ruta mientras el status es `running`

---

### Requirement: terminal-subtitle-prefix

El subtitle de entries con category `terminal` SHALL mostrarse con prefijo `$ ` para indicar contexto de shell.

#### Scenario: prefijo $ en comando de terminal

WHEN una entry de tipo terminal tiene `commandSummary = "pytest -x"`
THEN el subtitle renderizado es `"$ pytest -x"`

#### Scenario: sin prefijo en entries no-terminal

WHEN una entry de tipo file tiene `sandboxPath = "/workspace/README.md"`
THEN el subtitle renderizado es `"/workspace/README.md"` sin prefijo
