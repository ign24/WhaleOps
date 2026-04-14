## 1. Memory compatibility layer

- [ ] 1.1 Identificar puntos de import acoplados a `cognitive_code_agent.memory` en findings/boot y definir interfaz mínima de proveedor.
- [ ] 1.2 Implementar adaptador de compatibilidad con `try/except ImportError` y estado de disponibilidad con causa (`module_missing`, `backend_unavailable`, `timeout`).
- [ ] 1.3 Integrar el adaptador en el wiring de startup para evitar excepciones fatales cuando el módulo de memoria no exista.

## 2. Findings tools hardening

- [ ] 2.1 Actualizar registro de `persist_findings` y `query_findings` para que siempre se registren con modo normal o degradado determinístico.
- [ ] 2.2 Estandarizar payload degradado de ambas tools (`status=degraded` + `cause`) y asegurar que `persist_findings` omita upsert/extracción en degradación.
- [ ] 2.3 Unificar señal de readiness de findings para que herramientas y runtime consuman el mismo estado.

## 3. Config and startup safety

- [ ] 3.1 Ajustar `src/cognitive_code_agent/configs/config.yml` con defaults/flags de memoria-findings compatibles con arranque resiliente.
- [ ] 3.2 Verificar que la inicialización de NAT no falle cuando memory esté ausente y que emita logs/telemetría estructurada de degradación.

## 4. Validation tests

- [ ] 4.1 Agregar tests unitarios para el adaptador de compatibilidad (módulo presente, módulo ausente, fallas de backend).
- [ ] 4.2 Agregar tests de registro de tools para validar disponibilidad normal y degradada de `persist_findings`/`query_findings`.
- [ ] 4.3 Agregar test de arranque de servicio que reproduzca el caso reportado (`No module named cognitive_code_agent.memory`) y valide continuidad del boot.
- [ ] 4.4 Ejecutar `uv run ruff check .`, `uv run ruff format --check .` y `uv run pytest -x -m "not e2e"` para cerrar la change list.
