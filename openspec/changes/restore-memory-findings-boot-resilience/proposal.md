## Why

El servicio NAT no inicia en este fork porque `config.yml` declara `persist_findings` y `query_findings`, pero el wiring de findings depende de `cognitive_code_agent.memory`, módulo que hoy no está disponible. Esto rompe el arranque en una ruta crítica y deja al agente sin herramientas de memoria even cuando podría operar en modo degradado.

## What Changes

- Reintroducir o desacoplar la dependencia de `src/cognitive_code_agent/memory` para que el stack de findings no dependa de un import inexistente.
- Endurecer el registro de `persist_findings` y `query_findings` con validación explícita de disponibilidad de backend.
- Agregar guardrails de degradación controlada: si memoria/findings no está disponible, el boot continúa y las herramientas responden de forma segura en lugar de tumbar el proceso.
- Ajustar configuración para reflejar flags y defaults compatibles con arranque resiliente.
- Añadir pruebas de validación de arranque y de registro de herramientas con/ sin backend de memoria.

## Capabilities

### New Capabilities
- `memory-module-compatibility`: resolución compatible de dependencias de memoria para que findings opere con implementación portada o fallback sin bloquear startup.

### Modified Capabilities
- `findings-store`: se amplía el contrato para registro robusto de `persist_findings`/`query_findings` y comportamiento degradado cuando memoria no está disponible.
- `memory-backend-readiness`: se amplía la evaluación de readiness para cubrir el caso de módulo de memoria ausente en boot y su degradación explícita.

## Impact

- Código afectado: `src/cognitive_code_agent/memory/**` (si se porta), `src/cognitive_code_agent/tools/**` (findings store/registro), y wiring de arranque en agentes/registro.
- Configuración afectada: `src/cognitive_code_agent/configs/config.yml` y posibles defaults de memoria/findings.
- Runtime: el servicio prioriza continuidad operacional sobre fallo fatal cuando faltan backends opcionales.
- Tests: unitarios e integración para startup, registro de tools y rutas degradadas de findings.
